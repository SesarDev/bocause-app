# Editor y constructor de dietas

## `BlockEditor`

- **Modo `plan`** (cliente): copy-on-write. Al guardar nace un bloque nuevo que apunta al original, y hay que elegir "Solo esta semana" o "Todo el plan".
- **Modo `biblioteca`** (nutricionista): una sola ración, la base, y se guarda sobre el mismo bloque. Ahí no hay original al que volver ni semana que elegir, y un bloque nuevo por cada retoque llenaría la biblioteca de duplicados.

## Constructor de dietas (nutricionista)

- **Edita en su sitio:** no hay intercambio entre días. Para repetir un plato está "Copiar a otros días".
- **Borrador:** todo pasa por `diet_drafts` (uno por hogar, solo staff). El cliente no ve nada hasta publicar.
- **Publicar:** va por la RPC `publish_plan`, en una transacción. Exige lunes. Qué se arrastra lo decide `domain/carryOver.ts`.
- **`/admin`:** vive fuera del gate de perfil. La nutricionista no tiene perfil en ningún hogar.
