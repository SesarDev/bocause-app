# Informe de extracción · Plan de septiembre de 2026

Qué se extrajo de los dos PDF de `docs/pdfs/` a `data/plans/2026-09.json`, y qué decisión se
tomó en cada punto donde el PDF no era literal o se contradecía. **Nada se ha corregido en
silencio**: todo lo que no es una transcripción directa está en una de las tablas de abajo.

- Fuente: `dieta_personalizada_cristina_medrano_villaroya_septiembre_2026_bocause-1.pdf` y
  `dieta_personalizada_andrés_serrano_modrego_septiembre_2026_bocause.pdf`.
- Fecha del plan en el PDF: domingo, 27 de septiembre de 2026.
- Resultado: 42 bloques, 188 alimentos, 71 entradas de catálogo, 49 celdas de plantilla.

## Cómo se leyó el PDF

Las páginas 1 a 4 y la 7 **no tienen capa de texto**: son imágenes. Se revisaron después
como PNG (ver abajo) y **no contienen ningún dato del plan**: son la portada, la metodología
de Bocause, los objetivos genéricos y la contraportada, iguales en los dos documentos salvo
la foto de portada. Todo el contenido del plan está en la página 5 (la tabla semanal
apaisada, que incluye también entrenamiento, comodín, AOVE, suplementación y
recomendaciones) y en la página 6 (el cheat meal).

El texto se extrajo con sus coordenadas y cada fragmento se asignó a su columna de día por el
**centro** del texto, no por el borde izquierdo, porque las celdas están centradas. Las filas
se delimitaron por los huecos verticales entre bandas. Una comprobación automática verificó
que ningún fragmento del cuerpo de la tabla se quedaba sin asignar.

Las dos tablas se compararon línea a línea: **comida y cena son idénticas en los dos PDF**
salvo un único dato (el jamón del lunes), lo que confirma que son platos compartidos.

## Diferencias entre las dos personas

Todas verificadas y recogidas como comprobaciones automáticas en `scripts/validate-plan.ts`
y en `src/domain/plan-real.test.ts`, de modo que si alguien toca el JSON y las rompe, salta.

| Punto | Cristina | Andrés |
|---|---|---|
| Franjas | desayuno, snack, snack 2, comida, cena | desayuno, almuerzo, comida, cena |
| Jamón de la cena del lunes | 60 g (6-8 lonchas finas) | 30 g (3-4 lonchas finas) |
| Pan en la comida | solo jueves, 40 g de barra integral | no tiene |
| Pan en la cena | no tiene | martes, miércoles y jueves, 40 g de barra integral |
| Postre de la comida | M plátano · X melocotón · J plátano | L melocotón · M plátano y manzana · X melocotón y mandarina/naranja · J plátano y manzana |
| Postre de la cena | M pera y chocolate · X manzana · J pera y chocolate | L kéfir y kiwi · M pera y chocolate · X manzana · J pera y chocolate · V kéfir y kiwi |
| Entrenamiento | lunes gimnasio | lunes gimnasio · miércoles running · sábado caminar |
| Comodín proteico | 6 opciones | las mismas 6, al doble de cantidad salvo la whey (20 g los dos) |
| Suplementación | solo protocolo de gimnasio | gimnasio (post con 200 ml de zumo en vez de plátano) y running (solo post) |

El resto de comidas y cenas coinciden en plato **y en cantidades**.

## Anomalías del PDF y decisión tomada

| # | Dónde | Qué dice el PDF | Decisión |
|---|---|---|---|
| 1 | Desayuno de Andrés, lunes, miércoles y viernes | `40 PAN DE MOLDE INTEGRAL` (sin unidad) | Se asumen **40 g**, que es la unidad que usa el mismo alimento el resto de días y en el PDF de Cristina. |
| 2 | Desayuno de Andrés jueves y almuerzo del sábado | `250-300 ML AGUA` | Cantidad dada como rango. **No se inventa un número**: el alimento se queda sin valor numérico y `250-300 ml` se guarda como medida casera. |
| 3 | Comida del sábado | `60 GR CR/180 GR ARROZ INTEGRAL` | Falta el `CC` tras el segundo peso. Se interpreta **180 g en cocido**, que es el patrón del resto de la tabla (`80 GR CR/160 GR CC`). |
| 4 | Comida del sábado | `CEBOLLA + SETAS` en una sola línea | Se **separan en dos alimentos**, para que la lista de la compra pueda sumar cada uno. El contenido no cambia: los dos siguen estando. |
| 5 | Postre de la cena, martes y jueves | `1 ONZA DE CHOCOLATE 70-90%` | La onza es la unidad, no un peso: se guarda como **1 unidad** con medida casera "1 onza". Si se leyera como gramos saldría "1 g de chocolate". |
| 6 | Almuerzo de Andrés, sábado | `MELOCOTÓN (1 unidad mediana)/` y `MANZANA (1 unidad pequeña)` en dos líneas | Es una alternativa partida por el maquetador. Se guarda como **un alimento** "Melocotón/manzana" con medida "1 unidad mediana o 1 unidad pequeña", siguiendo la regla de mantener las alternativas en la etiqueta. |
| 7 | Desayuno de Andrés, martes | `[BATIR TODO JUNTO]` | No es un título de plato sino una instrucción. Se guarda como **nota** del último ingrediente del smoothie, no como sección. El título de la sección es `[SMOOTHIE]`. |
| 8 | Toda la tabla | `C.VITAMÍNICO` | Se expande a **"Complejo vitamínico"** por legibilidad en móvil. |
| 9 | Varias celdas | `PROTEINA WHEY` | Se escribe **"Proteína whey"**, con tilde. |
| 10 | Toda la fruta | `PLÁTANO (1 unidad mediana)` y similares | El número del paréntesis **sí es una cantidad**. Cuando un alimento no tiene peso ni volumen y su medida empieza por "N unidad(es)" o "N ud", se guarda `units: N` además de la medida. Sin esto, toda la fruta se quedaría fuera de la lista de la compra. |
| 11 | Comodín proteico | Siete cabeceras "Opción 1…7" pero solo seis opciones rellenas | Se guardan las **seis opciones** que existen. La séptima está vacía en el PDF original de los dos. |
| 12 | Aceite de oliva | "máximo **13-14** cucharadas soperas… a la semana" | La regla del plan se guarda como **14** (`aoveMaxSpoonsPerWeek`), que es el límite superior y el valor que ya usaba el proyecto. El texto literal con el rango se conserva en las recomendaciones. |
| 13 | Domingo | `2 INGESTAS LIBRES A LA SEMANA` escrito dentro de la celda de comida | No es un plato: es la regla de la semana. El domingo queda **sin bloques** (celdas a `null`) y la regla vive en `rules.freeMealsPerWeek: 2`. |
| 14 | Comida del miércoles | `(1 guarnición mediana)` aparece tras `CEBOLLA`, después de puerro y zanahoria | Por posición se asigna como medida de **la cebolla**. Probablemente describa el conjunto de la verdura; queda anotado por si conviene repartirlo. |
| 15 | Desayuno del sábado | Cristina pone `40 GR PAN INTEGRAL` y Andrés `40 GR PAN INTEGRAL BARRA` | Se tratan como **el mismo alimento** (`pan-integral-barra`); la etiqueta de cada uno conserva su texto. |
| 16 | Cena del viernes | `165 GR ALITAS COMPLETA` | Se transcribe literal pese a la concordancia rara ("alitas completa"). |
| 17 | Suplementación de Andrés | Hay protocolo para gimnasio y running, pero el sábado entrena "Caminar" | **No se inventa** un protocolo para caminar: ese día no tiene suplementación en el plan. |
| 18 | Receta del cheat meal | "En una sartén antiadherente poco de Aceite de oliva virgen extra…" | Al texto del PDF le faltan palabras ("con un poco de"). Se transcribe **literal**, sin completarlo. |

## Fecha de inicio

El PDF está fechado el domingo 27 de septiembre de 2026 y no dice desde cuándo se aplica. Se
ha puesto `validFrom: 2026-09-28`, el lunes siguiente, que es lo que proponía `docs/PLAN.md`.
**Conviene confirmarlo**: si el plan empezaba otro día, basta cambiar ese campo.

No se ha puesto `validTo`: el plan sigue vigente hasta que llegue el del mes siguiente.

## Catálogo de alimentos

71 entradas con clave, nombre, sección del súper y si es apto para batch cooking. Las
alternativas del plan tienen **entrada propia** (`mandarina-naranja`, `boniato-patata`,
`hamburguesa-pavo-pollo`, `lentejas-legumbres`, `melocoton-manzana`,
`brocoli-champinones-calabacin`), porque en el súper se compra uno de los dos y así la lista
no obliga a elegir por vosotros.

Se marcaron como aptos para adelantar (`batchable`) los hidratos y las carnes que aguantan en
nevera: pasta de lentejas, lentejas, arroz integral, ñoquis, patata, boniato, carne picada,
ternera, pavo, pollo, solomillo, judía verde, zanahoria y brócoli. Los días de conservación
son una estimación conservadora de cocina, **no vienen del PDF**.

## Verificación visual contra las páginas en imagen

Los PDF se convirtieron a PNG (`docs/pdfs/<nombre>/`) y la tabla semanal de los dos se
revisó **mirándola**, no solo leyendo su capa de texto. Confirmado uno a uno:

- La asignación de columnas por día y de filas por franja es correcta en los dos documentos.
- La fila PAN está **entre COMIDA y POSTRE en el de Cristina** (pan de la comida) y **bajo
  CENA en el de Andrés** (pan de la cena). No es un error de lectura: están maquetados
  distinto a propósito.
- El comodín proteico tiene siete columnas pero la **opción 7 está vacía** en los dos.
- La suplementación de Andrés tiene las columnas en el orden Running, Gimnasio; PRE y ETT
  solo los lleva gimnasio. La de Cristina solo tiene columna de gimnasio.
- Las celdas vacías (postre del lunes de Cristina, pan del lunes de Andrés) están vacías de
  verdad en el PDF, con su línea de puntos.

De paso queda confirmada la seña de identidad visual que pide `CLAUDE.md` para la fase 5:
las columnas de **martes, jueves y sábado van en amarillo** y las etiquetas de franja son
bloques marinos con icono; las de PAN y POSTRE son subetiquetas en gris, más pequeñas.

## Qué no está en el JSON

- El contenido de las páginas 1 a 4 y 7: revisado y descartado, es material de marca
  (portada, "cómo hacemos nuestras dietas", metodología y objetivos genéricos,
  contraportada). No hay datos personales ni de dieta.
- Los platos 2 y 3 del cheat meal: en el PDF son plantillas vacías.
- Los tiempos de la receta: el campo "Tiempo:" está en blanco.

## Cómo comprobar que sigue correcto

```
npm run seed:validate   # esquema Zod + integridad referencial + expectativas de este informe
npm test                # incluye src/domain/plan-real.test.ts, que usa este plan de verdad
```
