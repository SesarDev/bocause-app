/**
 * El chat entre una persona y su nutricionista.
 *
 * Un hilo por perfil. El cliente solo ve el suyo; ella los ve todos. Eso no se decide aquí:
 * lo imponen las políticas de la 0009, y esto solo pide lo que le corresponde.
 *
 * El autor y su rol **no se mandan**: los pone un trigger a partir de `auth.uid()`. Si
 * viajaran desde el navegador, cualquiera podría firmar un mensaje como si fuera ella.
 */
import { useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ChatAnchor, ChatMessage, ChatRole } from '../domain/chat';
import { useMyProfile } from './auth';
import { keysFor } from './keys';
import { useProfiles } from './queries';
import { useActiveHousehold } from './scope';
import { supabase } from './supabase';

function anchorFrom(value: unknown): ChatAnchor | null {
  if (value === null || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const anchor: ChatAnchor = {};
  if (typeof raw['day'] === 'number') anchor.day = raw['day'];
  if (typeof raw['slot'] === 'string') anchor.slot = raw['slot'];
  if (typeof raw['date'] === 'string') anchor.date = raw['date'];
  if (typeof raw['title'] === 'string') anchor.title = raw['title'];
  return Object.keys(anchor).length === 0 ? null : anchor;
}

/** Lo que se guarda en la caché: el mensaje tal cual, sin nombres (ver `useThread`). */
type ChatRow = Omit<ChatMessage, 'authorName'> & { authorUserId: string | null };

export function threadKey(householdId: string | null, profileId: string) {
  return [...keysFor(householdId).all, 'chat', profileId] as const;
}

export function readsKey(householdId: string | null) {
  return [...keysFor(householdId).all, 'chat-reads'] as const;
}

/**
 * Hasta dónde ha leído cada parte, indexado por `profileId|papel`.
 *
 * Es un objeto plano y **no un Map** a propósito: la caché de TanStack Query se guarda en
 * IndexedDB pasando por JSON, y de ahí un Map vuelve convertido en `{}`. Con un Map, la
 * primera visita funcionaba y la siguiente reventaba con "reads.data?.get is not a
 * function" y una pantalla en blanco.
 */
export type ChatReads = Record<string, string>;

const readKey = (profileId: string, role: string) => `${profileId}|${role}`;

export function readsFrom(
  rows: readonly { profile_id: string; role: string; last_read_at: string }[],
): ChatReads {
  const reads: ChatReads = {};
  for (const row of rows) reads[readKey(row.profile_id, row.role)] = row.last_read_at;
  return reads;
}

export function lastReadOf(
  reads: ChatReads | undefined,
  profileId: string | null,
  role: ChatRole,
): string | null {
  if (reads === undefined || profileId === null) return null;
  return reads[readKey(profileId, role)] ?? null;
}

/* ─────────────────────── Leer un hilo ─────────────────────── */

export function useThread(profileId: string | null) {
  const householdId = useActiveHousehold();
  const { data: profiles } = useProfiles();

  /**
   * El nombre sale del perfil del hogar, y se pone **al leer**, no al guardar. Si se
   * guardara con el mensaje, un hilo que ya estuviera en la caché seguiría enseñando el
   * nombre viejo después de cambiarlo, o se quedaría sin él si los perfiles aún no habían
   * llegado cuando se pidió el hilo.
   *
   * La nutricionista no tiene perfil en el hogar: se queda sin nombre y la pantalla la
   * llama por su papel.
   */
  const nombrePorUsuario = useMemo(
    () =>
      new Map(
        (profiles ?? [])
          .filter((profile) => profile.userId !== null)
          .map((profile) => [profile.userId!, profile.displayName]),
      ),
    [profiles],
  );

  return useQuery({
    queryKey: threadKey(householdId, profileId ?? ''),
    enabled: profileId !== null,
    queryFn: async (): Promise<ChatRow[]> => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('profile_id', profileId!)
        .order('created_at');
      if (error) throw error;

      return (data ?? []).map((row) => ({
        id: row.id,
        authorRole: row.author_role,
        authorUserId: row.author_user_id,
        body: row.body,
        anchor: anchorFrom(row.cell),
        createdAt: row.created_at,
      }));
    },
    select: (rows): ChatMessage[] =>
      rows.map((row) => ({
        ...row,
        authorName:
          row.authorUserId === null ? null : (nombrePorUsuario.get(row.authorUserId) ?? null),
      })),
  });
}

export function useSendMessage(profileId: string | null) {
  const queryClient = useQueryClient();
  const householdId = useActiveHousehold();

  return useMutation({
    mutationFn: async ({ body, anchor }: { body: string; anchor?: ChatAnchor }) => {
      const texto = body.trim();
      if (texto === '') return;

      const { error } = await supabase.from('chat_messages').insert({
        profile_id: profileId!,
        body: texto,
        ...(anchor !== undefined ? { cell: anchor as never } : {}),
      });
      if (error) throw error;
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: threadKey(householdId, profileId ?? '') }),
  });
}

/* ─────────────────────── Hasta dónde he leído ─────────────────────── */

export function useChatReads() {
  const householdId = useActiveHousehold();

  return useQuery({
    queryKey: readsKey(householdId),
    queryFn: async (): Promise<ChatReads> => {
      const { data, error } = await supabase.from('chat_reads').select('*');
      if (error) throw error;
      // Una sola marca por hilo y papel; aquí solo interesan las del papel de quien mira,
      // y RLS ya filtra las que no le tocan.
      return readsFrom(data ?? []);
    },
  });
}

export function useMarkRead() {
  const queryClient = useQueryClient();
  const householdId = useActiveHousehold();

  return useMutation({
    mutationFn: async ({ profileId, role }: { profileId: string; role: ChatRole }) => {
      const { error } = await supabase
        .from('chat_reads')
        .upsert(
          { profile_id: profileId, role, last_read_at: new Date().toISOString() },
          { onConflict: 'profile_id,role' },
        );
      if (error) throw error;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: readsKey(householdId) }),
  });
}

/* ─────────────────────── Mi hilo (cliente) ─────────────────────── */

export function useMyThread() {
  const myProfile = useMyProfile(true);
  const profileId = myProfile.data?.id ?? null;
  const thread = useThread(profileId);
  const reads = useChatReads();

  return {
    profileId,
    thread,
    lastReadAt: lastReadOf(reads.data, profileId, 'cliente'),
  };
}

/* ─────────────────────── Realtime ─────────────────────── */

/**
 * Una respuesta aparece sin recargar. Con filtro por hilo, como manda la regla: sin él
 * llegarían los mensajes de todos los clientes a todo el mundo.
 */
export function useChatRealtime(profileId: string | null): void {
  const queryClient = useQueryClient();
  const householdId = useActiveHousehold();

  useEffect(() => {
    if (profileId === null) return;

    const channel = supabase
      .channel(`chat:${profileId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `profile_id=eq.${profileId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: threadKey(householdId, profileId) });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, profileId, householdId]);
}
