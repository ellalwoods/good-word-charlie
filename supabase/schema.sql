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


-- Friends: everyone who has picked a name, and the words they've marked
-- "I used it" since p_since. Nothing else about anyone's progress is shared.
create or replace function public.charlie_friends(p_key text, p_since text)
returns table (name text, used jsonb, mine boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select p.data->'name'->>'value',
         coalesce((select jsonb_object_agg(e.key, e.value)
                     from jsonb_each(case when jsonb_typeof(p.data->'used') = 'object' then p.data->'used' else '{}'::jsonb end) e
                    where e.key >= p_since), '{}'::jsonb),
         p.secret = p_key
    from public.charlie_progress p
   where coalesce(p.data->'name'->>'value', '') <> ''
   order by 1;
$$;

revoke all on function public.charlie_friends(text, text) from public;
grant execute on function public.charlie_friends(text, text) to anon, authenticated;

select 'Good Word, Charlie friends are ready' as done;
