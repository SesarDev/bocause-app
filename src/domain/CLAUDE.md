# Reglas de `domain/`

Lógica pura con tests en Vitest. Sin React ni Supabase: lo externo entra por parámetro (p. ej. el `lookup` de títulos en `describeChange.ts`).

## Biblioteca (`library.ts`)

- Una sola ración base por alimento. `instantiate` la reparte con el `portion_multiplier` de cada comensal.
- **Redondeo:** g y ml a múltiplos de 5, unidades a medias. Nunca a cero. **Con multiplicador 1 no se redondea**: la cantidad ya es la que escribió ella, y cambiar un 142 g por un 140 g es inventar.
- **Editar un bloque de biblioteca** va por `toEditableBlock` / `fromEditableBlock`: un bloque de biblioteca es un bloque con un solo comensal (`BASE_EATER`), así que lo edita el mismo `BlockEditor`. Esa ida y vuelta **no pasa por `instantiate`**: abrir y guardar sin tocar nada no puede cambiar ni un gramo.
- **Medida casera** ("1/3 de bandeja", "2 rebanadas"): no se multiplica. Se marca para repasar si el multiplicador no es 1.
- Archivar, no borrar: lo que está en una dieta publicada no puede desaparecer.

## Sustituciones

- Solo dentro de los grupos que define la nutricionista. Si un alimento no está en ninguno, no se ofrece cambiarlo. Nunca se deducen equivalencias.
- `substituteItem` recibe una función de conversión, porque cada persona convierte su propia ración.
- **"Solo para mí":** parte el alimento en dos. El original conserva la ración de los demás.
- Siempre pasa por `forkBlock`. Con el id original, "Restaurar original" se quedaría sin destino.
- `replaces` guarda el alimento del plan, no el paso intermedio, y se quita si se vuelve al de partida.

## Chat (`chat.ts`)

- **Sin IA:** contesta la nutricionista. Nada de este módulo habla con un modelo.
- `unreadCount` solo cuenta los mensajes de la otra parte: lo que escribes tú no es una novedad para ti.
- El ancla de una comida la construye `anchorFor` (día, franja y título del primer plato con nombre). No inventa título si el bloque no lo trae.

## Publicación (`carryOver.ts`)

- Los cambios del cliente sobreviven, salvo en las celdas que ha tocado la nutricionista.
- **Compara por contenido, no por id:** los ids cambian entre versiones.
- Un cambio que no se puede arrastrar **siempre** se avisa, aunque ella no haya tocado la celda.
- **Una celda vacía es una decisión, no una fila ausente.** No leerla con `??`.
