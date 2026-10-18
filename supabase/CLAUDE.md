# Base de datos, RLS y pruebas

## Permisos

- `is_staff()` lo decide la base de datos, no el cliente.
- **`staff_members`:** sin políticas de INSERT, UPDATE ni DELETE. Solo se escribe con `service_role` (`npm run staff:add`). Comprobarlo cada vez que se toque.
- **Escrituras de staff sobre `profiles` y `households`:** van por RPC `security definer` (`staff_upsert_profile`, `staff_create_household`). La 0002 limita `profiles` a la columna `theme`, y ese permiso por columna también bloquea a la nutricionista.
- **`plans`:** solo lo escribe staff.
- **Políticas nuevas:** añadir una nueva antes que reescribir la que funciona. Solo se reescribe para quitar permiso.

## Registro de cambios (`change_log`)

- Lo escriben triggers, no la app. Así también queda lo que llega tarde sin cobertura.
- Solo de añadir: sin políticas de UPDATE ni DELETE para nadie.
- Se agrupa por `tx_id`, no por marca de tiempo.
- `app.change_source` no se puede fijar desde fuera, porque PostgREST abre una transacción por petición. Por eso restaurar va por `restore_cell`.

## Chat interno (`chat_messages`, `chat_reads`)

- **El autor no viaja desde el navegador.** `author_user_id` y `author_role` los pone un trigger con `auth.uid()` e `is_staff()`. Si los mandara el cliente, cualquiera podría firmar un mensaje como si fuera la nutricionista.
- Solo de añadir, como `change_log`: sin políticas de UPDATE ni DELETE. Un consejo de nutrición reescrito después es peor que no tenerlo.
- **Un hilo por persona, no por hogar.** El cliente solo ve el suyo: ni el de quien vive con él. La nutricionista ve todos.
- `chat_reads` es `(profile_id, role)`: la marca de lectura de cada parte es suya.

## Cuentas y perfiles (0010)

- **Una cuenta, un perfil** (índice único parcial sobre `profiles.user_id`). Con dos, la persona tendría dos vidas: los checks, el chat y el registro cuelgan del perfil.
- **Nadie elige quién es.** `claim_profile`, `available_profiles` y `release_my_profile` se borraron: dejar de llamarlas desde la app no basta, siguen siendo una puerta.
- `staff_upsert_profile` enlaza la cuenta (`p_user_id`). Sin cuenta nueva conserva la que había: editar un nombre no puede dejar a alguien sin poder entrar.
- `claim_email` ya no autoriza nada; ahora solo dice cuál es el correo interno de la cuenta.

## Transacciones

- `publish_plan` (0008) toca cinco tablas: a medias dejaría dos dietas vigentes o una dieta sin plantilla.

## Pruebas (pgTAP y E2E)

- Las pruebas de permisos se escriben **antes** que la migración y se ven en rojo.
- **RLS deniega UPDATE y DELETE en silencio.** `throws_ok` sobre ellos siempre está mal: hay que comprobar que el dato no cambió. INSERT sí da error.
- **Nunca asertar cuentas absolutas de una tabla.** La base ya tiene datos: contar solo lo que crea la prueba, o comparar con una foto previa.
- `db reset` es lo único que comprueba que las migraciones se aplican en orden. Nada de esto toca producción.
