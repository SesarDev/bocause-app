/** Anillo de progreso del día. Decorativo: el porcentaje real va en el texto de al lado. */
export function ProgressRing({
  ratio,
  size = 34,
  children,
}: {
  ratio: number;
  size?: number;
  children?: React.ReactNode;
}) {
  const stroke = 3;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, ratio));

  return (
    <span className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true" className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-line"
        />
        {clamped > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - clamped)}
            className="text-accent transition-[stroke-dashoffset] duration-300"
          />
        )}
      </svg>
      <span className="absolute">{children}</span>
    </span>
  );
}
