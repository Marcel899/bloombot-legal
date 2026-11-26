-- Bloombot website: unit collections ("what I own").
-- Run in the Supabase SQL editor. Safe to run again.
--
-- Security model (same as website messages)
--  * Tables have RLS on, NO policies and no table grants: nobody reads or
--    writes them through the REST API directly.
--  * Everything goes through SECURITY DEFINER functions that work out who is
--    calling from their Discord login, never from an argument.
--  * A collection is private unless its owner switches "Show on my profile" on.

create or replace function public.col_me()
returns text language sql stable security definer set search_path = '' as $$
  select i.provider_id from auth.identities i
  where i.user_id = auth.uid() and i.provider = 'discord'
  limit 1
$$;

create table if not exists public.collection_items (
  discord_id text not null check (discord_id ~ '^[0-9]{15,22}$'),
  item       text not null check (char_length(item) between 1 and 80),
  qty        integer not null check (qty between 1 and 9999),
  added_at   timestamptz not null default now(),
  primary key (discord_id, item)
);

create table if not exists public.collection_settings (
  discord_id text primary key,
  public     boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.collection_items enable row level security;
alter table public.collection_settings enable row level security;
revoke all on public.collection_items, public.collection_settings from anon, authenticated, public;

-- The caller, after checking they have a Bloombot account.
create or replace function public.col_require()
returns text language plpgsql stable security definer set search_path = '' as $$
declare me text := public.col_me();
begin
  if me is null then raise exception 'col:login'; end if;
  if not exists (select 1 from public.profiles where discord_id::text = me) then raise exception 'col:profile'; end if;
  return me;
end $$;

-- Someone's collection. Your own always; anyone else's only when they made it public.
-- Returns {mine, public, items: [{name, qty}]} or {mine:false, public:false} when private.
create or replace function public.col_get(p_user text default null)
returns json language plpgsql stable security definer set search_path = '' as $$
declare
  me text := public.col_me();
  who text := coalesce(nullif(btrim(p_user), ''), me);
  pub boolean;
begin
  if who is null or who !~ '^[0-9]{15,22}$' then raise exception 'col:bad_user'; end if;
  pub := coalesce((select s.public from public.collection_settings s where s.discord_id = who), false);
  if who is distinct from me and not pub then
    return json_build_object('mine', false, 'public', false, 'items', null);
  end if;
  return json_build_object(
    'mine', coalesce(who = me, false),
    'public', pub,
    'items', coalesce((select json_agg(json_build_object('name', c.item, 'qty', c.qty) order by c.added_at)
                       from public.collection_items c where c.discord_id = who), '[]'::json));
end $$;

-- Set how many of a unit you own; 0 removes it. Only names on the value list.
create or replace function public.col_set(p_item text, p_qty integer)
returns integer language plpgsql volatile security definer set search_path = '' as $$
declare me text := public.col_require(); q integer := greatest(0, least(coalesce(p_qty, 0), 9999));
begin
  if p_item is null or not exists (select 1 from public.item_values v where v.name = p_item) then raise exception 'col:bad_item'; end if;
  if q = 0 then
    delete from public.collection_items where discord_id = me and item = p_item;
    return 0;
  end if;
  if not exists (select 1 from public.collection_items where discord_id = me and item = p_item)
     and (select count(*) from public.collection_items where discord_id = me) >= 500 then
    raise exception 'col:full';
  end if;
  insert into public.collection_items (discord_id, item, qty) values (me, p_item, q)
  on conflict (discord_id, item) do update set qty = excluded.qty;
  return q;
end $$;

create or replace function public.col_set_public(p_on boolean)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare me text := public.col_require();
begin
  insert into public.collection_settings (discord_id, public, updated_at) values (me, coalesce(p_on, false), now())
  on conflict (discord_id) do update set public = excluded.public, updated_at = now();
  return coalesce(p_on, false);
end $$;

create or replace function public.col_clear()
returns integer language plpgsql volatile security definer set search_path = '' as $$
declare me text := public.col_require(); n integer;
begin
  delete from public.collection_items where discord_id = me;
  get diagnostics n = row_count;
  return n;
end $$;

-- Deleting a Bloombot account removes its collection too.
create or replace function public.col_forget()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.collection_items where discord_id = old.discord_id::text;
  delete from public.collection_settings where discord_id = old.discord_id::text;
  return old;
end $$;
drop trigger if exists col_forget on public.profiles;
create trigger col_forget after delete on public.profiles for each row execute function public.col_forget();

do $$
declare f text;
begin
  foreach f in array array['col_me()', 'col_require()', 'col_get(text)', 'col_set(text,integer)', 'col_set_public(boolean)', 'col_clear()']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  execute 'revoke all on function public.col_forget() from public, anon, authenticated';
end $$;
