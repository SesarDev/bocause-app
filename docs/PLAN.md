# Plan de acción · Bocause Dieta PWA

16 fases en 4 hitos. Cada fase = una conversación de Claude Code en **modo plan**
(Shift+Tab), revisión del plan, ejecución, `typecheck + lint + test + build`, commit tuyo.

| Hito | Fases | Resultado |
|---|---|---|
| A · Cimientos | 0–4 | Proyecto, dominio testeado, datos extraídos, Supabase con RLS |
| B · MVP usable | 5–10 | Semana, checklist, trackers, intercambio, editor, compra |
| C · Completo | 11–14 | Entreno, recetas, adherencia, notas, planes mensuales, batch cooking |
| D · Producción | 15–16 | Notificaciones push, despliegue e instalación |

Al acabar el hito B ya podéis usarla a diario; despliega ahí (fase 16 adelantada) y sigue
iterando con la app en los móviles.

---

## Fase 0 · Preparación (manual, 20 min)

1. `npm create vite@latest bocause-app -- --template react-ts`, `git init`.
2. Copia a la raíz `CLAUDE.md`, `docs/`, `src/domain/schema.ts`, `src/styles/tokens.css`,
   `supabase/migrations/0001_init.sql` de este kit. PDFs en `docs/pdfs/`.
3. Crea el proyecto en Supabase (región `eu-west`), `npx supabase init` y `link`.
   `.env.local` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (y `.env*` en `.gitignore`).
4. En Supabase Auth: magic link activado, URL de redirección = localhost y la de Vercel.

## Fase 1 · Andamiaje, tema y PWA

```
Lee CLAUDE.md. Monta el andamiaje del proyecto:
- Dependencias del stack de CLAUDE.md (Tailwind v4 con @tailwindcss/vite, vite-plugin-pwa
  en modo injectManifest, TanStack Query + persist IndexedDB, Zustand, Zod, Supabase, Vitest).
- tsconfig estricto con noUncheckedIndexedAccess, ESLint + Prettier, scripts de CLAUDE.md.
- Importa src/styles/tokens.css. Crea un ThemeProvider (system/light/dark) que pone
  data-theme en <html>, actualiza <meta name="theme-color"> y persiste la preferencia.
- Manifest: nombre "Bocause", display standalone, orientation portrait, theme #121E2C,
  iconos maskable 192/512 (genera placeholders con el amarillo y marino de marca).
- Shell de la app: cabecera fija (logo de texto, selector de perfil vacío, botón tema) y
  barra inferior con 4 pestañas: Semana, Hoy, Compra, Más.
Criterio de aceptación: Lighthouse PWA instalable, cambio de tema sin parpadeo al recargar.
```

## Fase 2 · Lógica de dominio pura (con tests)

Es la fase más importante: toda la flexibilidad vive aquí, sin UI.

```
Lee CLAUDE.md y src/domain/schema.ts. Implementa en src/domain/ funciones puras con tests
Vitest (cobertura >90% en esta carpeta):
- dates.ts: weekStartOf(date), dayIndexOf(date), isoWeekDates(weekStart) en Europe/Madrid.
- resolve.ts: resolveWeek(plan, editedBlocks, templateCells, overrides, weekStart, profileId)
  → por día y franja del perfil: { cell, block|null, isFree, source: 'original'|'template'|'week' }.
  Para comida/cena usa scope "shared" y filtra los items a los que tienen portions[profileId].
- swap.ts: swapCells(a, b, level: 'week'|'template') → lista de upserts. Valida misma
  franja y mismo scope; permite celda vacía (mueve); el bloque viaja entero.
- edit.ts: forkBlock(block, changes) → copia con originBlockId; restore(cell, level).
- freeMeals.ts: canMarkFree(week) respetando rules.freeMealsPerWeek.
- progress.ts: slotProgress(block, checks, profileId), dayProgress, weekAdherence.
- shopping.ts: buildShoppingList(resolvedWeeks de ambos perfiles, foods, desde fecha)
  → suma por foodKey y unidad (usa rawG si existe, si no cookedG, ml o units), agrupa por
  sección y deja aparte los items sin foodKey o con medida no numérica ("al gusto").
- batch.ts: sugerencias de batch cooking (platos con foods batchable que se repiten o
  caen en los 3 días siguientes).
Tests obligatorios: swap compartido afecta a ambos perfiles; swap individual no toca al
otro; override semanal gana a la plantilla; restaurar vuelve al original; la compra suma
el pavo de los dos; ingesta libre no se puede marcar una 3ª vez.
```

## Fase 3 · Extracción de los PDFs a JSON

```
Lee CLAUDE.md, src/domain/schema.ts y los dos PDFs de docs/pdfs/. Genera
data/plans/2026-09.json con UN plan que contenga los dos perfiles ("cristina", "andres").
Reglas de extracción:
- Página de la tabla semanal: cada celda → Block. Comida y cena → scope "shared" con
  portions por persona; desayuno/snack/snack2/almuerzo → scope del perfil.
- "[TÍTULO]" → section.title en formato frase. "---" separa dos secciones "plato".
- Filas PAN y POSTRE → secciones kind "pan"/"postre" DENTRO del bloque de comida o cena
  de esa columna, solo en portions de quien las tenga.
- "80 GR CR/160 GR CC" → rawG 80, cookedG 160. El texto entre paréntesis → measure.
- Alternativas con "/" (PAVO/POLLO, BONIATO/PATATA) se mantienen en el label.
- Domingo: sin bloques (celdas null). Regla de 2 ingestas libres en rules.
- Comodín proteico, entrenos por día, suplementación por tipo de entreno, AOVE,
  recomendaciones y la receta del cheat meal (tortitas de plátano y canela).
- Crea el catálogo foods con key, sección del súper y batchable.
No corrijas nada en silencio: crea docs/extraccion-informe.md con una tabla de cada
anomalía y la decisión tomada. Crea scripts/validate-plan.ts (npm run seed:validate).
```

**Diferencias que ya he detectado y que el JSON debe reflejar** (úsalo para revisar):

- Cena del lunes (huevos rotos): jamón 60 g / 6-8 lonchas Cristina, 30 g / 3-4 lonchas Andrés.
  El resto de comidas y cenas coinciden en plato y cantidades.
- Pan en la cena: solo Andrés, martes, miércoles y jueves (40 g barra integral).
  Pan en la comida: solo Cristina, jueves (40 g barra integral).
- Postre de comida. Cristina: M plátano, X melocotón, J plátano. Andrés: L melocotón,
  M plátano + manzana, X melocotón + mandarina/naranja, J plátano + manzana.
- Postre de cena. Cristina: M pera + chocolate 70-90%, X manzana, J pera + chocolate.
  Andrés: L kéfir + kiwi, M pera + chocolate, X manzana, J pera + chocolate, V kéfir + kiwi.
- Andrés L, X, V desayuno: "40 PAN DE MOLDE INTEGRAL (2 rebanada pequeña)" sin unidad;
  asumir 40 g y anotarlo en el informe.
- Entreno. Cristina: lunes gimnasio. Andrés: lunes gimnasio, miércoles running, sábado caminar.
- Suplementación. Cristina gimnasio: pre-workout sin cafeína (45 min antes), ETT 5-10 g
  MAP/aminoácidos, post 30 g whey + plátano + 7 g creatina. Andrés gimnasio: igual pero post
  con 200 ml de zumo en vez de plátano; running: solo post (whey + plátano + creatina).
- Comodín: Andrés tiene el doble que Cristina en todas las opciones salvo la whey (20 g ambos).
- Fecha del plan: 27/09/2026. `validFrom` propuesto: lunes 28/09/2026 (confírmalo).

## Fase 4 · Supabase: datos, auth y hogar

```
Aplica supabase/migrations/0001_init.sql. Crea:
- scripts/seed-supabase.ts: crea el hogar, los dos perfiles (slug cristina/andres), inserta
  data/plans/2026-09.json en plans.data e inicializa template_cells desde plan.template.
- Pantalla de login con magic link y pantalla "¿Quién eres?" que vincula user_id al perfil
  (solo si está libre).
- src/data/: cliente tipado (supabase gen types), queries y mutations con TanStack Query,
  mutaciones optimistas, persistencia IndexedDB y reanudación offline.
- Suscripción Realtime a template_cells, week_overrides, blocks, checks, daily_logs y
  shopping_items que invalida/actualiza la caché.
Prueba con dos navegadores (dos usuarios) que las RLS permiten y bloquean lo esperado:
Andrés no puede editar el desayuno de Cristina, pero sí verlo y ver sus checks.
```

## Fase 5 · Vista Semana y vista Hoy

```
Implementa features/week:
- Barra de días sticky (L M X J V S D) con progreso del día en anillo; tocar = scroll al día.
- Scroll vertical de 7 tarjetas de día. Martes, jueves y sábado con bg-surface-alt y borde
  izquierdo amarillo (ritmo del PDF). Cabecera: nombre del día en mayúsculas, fecha y chip
  de entreno.
- En cada día, franjas del perfil: etiqueta marina con icono a la izquierda (como el PDF),
  bloque con secciones: título de plato, alimentos (label + cantidad formateada + measure en
  ink-muted), pan y postre como subsecciones discretas.
- Bloques compartidos con fondo bg-shared y un icono de "compartido".
- Al abrir: scroll automático al día de hoy y resaltado de la siguiente comida por hora
  (horas por defecto configurables en Más).
- Selector de perfil: Cristina / Andrés / Casa. "Casa" muestra solo comida y cena, con las
  dos raciones lado a lado y la suma para cocinar ("400 g total").
- Pestaña Hoy = el mismo componente con un solo día y los trackers de la fase 6.
- Domingo: tarjeta especial "2 ingestas libres" con contador de las usadas esta semana.
Usa datos reales de la fase 4. Revisa en 360x780 y en modo oscuro.
```

## Fase 6 · Checklist y trackers diarios

```
Implementa:
- Checkbox por alimento (44 px, marino con tic amarillo; en oscuro, al revés). Al marcar el
  último de la franja, la etiqueta muestra "Hecho" y la franja se atenúa. Mantener pulsado
  la etiqueta = marcar/desmarcar toda la franja.
- En vista Casa, avatar pequeño de quién ya lo ha marcado.
- Comodín proteico: tarjeta en Hoy con las opciones del perfil como chips; elegir + check.
  Aviso suave a partir de las 20:00 si no está hecho.
- AOVE: contador +/- en Hoy con barra semanal hacia 14 cucharadas.
- Agua: +250 ml con un toque, objetivo 2-3 L, mantener pulsado para corregir.
- Ingesta libre: menú de bloque → "Marcar como ingesta libre" (máx. 2/semana).
Checks fechados: cambiar de semana no pierde el historial.
```

## Fase 7 · Intercambio de bloques

```
Implementa features/swap. Flujo:
1. Menú del bloque → "Intercambiar con otro día" (o mantener pulsado el bloque).
2. Se abre una hoja inferior con un carrusel horizontal (scroll-snap) de la MISMA franja
   en los 7 días, día actual centrado, mostrando un resumen de cada bloque y las celdas
   vacías (domingo) como destino válido.
3. Tocar destino → selector "Solo esta semana" / "Todo el plan" (por defecto, esta semana).
4. Animación corta de intercambio (respeta reduced motion) + toast "Intercambiado" con
   "Deshacer" durante 6 s.
Alternativa en la vista Semana: modo intercambio con @dnd-kit, arrastrar el bloque sobre
otro de la misma franja; las franjas no compatibles se atenúan.
Los compartidos avisan "Cambia también para Andrés/Cristina". Indicador "Modificado" en
bloques que no vienen del original, con acción "Restaurar original".
```

## Fase 8 · Editor de bloques

```
Implementa features/editor en una hoja inferior a pantalla completa:
- Editar título de sección, añadir/quitar/reordenar secciones (plato, pan, postre, extra)
  y alimentos (drag handle).
- Alimento: label con autocompletado del catálogo foods (o texto libre), y para cada
  persona del scope: crudo, cocido, ml, unidades y medida casera. En compartidos, columnas
  por persona con "copiar de Cristina".
- Guardar = forkBlock (copy-on-write) aplicado a "esta semana" o "todo el plan".
- Comparar con el original (diferencias resaltadas) y "Restaurar original".
- Crear bloque nuevo en celda vacía.
Validación con Zod; no se puede guardar un bloque sin ningún alimento.
```

## Fase 9 · Lista de la compra

```
Implementa features/shopping:
- Rango: "Semana actual" / "Lo que queda de semana" / "Próxima semana".
- Generación con domain/shopping.ts para AMBOS perfiles, upsert en shopping_items
  (source auto) conservando checks e in_pantry al regenerar.
- Agrupada por sección del súper en orden de recorrido configurable.
- Cada línea: nombre, cantidad total, desglose por persona al expandir, de qué días viene.
- "Ya lo tengo" (despensa) separado de "comprado".
- Añadir items manuales. Compartir como texto (Web Share API).
- Realtime: lo que marca uno lo ve el otro al instante, también offline (cola).
```

## Fase 10 · Pulido del MVP

```
Recorre la app en 360x780, claro y oscuro: estados vacíos con acción clara, skeletons de
carga, errores de red con reintento, indicador offline, accesibilidad (roles, labels,
foco en hojas inferiores, contraste AA). Playwright: login, marcar checks, intercambiar
y deshacer, generar compra.
```
→ **Despliega aquí** (fase 16) y usadla unos días antes de seguir.

## Fase 11 · Entreno, suplementación, recetas y recomendaciones

```
- Chip de entreno del día → hoja con el protocolo pre / intra (ETT) / post del perfil.
- Recetas: sección enlazable desde el título del plato; editor sencillo de ingredientes y
  pasos; sección "Cheat meal" con la receta de tortitas del PDF.
- Pestaña Más: recomendaciones del plan (agua, aceite, sueño, alcohol, tecnología...)
  como tarjetas con iconos propios en línea, sin imágenes externas.
```

## Fase 12 · Adherencia, notas y exportación

```
- Notas por franja: hambre 1-5 y texto corto.
- Pantalla Progreso: adherencia semanal por franja y día, racha de días completos,
  comodín cumplido, AOVE y agua medios, comparativa semanas del plan.
- Exportar resumen para el nutricionista: página imprimible (CSS print) → "Guardar PDF"
  del navegador, y opción de compartir.
```

## Fase 13 · Planes mensuales versionados

```
- Pantalla Planes: listar, activar, archivar; el plan activo se elige por fecha.
- Importar: subir un JSON generado con el mismo proceso de la fase 3 → validación Zod →
  vista previa con diferencias respecto al plan anterior → confirmar.
- (Opcional) Edge Function que recibe el PDF y llama a la API de Claude para generar el
  borrador de JSON; siempre pasa por la vista previa antes de guardarse.
- Al cambiar de plan, la compra y los overrides se calculan contra el plan vigente de
  cada semana.
```

## Fase 14 · Batch cooking

```
Tarjeta en Hoy (domingos y cuando se detecte oportunidad): "Puedes adelantar" con los
platos aptos de los próximos 3 días, cantidad total para los dos y días de conservación.
```

## Fase 15 · Notificaciones push

```
- Claves VAPID, suscripción desde Más (pedir permiso solo tras gesto explícito).
- Service worker: manejar push y notificationclick (abre Hoy en la franja).
- Edge Function "send-reminders" + pg_cron cada 15 min: recordatorios por franja según
  reminder_settings, comodín pendiente a las 20:00 y agua opcional.
Nota: en Android funciona con la PWA instalada; probad en ambos móviles con ahorro de
batería desactivado para Chrome.
```

## Fase 16 · Despliegue e instalación

1. Vercel: importar el repo, variables de entorno, dominio.
2. Añadir la URL a las redirecciones de Supabase Auth.
3. En cada móvil: abrir en Chrome → menú → "Instalar aplicación" → login con magic link.
4. QA en los dispositivos: modo avión (checks y compra se sincronizan al volver),
   intercambio compartido visto en el otro móvil en <2 s, tema oscuro del sistema.

---

## Consejos para trabajar con Claude Code

- Empieza cada fase con: *"Lee CLAUDE.md y docs/PLAN.md, fase N. Propón el plan antes de
  escribir código."* Ajusta el plan y luego aprueba.
- Si una fase se alarga, `/compact` o conversación nueva; CLAUDE.md mantiene el contexto.
- Cuando descubras una regla nueva ("los kiwis se compran por unidades"), añádela a
  CLAUDE.md para que no se repita el error.
- Pide capturas o revisión en el navegador integrado tras cada cambio de UI.
- Commit por fase con mensaje descriptivo; rama por hito si quieres PRs revisables.
