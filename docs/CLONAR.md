# Clonar la app para otra consulta

La decisión 1 de [PLAN.md](PLAN.md) es **una app por consulta**: cada una tiene su propio
despliegue y su propio proyecto de Supabase, y no hay tabla de organizaciones. Clonar es,
por tanto, copiar el repositorio y cambiar datos, no tocar lógica.

Esta guía es la lista de lo que hay que cambiar. Si al clonar descubres algo que falta
aquí, añádelo: es la única forma de que siga siendo fiable.

## 1. El archivo de marca

Casi todo vive en [`src/config/brand.ts`](../src/config/brand.ts):

| Campo         | Qué es                                                              |
| ------------- | ------------------------------------------------------------------- |
| `appName`     | Nombre completo. Sale en la pestaña del navegador y en el manifest. |
| `shortName`   | Nombre bajo el icono del móvil. Que quepa: 12 caracteres o menos.   |
| `description` | Una frase. Sale en el manifest y en la etiqueta `description`.      |
| `wordmark`    | Lo que se lee en la cabecera y en la pantalla de entrar.            |
| `colors`      | Colores de marca, como cadenas, para el manifest y el arranque.     |
| `icons`       | Rutas de los iconos dentro de `public/`.                            |
| `legal`       | Enlaces a privacidad y términos. Vacíos = no se enlazan.            |
| `features`    | Qué funciones se activan en este clon.                              |

No hace falta tocar `index.html` ni `vite.config.ts`: el título, la descripción y el
manifest se rellenan desde ahí.

## 2. Los colores, también en el CSS

**`colors` de `brand.ts` está duplicado a propósito con
[`src/styles/tokens.css`](../src/styles/tokens.css)**, porque el CSS los necesita como
variables para toda la interfaz y el manifest los necesita como cadenas. Hay que cambiar
los dos sitios.

En `tokens.css`, los de marca son los `--bc-*` del principio. Al tocarlos, **comprobar el
contraste en los dos temas**, no solo en el claro: el rojo de error ya dio ese problema y
por eso se corrige aparte en `app.css`.

## 3. Los iconos

Sustituir en `public/`, respetando nombres y tamaños:

```
favicon.svg
apple-touch-icon-180x180.png
pwa-192x192.png            pwa-512x512.png
pwa-maskable-192x192.png   pwa-maskable-512x512.png
```

Los `maskable` necesitan margen: Android los recorta en círculo y lo que toque el borde se
pierde. Hay un generador en `scratchpad/gen-icons.mjs` de la fase 1.

## 4. El proyecto de Supabase

1. Proyecto nuevo, **región UE**.
2. Aplicar las migraciones de `supabase/migrations/` **en orden**.
3. `.env.local` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
4. Para sembrar: añadir `SUPABASE_SERVICE_ROLE_KEY` y los correos de cada perfil, y
   ejecutar `npm run seed`.

La clave `service_role` **nunca** lleva prefijo `VITE_` ni se sube al despliegue: se salta
todas las políticas RLS y solo se usa desde tu equipo.

## 5. El despliegue

1. Importar el repositorio en Vercel.
2. Variables de entorno: **solo** las dos `VITE_`.
3. Copiar la URL del despliegue y añadirla en Supabase → Authentication → URL
   Configuration, como *Site URL* y en *Redirect URLs* con `/**` al final. Sin eso, el
   enlace del correo devuelve a `localhost` y nadie puede entrar desde el móvil.
4. Dejar también `http://localhost:5173/**` en la lista, o se pierde el desarrollo local.

## 6. Comprobaciones antes de darlo por bueno

- La pestaña del navegador y el icono instalado muestran el nombre nuevo.
- En la pestaña de red no hay ninguna petición a dominios de terceros (la tipografía va
  autoalojada; si aparece `googleapis`, algo se ha colado).
- Entrar con el enlace mágico desde un móvil, y que al reabrir la app **no** vuelva a
  pedirlo.
- `npm run typecheck`, `lint`, `test`, `build` y `test:e2e` en verde.
