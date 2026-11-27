-- Bloombot website: Advent calendar rewards (December 2026).
-- Run in the Supabase SQL editor. Safe to run again: prizes are only drawn up once.
--
-- * Doors open at 00:00 UTC, one a day, 1–24 December. You can only open today's
--   door; a missed day stays missed.
-- * Every door gives XP. The site saves a row in advent_opens and the bot pays
--   it (amounts from ADVENT_XP in bot/leveling.py), like weekly quests.
-- * 12 units are hidden on random days, each dropping at a secret time on its
--   day. The first eligible trader to open (or re-check) a door after the drop
--   wins it. A unit nobody found carries over to the next days.
-- * Infectia: every door you open is one ticket. Drawn after door 24 closes
--   (25 December 00:00 UTC).
-- * Open 12 doors: "Advent" banner. All 24: "Golden Advent" banner.
-- * To win a unit: verified Roblox account, level 3+, Bloombot account at least
--   7 days old, one unit per person. RLS on, no grants: everything goes through
--   the functions below.

create or replace function public.adv_me()
returns text language sql stable security definer set search_path = '' as $$
  select i.provider_id from auth.identities i
  where i.user_id = auth.uid() and i.provider = 'discord'
  limit 1
$$;

-- The clock (its own function so it can be tested).
create or replace function public.adv_now()
returns timestamptz language sql stable set search_path = '' as $$ select now() $$;

-- Midnight UTC that starts door p_day.
create or replace function public.adv_day_start(p_day integer)
returns timestamptz language sql immutable set search_path = '' as $$
  select make_timestamptz(2026, 12, p_day, 0, 0, 0, 'UTC')
$$;

-- Today's door (1–24), or null outside 1–24 December 2026.
create or replace function public.adv_today()
returns integer language sql stable set search_path = '' as $$
  select case when t >= public.adv_day_start(1) and t < public.adv_day_start(25)
              then extract(day from t at time zone 'utc')::int end
  from (select public.adv_now() as t) x
$$;

create table if not exists public.advent_opens (
  discord_id   text not null check (discord_id ~ '^[0-9]{15,22}$'),
  day          integer not null check (day between 1 and 24),
  opened_at    timestamptz not null default now(),
  checked_at   timestamptz not null default now(),
  status       text not null default 'pending' check (status in ('pending', 'processing', 'given', 'failed')),
  reason       text,
  processed_at timestamptz,
  primary key (discord_id, day)
);
create index if not exists advent_opens_pending_idx on public.advent_opens (status, opened_at) where status in ('pending', 'processing');
alter table public.advent_opens enable row level security;
revoke all on public.advent_opens from anon, authenticated, public;

create table if not exists public.advent_prizes (
  id           bigint generated always as identity primary key,
  kind         text not null check (kind in ('first', 'draw')),
  day          integer not null unique check (day between 1 and 24),
  unit         text not null,
  drop_at      timestamptz not null,          -- secret until someone wins
  winner       text,
  winner_name  text,
  roblox_name  text,
  won_at       timestamptz,
  paid         boolean not null default false,  -- owner traded it in Roblox
  notified     boolean not null default false   -- bot sent the winner a DM
);
alter table public.advent_prizes enable row level security;
revoke all on public.advent_prizes from anon, authenticated, public;

-- Hide the 12 units on 12 random days (1–23), each at a random time between
-- 01:00 and 23:00 UTC that day, plus the Infectia draw on day 24. Only once.
do $$
begin
  if not exists (select 1 from public.advent_prizes) then
    insert into public.advent_prizes (kind, day, unit, drop_at)
    select 'first', d.day, u.unit,
           public.adv_day_start(d.day) + interval '1 hour' + random() * interval '22 hours'
    from (select day, row_number() over () as n
            from (select g as day from generate_series(1, 23) g order by random() limit 12) r) d
    join (select unit, row_number() over () as n from (values
            ('Obsidian Rose'), ('Obsidian Rose'), ('Obsidian Rose'),
            ('Surge Root'), ('Surge Root'), ('Surge Root'),
            ('Hydrobloom Cannon'), ('Hydrobloom Cannon'), ('Hydrobloom Cannon'),
            ('Splitjaw Flytrap'), ('Splitjaw Flytrap'), ('Splitjaw Flytrap')) v(unit)
          order by random()) u on u.n = d.n;
    insert into public.advent_prizes (kind, day, unit, drop_at)
    values ('draw', 24, 'Infectia', public.adv_day_start(25));
  end if;
end $$;

-- Can p_user win a unit? null = yes, otherwise why not.
create or replace function public.adv_why_not(p_user text)
returns text language plpgsql stable security definer set search_path = '' as $$
declare p record;
begin
  select coalesce(roblox_verified, false) as v, coalesce(level, 1) as lv, registered_at as reg
    into p from public.profiles where discord_id::text = p_user;
  if not found then return 'profile'; end if;
  if not p.v then return 'verify'; end if;
  if p.lv < 3 then return 'level'; end if;
  if p.reg is null or p.reg > public.adv_now() - interval '7 days' then return 'new'; end if;
  return null;
end $$;

-- Give p_user the oldest unit that has dropped and nobody found yet. Returns
-- the unit, or null.
create or replace function public.adv_try_win(p_user text)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare pz record; p record;
begin
  if public.adv_why_not(p_user) is not null then return null; end if;
  if exists (select 1 from public.advent_prizes where kind = 'first' and winner = p_user) then return null; end if;
  select * into pz from public.advent_prizes
   where kind = 'first' and winner is null and drop_at <= public.adv_now()
   order by drop_at limit 1 for update skip locked;
  if not found then return null; end if;
  select discord_name::text as n, roblox_name::text as r into p from public.profiles where discord_id::text = p_user;
  update public.advent_prizes set winner = p_user, winner_name = p.n, roblox_name = p.r, won_at = public.adv_now()
   where id = pz.id;
  return pz.unit;
end $$;

-- Open today's door, or look again for a drop if it's open already (once every
-- 20 seconds). {"opened": true when it's new, "won": unit or null, "why": ...}
create or replace function public.adv_open(p_day integer)
returns json language plpgsql volatile security definer set search_path = '' as $$
declare me text := public.adv_me(); today int := public.adv_today(); fresh boolean := false; last timestamptz; won text; why text;
begin
  if me is null then raise exception 'adv:login'; end if;
  if not exists (select 1 from public.profiles where discord_id::text = me) then raise exception 'adv:profile'; end if;
  if today is null then raise exception 'adv:closed'; end if;
  if p_day is distinct from today then raise exception 'adv:not_today'; end if;
  select checked_at into last from public.advent_opens where discord_id = me and day = p_day for update;
  if not found then
    insert into public.advent_opens (discord_id, day, opened_at, checked_at) values (me, p_day, public.adv_now(), public.adv_now());
    fresh := true;
  else
    if last > public.adv_now() - interval '20 seconds' then raise exception 'adv:slow'; end if;
    update public.advent_opens set checked_at = public.adv_now() where discord_id = me and day = p_day;
  end if;
  why := public.adv_why_not(me);
  if why is null and exists (select 1 from public.advent_prizes where kind = 'first' and winner = me) then why := 'won'; end if;
  if why is null then won := public.adv_try_win(me); end if;
  return json_build_object('opened', fresh, 'won', won, 'why', why);
end $$;

-- Draw the Infectia once door 24 has closed. Anyone may ask; it only draws
-- once, and only after 25 December 00:00 UTC. Weighted by doors opened.
create or replace function public.adv_draw()
returns text language plpgsql volatile security definer set search_path = '' as $$
declare pz record; pick text; p record;
begin
  select * into pz from public.advent_prizes where kind = 'draw' for update;
  if not found then return null; end if;
  if pz.winner is not null then return pz.winner_name; end if;
  if public.adv_now() < pz.drop_at then return null; end if;
  select o.discord_id into pick
    from public.advent_opens o
   where public.adv_why_not(o.discord_id) is null
   group by o.discord_id
   order by -ln(1 - random()) / count(*)
   limit 1;
  if pick is null then return null; end if;
  select discord_name::text as n, roblox_name::text as r into p from public.profiles where discord_id::text = pick;
  update public.advent_prizes set winner = pick, winner_name = p.n, roblox_name = p.r, won_at = public.adv_now() where id = pz.id;
  return p.n;
end $$;

-- Everything the advent page needs. Drop times stay secret.
create or replace function public.adv_status()
returns json language plpgsql stable security definer set search_path = '' as $$
declare me text := public.adv_me(); today int := public.adv_today(); n int := 0; g record;
begin
  if me is not null then select count(*) into n from public.advent_opens where discord_id = me; end if;
  select * into g from public.advent_prizes where kind = 'draw';
  return json_build_object(
    'today', today,
    'now', public.adv_now(),
    'me', me is not null and exists (select 1 from public.profiles where discord_id::text = me),
    'opened', coalesce((select json_agg(json_build_object('day', o.day, 'status', o.status, 'reason', o.reason) order by o.day)
                          from public.advent_opens o where o.discord_id = me), '[]'::json),
    'why', case when me is null then 'login' else coalesce(public.adv_why_not(me),
             case when exists (select 1 from public.advent_prizes where kind = 'first' and winner = me) then 'won' end) end,
    'prizes', coalesce((select json_agg(json_build_object(
                  'day', z.day, 'unit', z.unit,
                  'state', case when z.winner is not null then 'won' when today is not null and z.day <= today then 'hunt'
                                when today is null and public.adv_now() >= public.adv_day_start(25) then 'gone' else 'soon' end,
                  'winner', z.winner_name, 'mine', z.winner = me) order by z.day)
                from public.advent_prizes z where z.kind = 'first'), '[]'::json),
    'grand', case when g.id is null then null else json_build_object(
                  'unit', g.unit, 'draw_at', g.drop_at, 'winner', g.winner_name, 'mine', g.winner = me,
                  'players', (select count(distinct discord_id) from public.advent_opens),
                  'tickets', n) end);
end $$;

-- Advent banners: "xmas" for 12 doors, "xmasgold" for all 24, with the usual
-- "-weld" / "-studs" texture ending. Writes profile_banners like set_my_banner.
create or replace function public.adv_set_banner(b text)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare me text := public.adv_me(); n int; need int;
begin
  if me is null then raise exception 'adv:login'; end if;
  if b is null or b !~ '^xmas(gold)?(-weld|-studs)?$' then raise exception 'adv:banner'; end if;
  need := case when b like 'xmasgold%' then 24 else 12 end;
  select count(*) into n from public.advent_opens where discord_id = me;
  if n < need then raise exception 'adv:locked'; end if;
  execute format('insert into public.profile_banners (discord_id, banner) values (%L, %L) '
                 'on conflict (discord_id) do update set banner = excluded.banner', me, b);
  return b;
end $$;

-- ── Owner tools ──────────────────────────────────────────────────────────
create or replace function public.adv_admin()
returns json language plpgsql stable security definer set search_path = '' as $$
begin
  if not coalesce(public.is_site_owner(), false) then raise exception 'adv:forbidden'; end if;
  return json_build_object(
    'prizes', coalesce((select json_agg(json_build_object('id', z.id, 'kind', z.kind, 'day', z.day, 'unit', z.unit,
                 'drop_at', z.drop_at, 'winner', z.winner, 'winner_name', z.winner_name, 'roblox_name', z.roblox_name,
                 'won_at', z.won_at, 'paid', z.paid, 'notified', z.notified) order by z.day) from public.advent_prizes z), '[]'::json),
    'days', coalesce((select json_agg(json_build_object('day', d.day, 'n', d.n) order by d.day)
                        from (select day, count(*) as n from public.advent_opens group by day) d), '[]'::json),
    'players', (select count(distinct discord_id) from public.advent_opens));
end $$;

-- Mark a prize as traded to the winner (or not).
create or replace function public.adv_admin_paid(p_id bigint, p_paid boolean)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
begin
  if not coalesce(public.is_site_owner(), false) then raise exception 'adv:forbidden'; end if;
  update public.advent_prizes set paid = p_paid where id = p_id and winner is not null;
  return found;
end $$;

-- Take a prize back (cheating, alt account...). A unit goes back into the hunt;
-- the Infectia is drawn again.
create or replace function public.adv_admin_reroll(p_id bigint)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare k text;
begin
  if not coalesce(public.is_site_owner(), false) then raise exception 'adv:forbidden'; end if;
  update public.advent_prizes set winner = null, winner_name = null, roblox_name = null, won_at = null, paid = false, notified = false
   where id = p_id and not paid returning kind into k;
  if k is null then raise exception 'adv:paid'; end if;
  if k = 'draw' then return public.adv_draw(); end if;
  return 'hunt';
end $$;

-- A deleted account's unpaid XP rows go (won prizes stay on record).
create or replace function public.adv_forget()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.advent_opens where discord_id = old.discord_id::text and status <> 'given';
  return old;
end $$;
drop trigger if exists adv_forget on public.profiles;
create trigger adv_forget after delete on public.profiles for each row execute function public.adv_forget();

do $$
declare f text;
begin
  revoke all on function public.adv_status() from public;
  grant execute on function public.adv_status() to anon, authenticated;
  revoke all on function public.adv_draw() from public;
  grant execute on function public.adv_draw() to anon, authenticated;
  foreach f in array array['adv_open(integer)', 'adv_set_banner(text)', 'adv_admin()', 'adv_admin_paid(bigint,boolean)', 'adv_admin_reroll(bigint)']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array['adv_me()', 'adv_why_not(text)', 'adv_try_win(text)', 'adv_forget()']
  loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;
