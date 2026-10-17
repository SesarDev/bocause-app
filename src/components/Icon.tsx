import type { SVGProps } from 'react';

export type IconName =
  | 'semana'
  | 'hoy'
  | 'compra'
  | 'mas'
  | 'sistema'
  | 'claro'
  | 'oscuro'
  | 'perfil'
  | 'desayuno'
  | 'snack'
  | 'cubiertos'
  | 'cena'
  | 'entreno'
  | 'compartido'
  | 'libre'
  | 'casa'
  | 'agua'
  | 'aceite'
  | 'sueno'
  | 'alcohol'
  | 'tecnologia'
  | 'receta'
  | 'mensaje'
  | 'salir';

/** Iconos propios en línea: sin librerías ni imágenes externas (CLAUDE.md). */
const PATHS: Record<IconName, React.ReactNode> = {
  semana: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  hoy: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 10h18M8 3v4M16 3v4M8.5 15.5l2 2 4-4" />
    </>
  ),
  compra: (
    <>
      <path d="M3 4h2.2l2.3 11.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 2-1.5L21 8H6" />
      <circle cx="10" cy="20" r="1.3" />
      <circle cx="17.5" cy="20" r="1.3" />
    </>
  ),
  mas: (
    <>
      <circle cx="5.5" cy="12" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="18.5" cy="12" r="1.4" />
    </>
  ),
  sistema: (
    <>
      <rect x="2.5" y="4" width="19" height="13" rx="2.5" />
      <path d="M8 21h8M12 17v4" />
      <path d="M12 7.5a4.5 4.5 0 0 0 0 9z" fill="currentColor" stroke="none" />
    </>
  ),
  claro: (
    <>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2v2.4M12 19.6V22M2 12h2.4M19.6 12H22M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M19.1 4.9l-1.7 1.7M6.6 17.4l-1.7 1.7" />
    </>
  ),
  oscuro: <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />,
  perfil: (
    <>
      <circle cx="12" cy="8.5" r="3.8" />
      <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" />
    </>
  ),
  // Taza, como la columna de DESAYUNO del PDF.
  desayuno: (
    <>
      <path d="M4 8h12v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" />
      <path d="M16 10h2.2a2.3 2.3 0 0 1 0 4.6H16" />
      <path d="M7 3.5v2M11 3.5v2" />
    </>
  ),
  snack: (
    <>
      <path d="M12 8.5c-1.6-2-5.5-1.6-6.4 1.6-.8 3 1.4 8.4 4 9.4 1.3.5 1.9-.4 2.4-.4s1.1.9 2.4.4c2.6-1 4.8-6.4 4-9.4-.9-3.2-4.8-3.6-6.4-1.6z" />
      <path d="M12 8.5c0-2 1-3.4 2.8-4" />
    </>
  ),
  // Cuchillo y tenedor, como la columna de COMIDA del PDF.
  cubiertos: (
    <>
      <path d="M7 3v8M5 3v4a2 2 0 0 0 4 0V3M7 11v10" />
      <path d="M17 21v-8c2 0 3-1.2 3-4s-1-6-3-6-3 3.2-3 6 1 4 3 4z" />
    </>
  ),
  cena: (
    <>
      <path d="M7 3v8M5 3v4a2 2 0 0 0 4 0V3M7 11v10" />
      <path d="M20 15.5A5.5 5.5 0 0 1 14 8a6.5 6.5 0 1 0 6 7.5z" />
    </>
  ),
  entreno: (
    <>
      <circle cx="15.5" cy="4.6" r="1.7" />
      <path d="M8 21l2.6-5.2 3-1.6-1-4.4-3.4 2L7 14" />
      <path d="M13.6 14.2 16 17l1.5 4" />
    </>
  ),
  compartido: (
    <>
      <circle cx="8.5" cy="8.5" r="2.8" />
      <circle cx="16.5" cy="9.5" r="2.2" />
      <path d="M3.5 19a5 5 0 0 1 10 0M14.5 19a4.2 4.2 0 0 1 6 0" />
    </>
  ),
  libre: <path d="M12 3.5l2.3 4.9 5.2.7-3.8 3.7.9 5.3-4.6-2.6-4.6 2.6.9-5.3L4.5 9.1l5.2-.7z" />,
  casa: (
    <>
      <path d="M3.5 11 12 4l8.5 7" />
      <path d="M5.5 10v9a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-9" />
    </>
  ),
  agua: <path d="M12 3.5c3.4 4 6 7 6 9.8a6 6 0 0 1-12 0c0-2.8 2.6-5.8 6-9.8z" />,
  aceite: (
    <>
      <path d="M10 3h4v2.5l3.5 2.6A3 3 0 0 1 18.7 10v8a2 2 0 0 1-2 2H7.3a2 2 0 0 1-2-2v-8a3 3 0 0 1 1.2-1.9L10 5.5z" />
      <path d="M9 13h6" />
    </>
  ),
  sueno: (
    <>
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
      <path d="M15 3h4l-4 4h4" />
    </>
  ),
  alcohol: (
    <>
      <path d="M6 3h12l-5 7v8M8 21h8M13 18h-2" />
      <path d="M4 4l16 16" />
    </>
  ),
  tecnologia: (
    <>
      <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
      <path d="M10.5 5.5h3" />
      <path d="M4 4l16 16" />
    </>
  ),
  receta: (
    <>
      <path d="M6 3h11a2 2 0 0 1 2 2v16l-3-2-3 2-3-2-3 2V5a2 2 0 0 1 2-2z" />
      <path d="M9 8h7M9 12h7" />
    </>
  ),
  mensaje: (
    <>
      <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-5 4V6z" />
      <path d="M8 8h8M8 12h5" />
    </>
  ),
  salir: (
    <>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 8l-4 4 4 4M6 12h9" />
    </>
  ),
};

type IconProps = SVGProps<SVGSVGElement> & { name: IconName; size?: number };

export function Icon({ name, size = 24, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {PATHS[name]}
    </svg>
  );
}
