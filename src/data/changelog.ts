/**
 * Lectura del registro de cambios.
 *
 * La tabla la escriben los triggers de Postgres (0006_change_log.sql); desde aquí solo se
 * lee. Esto se encarga de traducir filas crudas a algo que `src/domain/describeChange.ts`
 * pueda convertir en frases: resolver quién fue cada actor y qué bloque había antes y
 * después.
 */
import { useQuery } from '@tanstack/react-query';
import type { ChangeEntry } from '../domain/describeChange';
import type { Block, Plan } from '../domain/schema';
import { keysFor } from './keys';
import { useActiveHousehold } from './scope';
import { supabase } from './supabase';
import { useProfiles } from './queries';

/** Cuántas entradas se traen. Suficiente para "qué ha pasado últimamente". */
const LIMITE = 200;

/** `block_id` de la fila guardada en `before`/`after`, sea celda o bloque. */
function blockIdOf(row: unknown): string | null {
  if (row === null || typeof row !== 'object') return null;
  const valor =
    (row as Record<string, unknown>)['block_id'] ?? (row as Record<string, unknown>)['id'];
  return typeof valor === 'string' ? valor : null;
}

function cellOf(value: unknown): ChangeEntry['cell'] {
  if (value === null || typeof value !== 'object') return {};
  const raw = value as Record<string, unknown>;
  const cell: ChangeEntry['cell'] = {};
  if (typeof raw['day'] === 'number') cell.day = raw['day'];
  if (typeof raw['slot'] === 'string') cell.slot = raw['slot'];
  if (typeof raw['scope'] === 'string') cell.scope = raw['scope'];
  if (typeof raw['weekStart'] === 'string') cell.weekStart = raw['weekStart'];
  return cell;
}

export function useChangeLog() {
  const householdId = useActiveHousehold();
  const { data: profiles } = useProfiles();

  return useQuery({
    queryKey: [...keysFor(householdId).all, 'change-log'] as const,
    enabled: householdId !== null,
    queryFn: async (): Promise<ChangeEntry[]> => {
      const { data, error } = await supabase
        .from('change_log')
        .select('*')
        .eq('household_id', householdId!)
        .order('created_at', { ascending: false })
        .limit(LIMITE);
      if (error) throw error;

      // El nombre sale del perfil del hogar. La nutricionista no tiene perfil aquí, así que
      // se queda sin nombre a propósito: `actorLabel` dirá "Tu nutricionista".
      const nombrePorUsuario = new Map(
        (profiles ?? [])
          .filter((profile) => profile.userId !== null)
          .map((profile) => [profile.userId!, profile.displayName]),
      );

      return (data ?? []).map((row) => ({
        id: row.id,
        txId: String(row.tx_id),
        createdAt: row.created_at,
        actorRole: row.actor_role,
        actorName:
          row.actor_user_id === null ? null : (nombrePorUsuario.get(row.actor_user_id) ?? null),
        table: row.table_name as ChangeEntry['table'],
        op: row.op,
        cell: cellOf(row.cell),
        beforeBlockId: blockIdOf(row.before),
        afterBlockId: blockIdOf(row.after),
        source: row.source,
      }));
    },
  });
}

/**
 * Título legible de cada bloque, mirando primero los bloques editados y luego los del plan
 * original. Devuelve null cuando ya no se sabe: puede referirse a algo borrado hace meses,
 * y es mejor callar que inventar un nombre.
 */
export function buildBlockTitles(
  plan: Plan | null,
  edited: readonly Block[] | undefined,
): (blockId: string | null) => string | null {
  const titulos = new Map<string, string>();

  const anotar = (block: Block) => {
    const title = block.sections.find((section) => section.title !== undefined)?.title;
    if (title !== undefined) titulos.set(block.id, title);
  };

  for (const block of plan?.blocks ?? []) anotar(block);
  for (const block of edited ?? []) anotar(block);

  return (blockId) => (blockId === null ? null : (titulos.get(blockId) ?? null));
}
