-- Bocause Dieta · chat entre cliente y nutricionista
--
-- Un hilo por persona, privado. Cristina y Andrés comparten casa, comida y cena, pero no
-- sus dudas: lo que se habla aquí es cómo te sienta algo, cómo te ves o por qué no llegas,
-- y eso es de cada uno. Por eso el hilo cuelga del perfil y no del hogar.
--
-- Es **solo de añadir**, como `change_log`: nadie reescribe ni borra lo dicho, ni el
-- cliente ni ella. Poder editar a posteriori un consejo de nutrición es peor que no tenerlo,
-- y poder borrar una pregunta incómoda, también.
--
-- No hay IA por ningún lado: esto es una persona hablando con otra.

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),

  -- De quién es el hilo. No es quién escribe: la nutricionista escribe en el hilo de su
  -- cliente, y el mensaje sigue perteneciendo a ese hilo.
  profile_id uuid not null references profiles(id) on delete cascade,

  author_user_id uuid references auth.users(id) on delete set null,
  author_role text not null check (author_role in ('cliente', 'nutricionista')),

  body text not null check (char_length(trim(body)) between 1 and 2000),

  -- Opcional: la comida de la que se habla, para no tener que explicar "lo del martes".
  -- {day, slot, scope, weekStart, date, title}
  cell jsonb,

  created_at timestamptz not null default now()
);

create index if not exists chat_messages_thread_idx on chat_messages (profile_id, created_at);

comment on column chat_messages.profile_id is
  'El hilo al que pertenece, que es el de una persona. No es quién lo escribió.';
comment on column chat_messages.cell is
  'La comida sobre la que se pregunta, si se abrió desde el menú de una franja.';

/* ─────────────── Hasta dónde ha leído cada parte ─────────────── */
--
-- Dos filas por hilo como mucho: la del cliente y la de la nutricionista. Sirve para el
-- punto de "tienes mensajes" sin tener que marcar mensaje a mensaje.

create table if not exists chat_reads (
  profile_id uuid not null references profiles(id) on delete cascade,
  role text not null check (role in ('cliente', 'nutricionista')),
  last_read_at timestamptz not null default now(),
  primary key (profile_id, role)
);

/* ─────────────── Quién escribe y con qué firma ─────────────── */
--
-- El autor y su rol NO los manda el cliente: los pone la base de datos. Si vinieran del
-- navegador, cualquiera podría firmar un mensaje como si fuera su nutricionista.

create or replace function stamp_chat_author() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.author_user_id := auth.uid();
  new.author_role := case when is_staff() then 'nutricionista' else 'cliente' end;
  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists stamp_chat_author on chat_messages;
create trigger stamp_chat_author before insert on chat_messages
  for each row execute function stamp_chat_author();

/* ─────────────── Permisos ─────────────── */

alter table chat_messages enable row level security;
alter table chat_reads enable row level security;

-- Leer: tu propio hilo, o todos si eres la nutricionista. Nunca el de quien vive contigo.
drop policy if exists "read own thread" on chat_messages;
create policy "read own thread" on chat_messages for select
  using (profile_id = my_profile_id() or (select is_staff()));

-- Escribir: en tu hilo, o en cualquiera si eres ella. Sin UPDATE ni DELETE para nadie.
drop policy if exists "write own thread" on chat_messages;
create policy "write own thread" on chat_messages for insert
  with check (profile_id = my_profile_id() or (select is_staff()));

drop policy if exists "own reads" on chat_reads;
create policy "own reads" on chat_reads for all
  using (
    (role = 'cliente' and profile_id = my_profile_id())
    or (role = 'nutricionista' and (select is_staff()))
  )
  with check (
    (role = 'cliente' and profile_id = my_profile_id())
    or (role = 'nutricionista' and (select is_staff()))
  );

/* ─────────────── Realtime ─────────────── */
--
-- Para que una respuesta aparezca sin recargar. La suscripción lleva filtro por hilo.

alter publication supabase_realtime add table chat_messages;
