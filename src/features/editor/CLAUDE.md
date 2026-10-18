# Editor y constructor de dietas

## `BlockEditor`

- **Modo `plan`** (cliente): copy-on-write. Al guardar nace un bloque nuevo que apunta al original, y hay que elegir "Solo esta semana" o "Todo el plan".
- **Modo `biblioteca`** (nutricionista): una sola ración, la base, y se guarda sobre el mismo bloque. Ahí no hay original al que volver ni semana que elegir, y un bloque nuevo por cada retoque llenaría la biblioteca de duplicados.

## Constructor de dietas (nutricionista)

- **Edita en su sitio:** no hay intercambio entre días. Para repetir un plato está "Copiar a otros días".
- **Tres formas de empezar** (`domain/draft.ts`): partir de la dieta actual (conserva los ids de bloque, que es lo que hace fiable la comparación al publicar), en blanco (`blankPlan`) o duplicando la de otro hogar (`duplicatePlan`).
- **Duplicar exige decir quién hace de quién.** Lo que no se asigna se queda fuera entero: su franja, sus bloques y su ración dentro de los compartidos. Las cantidades se copian tal cual; repartirle a nadie la comida de un tercero sería inventar raciones.
- **Una dieta nueva nace con el catálogo** (`plan.foods`): es lo que agrupa la lista de la compra y autocompleta el editor.
- **Borrador:** todo pasa por `diet_drafts` (uno por hogar, solo staff). El cliente no ve nada hasta publicar.
- **Publicar:** va por la RPC `publish_plan`, en una transacción. Exige lunes. Qué se arrastra lo decide `domain/carryOver.ts`.
- **`/admin`:** vive fuera del gate de perfil. La nutricionista no tiene perfil en ningún hogar.
