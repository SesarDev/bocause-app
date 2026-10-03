import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import type { SupplementProtocol } from '../../domain/schema';

const STEPS: { key: 'pre' | 'intra' | 'post'; label: string; hint: string }[] = [
  { key: 'pre', label: 'PRE', hint: 'Antes de entrenar' },
  { key: 'intra', label: 'ETT', hint: 'Durante el entreno' },
  { key: 'post', label: 'POST', hint: 'Al terminar' },
];

/** Los tres momentos de un protocolo. Lo que el plan deja en blanco, no se inventa. */
function Protocol({ protocol }: { protocol: SupplementProtocol }) {
  const steps = STEPS.filter((step) => protocol[step.key]);

  return (
    <section className="rounded-block border border-line p-3">
      <h3 className="flex items-center gap-2 text-dish font-bold text-ink">
        <Icon name="entreno" size={18} />
        {protocol.trainingType}
      </h3>

      {steps.length === 0 ? (
        <p className="mt-2 text-measure text-ink-muted">
          El plan no indica suplementación para este entreno.
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {steps.map((step) => (
            <li key={step.key} className="flex gap-3">
              <span className="grid h-7 w-12 shrink-0 place-items-center rounded-chip bg-slot text-[0.625rem] font-extrabold tracking-[0.06em] text-slot-ink">
                {step.label}
              </span>
              <span className="flex-1">
                <span className="block text-item text-ink">{protocol[step.key]}</span>
                <span className="block text-measure text-ink-muted">{step.hint}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function SupplementList({ protocols }: { protocols: readonly SupplementProtocol[] }) {
  return (
    <div className="flex flex-col gap-3 pb-2">
      {protocols.map((protocol) => (
        <Protocol key={protocol.trainingType} protocol={protocol} />
      ))}
    </div>
  );
}

/**
 * Hoja que se abre desde el chip de entreno de un día: enseña el protocolo de ESE
 * entrenamiento, y avisa si el plan no trae ninguno para él (a Andrés le pasa con "Caminar").
 */
export function TrainingSheet({
  training,
  protocols,
  onClose,
}: {
  training: string | null;
  protocols: readonly SupplementProtocol[];
  onClose: () => void;
}) {
  const match = protocols.filter((protocol) => protocol.trainingType === training);

  return (
    <Sheet open={training !== null} onClose={onClose} title={training ?? ''}>
      {training !== null &&
        (match.length > 0 ? (
          <SupplementList protocols={match} />
        ) : (
          <p className="pb-2 text-item text-ink-muted">
            El plan no trae suplementación para «{training}». Bebe agua y come lo previsto.
          </p>
        ))}
    </Sheet>
  );
}
