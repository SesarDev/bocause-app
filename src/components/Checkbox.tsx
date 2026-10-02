/**
 * Check por alimento.
 *
 * La caja mide 24 px pero el área que responde al dedo llega a 44 px gracias al
 * pseudoelemento `before`, que se sale de la caja sin ocupar sitio en la maqueta. En una
 * pantalla de 390 px cada píxel que no gaste el control se lo queda el nombre del alimento,
 * y aun así se marca bien de pie en la cocina.
 *
 * Marcado: marino con tic amarillo. En oscuro se invierte solo, porque los tokens
 * --color-check y --color-check-tick ya cambian de valor (tokens.css).
 */
export function Checkbox({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative my-1.5 grid size-6 shrink-0 place-items-center rounded-[0.4rem] border-2 transition-colors before:absolute before:-inset-2.5 before:content-[''] disabled:cursor-default ${
        checked ? 'border-check bg-check' : 'border-line'
      } ${disabled ? 'opacity-50' : ''}`}
    >
      {checked && (
        <svg viewBox="0 0 16 16" className="size-4 text-check-tick" aria-hidden="true">
          <path
            d="M3.5 8.5l3 3 6-6.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}
