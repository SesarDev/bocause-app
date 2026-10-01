# Bocause Dieta

PWA para seguir los planes nutricionales mensuales de Bocause entre dos personas
(Cristina y Andrés). Pensada para móvil: cocina, súper y a veces sin cobertura.

El contexto completo del proyecto está en [CLAUDE.md](CLAUDE.md) y el plan de trabajo por
fases en [docs/PLAN.md](docs/PLAN.md).

## Estructura

```
src/domain/      Lógica pura (esquemas Zod, resolución de semana, intercambios, compra)
src/styles/      tokens.css con la paleta y tipografía de marca
docs/pdfs/       Planes originales en PDF (fuente de la extracción de la fase 3)
supabase/        Migraciones de Postgres
```

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo en http://localhost:5173 |
| `npm run build` | Compila TypeScript y genera `dist/` |
| `npm run lint` | Oxlint |
| `npm run preview` | Sirve el build de producción |

## Estado: fase 0 completada

Solo está montado el andamiaje de Vite + React 19 + TypeScript. Las dependencias del stack
(Tailwind v4, TanStack Query, Zustand, Zod, Supabase, Vitest, vite-plugin-pwa) y los scripts
`typecheck`, `test` y `seed:validate` llegan en la fase 1.

Hasta entonces `npm run build` falla a propósito: `src/domain/schema.ts` importa `zod` y
`src/styles/tokens.css` importa `tailwindcss`, y ninguna de las dos está instalada todavía.

### Pendiente manual de la fase 0

1. Crear el proyecto en Supabase (región `eu-west`), `npx supabase init` y `link`.
2. Crear `.env.local` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
3. En Supabase Auth: activar magic link y añadir las URL de redirección (localhost y Vercel).
