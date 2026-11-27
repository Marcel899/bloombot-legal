-- Bloombot website: weekly quests (repeatable XP every week).
-- Run in the Supabase SQL editor. Safe to run again. Works on its own; quests
-- about collections, alerts, wishlists, offers or strategy votes count once
-- those features' SQL has been run (until then they just show 0 progress).
--
-- Each week (Monday 00:00 UTC) everyone gets the same 3 quests, picked from the
-- pool below. Progress is counted from what you did on the website that week.
-- Claiming saves a row in weekly_quest_claims; the bot gives the XP (amounts
-- from WEEKLY_QUESTS in bot/leveling.py, once per quest per week) and marks it
-- given, the same way as the one-time XP tasks.

create or replace function public.wq_me()
returns text language sql stable security definer set search_path = '' as $$
  select i.provider_id from auth.identities i
  where i.user_id = auth.uid() and i.provider = 'discord'
  limit 1
$$;

create table if not exists public.weekly_quest_claims (
  id           bigint generated always as identity primary key,
  discord_id   text not null check (discord_id ~ '^[0-9]{15,22}$'),
  week         text not null check (week ~ '^[0-9]{4}-W[0-9]{2}$'),
  quest        text not null,
  xp           integer not null,
  status       text not null default 'pending' check (status in ('pending', 'processing', 'given', 'failed')),
  reason       text,
  created_at   timestamptz not null default now(),
  processed_at timestamptz,
  unique (discord_id, week, quest)
);
create index if not exists weekly_quest_claims_pending_idx on public.weekly_quest_claims (status, id) where status in ('pending', 'processing');
alter table public.weekly_quest_claims enable row level security;
revoke all on public.weekly_quest_claims from anon, authenticated, public;

-- The pool. XP must match WEEKLY_QUESTS in bot/leveling.py.
create or replace function public.wq_pool()
returns table (key text, title text, about text, goal integer, xp integer, go text)
language sql immutable set search_path = '' as $$
  values
    ('offers',     'Make 2 trade offers',            'Press Make an offer on any trade ad.',             2, 150, 'trades.html'),
    ('chats',      'Chat with 3 different traders',  'Send a website message to 3 people.',              3, 150, 'messages.html'),
    ('wishlist',   'Add 3 units to your wishlist',   'Star units on the values page.',                   3,  75, 'values.html'),
    ('collection', 'Add 3 units to your collection', 'Track what you own on My collection.',             3,  75, 'collection.html'),
    ('alert',      'Set a price alert',              'Press Alert me on any unit.',                      1,  50, 'alerts.html'),
    ('upvotes',    'Upvote 3 strategies',            'Help the best guides rise to the top.',            3,  75, 'strategies.html'),
    ('unit_trade', 'Make an offer with 3+ units',    'One offer with at least 3 units on either side.',  1, 100, 'trades.html')
$$;

-- This week: its key ("2026-W48") and when it started / ends (UTC).
create or replace function public.wq_week(at timestamptz default now())
returns table (week text, starts timestamptz, ends timestamptz)
language sql stable set search_path = '' as $$
  select to_char(at at time zone 'utc', 'IYYY-"W"IW'),
         date_trunc('week', at at time zone 'utc') at time zone 'utc',
         (date_trunc('week', at at time zone 'utc') + interval '7 days') at time zone 'utc'
$$;

-- This week's 3 quests: the same for everyone, different most weeks.
create or replace function public.wq_this_week()
returns setof text language sql stable set search_path = '' as $$
  select p.key from public.wq_pool() p, public.wq_week() w
  order by md5(w.week || ':' || p.key) limit 3
$$;

-- How far someone is with one quest since p_since. Tables from other features
-- may not exist yet: then it's 0.
create or replace function public.wq_progress(p_user text, p_key text, p_since timestamptz)
returns integer language plpgsql stable security definer set search_path = '' as $$
declare n integer := 0;
begin
  if p_key in ('offers', 'chats', 'unit_trade') and to_regclass('public.dm_messages') is not null then
    if p_key = 'chats' then
      execute 'select count(distinct recipient) from public.dm_messages where sender = $1 and created_at >= $2 and not unsent'
        into n using p_user, p_since;
    elsif exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'dm_messages' and column_name = 'offer') then
      if p_key = 'offers' then
        execute 'select count(*) from public.dm_messages where sender = $1 and created_at >= $2 and offer is not null'
          into n using p_user, p_since;
      else
        execute $q$select count(*) from public.dm_messages where sender = $1 and created_at >= $2 and offer is not null
                   and (jsonb_array_length(offer->'give') + jsonb_array_length(offer->'get') >= 3
                        or exists (select 1 from jsonb_array_elements(offer->'give') g where (g->>'qty')::int >= 3)
                        or exists (select 1 from jsonb_array_elements(offer->'get') g where (g->>'qty')::int >= 3))$q$
          into n using p_user, p_since;
      end if;
    end if;
  elsif p_key = 'wishlist' and to_regclass('public.wishlist_changes') is not null then
    execute 'select count(distinct name) from public.wishlist_changes where discord_id = $1 and created_at >= $2 and action = ''add'''
      into n using p_user, p_since;
  elsif p_key = 'collection' and to_regclass('public.collection_items') is not null then
    execute 'select count(*) from public.collection_items where discord_id = $1 and added_at >= $2'
      into n using p_user, p_since;
  elsif p_key = 'alert' and to_regclass('public.value_alerts') is not null then
    execute 'select count(*) from public.value_alerts where discord_id = $1 and created_at >= $2'
      into n using p_user, p_since;
  elsif p_key = 'upvotes' and to_regclass('public.strategy_votes') is not null then
    execute 'select count(*) from public.strategy_votes where discord_id = $1 and created_at >= $2'
      into n using p_user, p_since;
  end if;
  return coalesce(n, 0);
end $$;

-- Everything the levels page needs.
create or replace function public.wq_status()
returns json language plpgsql stable security definer set search_path = '' as $$
declare me text := public.wq_me(); w record;
begin
  select * into w from public.wq_week();
  return json_build_object(
    'week', w.week, 'ends_at', w.ends,
    'quests', (select json_agg(json_build_object(
        'key', p.key, 'title', p.title, 'about', p.about, 'goal', p.goal, 'xp', p.xp, 'go', p.go,
        'progress', case when me is null then 0 else least(p.goal, public.wq_progress(me, p.key, w.starts)) end,
        'status', (select c.status from public.weekly_quest_claims c where c.discord_id = me and c.week = w.week and c.quest = p.key),
        'reason', (select c.reason from public.weekly_quest_claims c where c.discord_id = me and c.week = w.week and c.quest = p.key))
      order by p.xp desc)
      from public.wq_pool() p where p.key in (select public.wq_this_week())));
end $$;

-- Claim a finished quest. Returns 'ok', or 'done' if it was claimed before.
create or replace function public.claim_weekly_quest(p_key text)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare me text := public.wq_me(); w record; q record;
begin
  if me is null then raise exception 'wq:login'; end if;
  if not exists (select 1 from public.profiles where discord_id::text = me) then raise exception 'wq:profile'; end if;
  select * into w from public.wq_week();
  if p_key is null or p_key not in (select public.wq_this_week()) then raise exception 'wq:not_this_week'; end if;
  select * into q from public.wq_pool() p where p.key = p_key;
  if exists (select 1 from public.weekly_quest_claims where discord_id = me and week = w.week and quest = p_key) then
    return 'done';
  end if;
  if public.wq_progress(me, p_key, w.starts) < q.goal then raise exception 'wq:not_done'; end if;
  insert into public.weekly_quest_claims (discord_id, week, quest, xp) values (me, w.week, p_key, q.xp)
  on conflict (discord_id, week, quest) do nothing;
  return 'ok';
end $$;

create or replace function public.wq_forget()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.weekly_quest_claims where discord_id = old.discord_id::text and status <> 'given';
  return old;
end $$;
drop trigger if exists wq_forget on public.profiles;
create trigger wq_forget after delete on public.profiles for each row execute function public.wq_forget();

do $$
declare f text;
begin
  foreach f in array array['wq_status()', 'claim_weekly_quest(text)']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  execute 'grant execute on function public.wq_status() to anon';   -- logged out: see this week's quests
  foreach f in array array['wq_me()', 'wq_progress(text,text,timestamptz)', 'wq_forget()']
  loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;
