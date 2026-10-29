-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- Safe to run in a project that's already used for something else: it only
-- adds the charlie_progress table and the charlie_* functions. Running it again is fine.

-- One row per sync link. `secret` is the key at the end of the link; `version`
-- goes up on every save so two devices can't silently overwrite each other.
create table if not exists public.charlie_progress (
  secret text primary key,
  data jsonb not null,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);

-- No policies: the table can't be read or written directly with the public key.
-- The functions below are the only way in, and loading or saving needs the secret.
alter table public.charlie_progress enable row level security;

-- Makes a new sync link holding the given progress, and returns its key.
create or replace function public.charlie_new(p_data jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  k text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
begin
  if octet_length(p_data::text) > 1000000 then raise exception 'too large'; end if;
  insert into public.charlie_progress (secret, data) values (k, p_data);
  return k;
end;
$$;

create or replace function public.charlie_load(p_key text)
returns table (data jsonb, version integer)
language sql
stable
security definer
set search_path = ''
as $$
  select p.data, p.version from public.charlie_progress p where p.secret = p_key;
$$;

-- Returns the new version, or null if another device saved first (or the key is wrong).
create or replace function public.charlie_save(p_key text, p_data jsonb, p_expected integer)
returns integer
language sql
security definer
set search_path = ''
as $$
  update public.charlie_progress p
     set data = p_data, version = p.version + 1, updated_at = now()
   where p.secret = p_key and p.version = p_expected and octet_length(p_data::text) <= 1000000
  returning p.version;
$$;

revoke all on function public.charlie_new(jsonb) from public;
revoke all on function public.charlie_load(text) from public;
revoke all on function public.charlie_save(text, jsonb, integer) from public;
grant execute on function public.charlie_new(jsonb) to anon, authenticated;
grant execute on function public.charlie_load(text) to anon, authenticated;
grant execute on function public.charlie_save(text, jsonb, integer) to anon, authenticated;


-- The entries of a date-keyed object from p_since on.
create or replace function public.charlie_since(p_obj jsonb, p_since text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce((select jsonb_object_agg(e.key, e.value)
                     from jsonb_each(case when jsonb_typeof(p_obj) = 'object' then p_obj else '{}'::jsonb end) e
                    where e.key >= p_since), '{}'::jsonb);
$$;

-- Friends: everyone who has picked a name, their colour, the words they've marked
-- "I used it" (with the story, if they told it), the words they've celebrated,
-- how many words they've learned and which days they practised.
drop function if exists public.charlie_friends(text, text);
create function public.charlie_friends(p_key text, p_since text)
returns table (name text, color text, used jsonb, cheers jsonb, notes jsonb, mine boolean, learned integer, done jsonb, games jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select p.data->'name'->>'value',
         p.data->'name'->>'color',
         public.charlie_since(p.data->'used', p_since),
         public.charlie_since(p.data->'cheers', p_since),
         public.charlie_since(p.data->'notes', p_since),
         p.secret = p_key,
         (select count(*)::integer from jsonb_object_keys(case when jsonb_typeof(p.data->'cards') = 'object' then p.data->'cards' else '{}'::jsonb end)),
         (select coalesce(jsonb_agg(k), '[]'::jsonb) from jsonb_object_keys(case when jsonb_typeof(p.data->'done') = 'object' then p.data->'done' else '{}'::jsonb end) k),
         public.charlie_since(p.data->'games', to_char(now() - interval '2 days', 'YYYY-MM-DD'))
    from public.charlie_progress p
   where coalesce(p.data->'name'->>'value', '') <> ''
   order by 1;
$$;

revoke all on function public.charlie_friends(text, text) from public;
grant execute on function public.charlie_friends(text, text) to anon, authenticated;

-- "Who are you?": a new device picks a name and becomes that person.
-- Only names are needed, which is fine for a site shared among friends.
create or replace function public.charlie_claim(p_name text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.secret from public.charlie_progress p
   where lower(p.data->'name'->>'value') = lower(trim(p_name))
   order by p.updated_at desc
   limit 1;
$$;

revoke all on function public.charlie_claim(text) from public;
grant execute on function public.charlie_claim(text) to anon, authenticated;

-- Ella's stats: everyone's records, but only for the right password.
-- Set or change the password with:
--   insert into public.charlie_owner (id, password_hash)
--   values (1, extensions.crypt('your password', extensions.gen_salt('bf')))
--   on conflict (id) do update set password_hash = excluded.password_hash;
create table if not exists public.charlie_owner (
  id integer primary key default 1 check (id = 1),
  password_hash text not null
);
alter table public.charlie_owner enable row level security;

-- Records Ella has archived on her stats page (by the start of their key).
create table if not exists public.charlie_archived (id text primary key);
alter table public.charlie_archived enable row level security;

create or replace function public.charlie_owner_ok(p_password text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.charlie_owner o
                  where o.password_hash = extensions.crypt(p_password, o.password_hash));
$$;
revoke all on function public.charlie_owner_ok(text) from public;

create or replace function public.charlie_stats(p_password text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.charlie_owner_ok(p_password) then
    return null;
  end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
            'id', left(p.secret, 12),
            'updated_at', p.updated_at,
            'archived', exists (select 1 from public.charlie_archived a where a.id = left(p.secret, 12)),
            'data', p.data)), '[]'::jsonb)
            from public.charlie_progress p);
end;
$$;

-- Archive (or bring back) a record on Ella's stats page.
create or replace function public.charlie_archive(p_password text, p_id text, p_archived boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.charlie_owner_ok(p_password) then
    return false;
  end if;
  if p_archived then
    insert into public.charlie_archived (id) values (p_id) on conflict do nothing;
  else
    delete from public.charlie_archived where id = p_id;
  end if;
  return true;
end;
$$;

revoke all on function public.charlie_archive(text, text, boolean) from public;
grant execute on function public.charlie_archive(text, text, boolean) to anon, authenticated;

revoke all on function public.charlie_stats(text) from public;
grant execute on function public.charlie_stats(text) to anon, authenticated;

select 'Good Word, Charlie friends are ready' as done;
