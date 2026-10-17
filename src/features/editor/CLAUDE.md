# Constructor de dietas (nutricionista)

- **Edita en su sitio:** no hay intercambio entre días. Para repetir un plato está "Copiar a otros días".
- **Borrador:** todo pasa por `diet_drafts` (uno por hogar, solo staff). El cliente no ve nada hasta publicar.
- **Publicar:** va por la RPC `publish_plan`, en una transacción. Exige lunes. Qué se arrastra lo decide `domain/carryOver.ts`.
- **`/admin`:** vive fuera del gate de perfil. La nutricionista no tiene perfil en ningún hogar.
