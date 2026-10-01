# Bocause Dieta

PWA para seguir los planes nutricionales mensuales de Bocause entre dos personas
(Cristina y Andrés). Pensada para móvil: cocina, súper y a veces sin cobertura.

El contexto completo del proyecto está en [CLAUDE.md](CLAUDE.md) y el plan de trabajo por
fases en [docs/PLAN.md](docs/PLAN.md).

## Estructura

```
src/app/         Composición de proveedores (TanStack Query, tema)
src/domain/      Lógica pura (esquemas Zod, resolución de semana, intercambios, compra)
src/data/        Cliente de Supabase, queries y caché persistida
src/features/    Una carpeta por funcionalidad (shell, theme, week, checklist...)
src/components/  Primitivas de UI propias
src/stores/      Estado de interfaz con Zustand (tema, pestaña, perfil activo)
src/styles/      tokens.css con la paleta y tipografía de marca
src/sw.ts        Service worker propio (precaché ahora, Web Push en la fase 15)
docs/pdfs/       Planes originales en PDF (fuente de la extracción de la fase 3)
supabase/        Migraciones de Postgres
```

## Comandos

| Comando                | Qué hace                                        |
| ---------------------- | ----------------------------------------------- |
| `npm run dev`          | Servidor de desarrollo en http://localhost:5173 |
| `npm run build`        | Compila TypeScript y genera `dist/`             |
| `npm run preview`      | Sirve el build de producción                    |
| `npm run typecheck`    | TypeScript en los tres proyectos                |
| `npm run lint`         | ESLint                                          |
| `npm run format`       | Prettier (escribe)                              |
| `npm run format:check` | Prettier (solo comprueba)                       |
| `npm test`             | Vitest una pasada                               |
| `npm run test:watch`   | Vitest en modo vigilancia                       |

## Estado: fase 1 completada

Andamiaje, tema y PWA. Están montados el stack completo (Tailwind v4, TanStack Query con
caché persistida en IndexedDB, Zustand, Zod, Supabase, Vitest, vite-plugin-pwa), el tema
claro/oscuro/sistema sin parpadeo al recargar, el manifest instalable con iconos maskable y
el shell con cabecera y cuatro pestañas (Semana, Hoy, Compra, Más).

Las cuatro pestañas muestran estados vacíos: el contenido real llega en las fases 5 a 11.

### Configuración local

Copia `.env.example` a `.env.local` y rellena las dos variables de Supabase. La app todavía
no se conecta a Supabase; empieza a hacerlo en la fase 4.

### Decisiones que conviene recordar

- **Linter**: ESLint + Prettier, como pide `docs/PLAN.md`. El template de Vite venía con
  Oxlint y se retiró.
- **El tema se guarda en `localStorage`**, no en IndexedDB, porque el script antiparpadeo de
  `index.html` tiene que leerlo de forma síncrona antes del primer pintado. Es preferencia de
  interfaz, no dato de dominio.
- **`src/domain/schema.ts` y `src/styles/tokens.css` están en `.prettierignore`**: vienen del
  kit con el formato cuidado a mano.
