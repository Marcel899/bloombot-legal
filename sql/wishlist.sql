-- Bloombot website: the wishlist, shared with the Discord bot.
-- Run in the Supabase SQL editor. Safe to run again.
--
-- The bot keeps the real wishlist (its /wishlist command and trade ad DMs).
-- This is the website's copy:
--  * wishlists         - one row per (trader, unit); the bot keeps it in step
--                        with its own list (bot/web_sync.py: sync_wishlists).
--  * wishlist_changes  - adds / removes made on the website, waiting for the bot
--                        to apply them to its own list (process_wishlist_changes).
-- RLS on, no policies, no table grants: the website goes through the wl_*
-- functions, which take the caller from their Discord login; the bot uses the
-- service key.

create or replace function public.wl_me()
returns text language sql stable security definer set search_path = '' as $$
  select i.provider_id from auth.identities i
  where i.user_id = auth.uid() and i.provider = 'discord'
  limit 1
$$;

create table if not exists public.wishlists (
  discord_id text not null check (discord_id ~ '^[0-9]{15,22}$'),
  name       text not null check (char_length(name) between 1 and 80),
  added_at   timestamptz not null default now(),
  primary key (discord_id, name)
);
create index if not exists wishlists_name_idx on public.wishlists (name);

create table if not exists public.wishlist_changes (
  id          bigint generated always as identity primary key,
  discord_id  text not null,
  name        text not null,
  action      text not null check (action in ('add', 'remove')),
  status      text not null default 'pending' check (status in ('pending', 'processing', 'done', 'failed')),
  reason      text,
  created_at  timestamptz not null default now(),
  processed_at timestamptz
);
create index if not exists wishlist_changes_pending_idx on public.wishlist_changes (status, id) where status in ('pending', 'processing');

alter table public.wishlists enable row level security;
alter table public.wishlist_changes enable row level security;
revoke all on public.wishlists, public.wishlist_changes from anon, authenticated, public;

-- Someone's wishlist (any logged-in trader can see what others want; that's
-- what it's for). Without p_user: your own.
create or replace function public.wl_get(p_user text default null)
returns json language plpgsql stable security definer set search_path = '' as $$
declare me text := public.wl_me(); who text := coalesce(nullif(btrim(p_user), ''), me);
begin
  if me is null then raise exception 'wl:login'; end if;
  if who !~ '^[0-9]{15,22}$' then raise exception 'wl:bad_user'; end if;
  return json_build_object('mine', who = me, 'max', 20,
    'items', coalesce((select json_agg(w.name order by w.added_at) from public.wishlists w where w.discord_id = who), '[]'::json));
end $$;

-- Add (p_on) or remove a unit. Same rules as /wishlist: 20 units at most,
-- names from the value list.
create or replace function public.wl_set(p_name text, p_on boolean)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare me text := public.wl_me(); have boolean;
begin
  if me is null then raise exception 'wl:login'; end if;
  if not exists (select 1 from public.profiles where discord_id::text = me) then raise exception 'wl:profile'; end if;
  if p_name is null or not exists (select 1 from public.item_values v where v.name = p_name) then raise exception 'wl:bad_item'; end if;
  perform pg_advisory_xact_lock(hashtext('wl:' || me));
  if (select count(*) from public.wishlist_changes where discord_id = me and created_at > now() - interval '1 hour') >= 120 then
    raise exception 'wl:slow';
  end if;
  have := exists (select 1 from public.wishlists where discord_id = me and name = p_name);
  if p_on and not have then
    if (select count(*) from public.wishlists where discord_id = me) >= 20 then raise exception 'wl:full'; end if;
    insert into public.wishlists (discord_id, name) values (me, p_name);
    insert into public.wishlist_changes (discord_id, name, action) values (me, p_name, 'add');
  elsif not p_on and have then
    delete from public.wishlists where discord_id = me and name = p_name;
    insert into public.wishlist_changes (discord_id, name, action) values (me, p_name, 'remove');
  end if;
  return coalesce(p_on, false);
end $$;

-- Deleting a Bloombot account removes the website copy too (the bot clears its own).
create or replace function public.wl_forget()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.wishlists where discord_id = old.discord_id::text;
  delete from public.wishlist_changes where discord_id = old.discord_id::text;
  return old;
end $$;
drop trigger if exists wl_forget on public.profiles;
create trigger wl_forget after delete on public.profiles for each row execute function public.wl_forget();

do $$
declare f text;
begin
  foreach f in array array['wl_me()', 'wl_get(text)', 'wl_set(text,boolean)']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  execute 'revoke all on function public.wl_forget() from public, anon, authenticated';
end $$;
