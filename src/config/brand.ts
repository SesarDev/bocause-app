/**
 * Todo lo que cambia al clonar la app para otra consulta, en un solo archivo.
 *
 * La decisión 1 de `docs/PLAN.md` es "una app por consulta": cada una tendrá su despliegue
 * y su proyecto de Supabase, sin tabla de organizaciones. Para que clonar sea cambiar
 * datos y no buscar cadenas por el código, el nombre, los textos, los iconos, los enlaces
 * legales y las funciones activas viven aquí.
 *
 * **No importa nada.** Lo lee tanto la app como `vite.config.ts` al construir el manifest
 * y el HTML, y ahí no hay navegador ni React.
 *
 * Los colores están duplicados a propósito con `src/styles/tokens.css`: el CSS los necesita
 * como variables para toda la interfaz, y aquí hacen falta como cadenas para el manifest y
 * la barra del navegador. Al cambiarlos hay que tocar los dos sitios; `docs/CLONAR.md` lo
 * recuerda.
 */

export type BrandConfig = {
  appName: string;
  shortName: string;
  description: string;
  /** Lo que se lee en la cabecera. El punto final se pinta en color de acento. */
  wordmark: string;
  lang: string;
  colors: {
    accent: string;
    navy: string;
    slate: string;
    mint: string;
    /** Fondo del arranque y color de la barra del navegador en oscuro. */
    splash: string;
  };
  icons: {
    favicon: string;
    appleTouch: string;
    pwa192: string;
    pwa512: string;
    maskable192: string;
    maskable512: string;
  };
  /** Vacíos hasta la revisión legal del hito K; no se enlazan si están vacíos. */
  legal: {
    privacy: string;
    terms: string;
  };
  /**
   * Dominio con el que se forman los correos internos de las cuentas.
   *
   * Supabase identifica a cada cuenta por un correo, pero aquí nadie escribe el suyo ni
   * recibe nada: la nutricionista da de alta a "marta" y por dentro se guarda
   * `marta@<userDomain>`. Es un apaño honesto y hay que saberlo: **no son buzones**, así
   * que no vale para recuperar contraseñas ni para avisar de nada.
   */
  auth: {
    userDomain: string;
  };
  features: {
    /**
     * Chat interno entre cliente y nutricionista (fase 19). Si una consulta prefiere
     * atender las dudas por otro canal, se apaga aquí y desaparecen la sección "Tu
     * nutricionista", el "Preguntar sobre esto" de la franja y los Mensajes del panel.
     */
    chat: boolean;
    substitutions: boolean;
  };
};

export const brand: BrandConfig = {
  appName: 'Bocause',
  shortName: 'Bocause',
  description: 'Vuestro plan nutricional de Bocause, día a día.',
  wordmark: 'BOCAUSE',
  lang: 'es',
  colors: {
    accent: '#facc15',
    navy: '#121e2c',
    slate: '#2f3742',
    mint: '#e5f2f2',
    splash: '#121e2c',
  },
  icons: {
    favicon: '/favicon.svg',
    appleTouch: '/apple-touch-icon-180x180.png',
    pwa192: 'pwa-192x192.png',
    pwa512: 'pwa-512x512.png',
    maskable192: 'pwa-maskable-192x192.png',
    maskable512: 'pwa-maskable-512x512.png',
  },
  legal: {
    privacy: '',
    terms: '',
  },
  auth: {
    userDomain: 'bocause.local',
  },
  features: {
    chat: true,
    substitutions: true,
  },
};
