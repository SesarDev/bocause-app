/**
 * Catálogo, biblioteca y equivalencias (0007_library.sql).
 *
 * Son datos de la consulta, no de un hogar. Los lee cualquiera que haya entrado —el cliente
 * los necesita para sustituir alimentos y para el chat— y los escribe solo la nutricionista,
 * que es lo que imponen las políticas; aquí no se comprueba nada de eso, porque la última
 * palabra la tiene la base de datos.
 *
 * Todo lo que entra pasa por Zod, como el resto del proyecto: `content` y `members` son
 * `jsonb` y nadie garantiza su forma salvo el esquema.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  EquivalenceGroup,
  Food,
  LibraryBlock,
  LibrarySection,
  type SlotKey,
} from '../domain/schema';
import { consultaKeys } from './keys';
import { supabase } from './supabase';

/* ─────────────────────── Catálogo ─────────────────────── */

export function useFoods() {
  return useQuery({
    queryKey: consultaKeys.foods(),
    queryFn: async (): Promise<Food[]> => {
      const { data, error } = await supabase
        .from('foods')
        .select('*')
        .eq('archived', false)
        .order('name');
      if (error) throw error;

      return (data ?? []).map((row) =>
        Food.parse({
          key: row.key,
          name: row.name,
          section: row.section,
          unit: row.unit,
          batchable: row.batchable,
          ...(row.keeps_days !== null ? { keepsDays: row.keeps_days } : {}),
        }),
      );
    },
  });
}

export function useSaveFood() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (food: Food) => {
      const { error } = await supabase.from('foods').upsert(
        {
          key: food.key,
          name: food.name,
          section: food.section,
          unit: food.unit,
          batchable: food.batchable,
          keeps_days: food.keepsDays ?? null,
        },
        { onConflict: 'key' },
      );
      if (error) throw error;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: consultaKeys.foods() }),
  });
}

export function useArchiveFood() {
  const queryClient = useQueryClient();

  return useMutation({
    // Archivar y no borrar: un alimento puede estar dentro de dietas ya publicadas, y
    // borrarlo dejaría esas raciones huérfanas (decisión 7 de PLAN.md).
    mutationFn: async (key: string) => {
      const { error } = await supabase.from('foods').update({ archived: true }).eq('key', key);
      if (error) throw error;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: consultaKeys.foods() }),
  });
}

/* ─────────────────────── Biblioteca ─────────────────────── */

export function useLibraryBlocks() {
  return useQuery({
    queryKey: consultaKeys.libraryBlocks(),
    queryFn: async (): Promise<LibraryBlock[]> => {
      const { data, error } = await supabase
        .from('library_blocks')
        .select('*')
        .eq('archived', false)
        .order('name');
      if (error) throw error;

      return (data ?? []).map((row) => {
        const content = row.content as { sections?: unknown };
        return LibraryBlock.parse({
          id: row.id,
          name: row.name,
          slots: row.slots,
          tags: row.tags,
          sections: LibrarySection.array().parse(content.sections ?? []),
          ...(row.notes !== null ? { notes: row.notes } : {}),
          archived: row.archived,
        });
      });
    },
  });
}

export function useSaveLibraryBlock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (block: LibraryBlock) => {
      const { error } = await supabase.from('library_blocks').upsert({
        id: block.id,
        name: block.name,
        slots: block.slots,
        tags: block.tags,
        content: { sections: block.sections } as never,
        notes: block.notes ?? null,
        archived: block.archived,
        created_by: null,
      });
      if (error) throw error;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: consultaKeys.libraryBlocks() }),
  });
}

/* ─────────────────────── Equivalencias ─────────────────────── */

export function useEquivalenceGroups() {
  return useQuery({
    queryKey: consultaKeys.equivalences(),
    queryFn: async (): Promise<EquivalenceGroup[]> => {
      const { data, error } = await supabase.from('equivalence_groups').select('*').order('name');
      if (error) throw error;

      return (data ?? []).map((row) =>
        EquivalenceGroup.parse({
          id: row.id,
          name: row.name,
          ...(row.description !== null ? { description: row.description } : {}),
          members: row.members,
          archived: row.archived,
        }),
      );
    },
  });
}

export function useSaveEquivalenceGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (group: EquivalenceGroup) => {
      const { error } = await supabase.from('equivalence_groups').upsert({
        id: group.id,
        name: group.name,
        description: group.description ?? null,
        members: group.members as never,
        archived: group.archived,
      });
      if (error) throw error;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: consultaKeys.equivalences() }),
  });
}

/** Las franjas, en el orden del día, para los filtros de la biblioteca. */
export const SLOTS_EN_ORDEN: readonly SlotKey[] = [
  'desayuno',
  'snack',
  'almuerzo',
  'snack2',
  'comida',
  'cena',
];
