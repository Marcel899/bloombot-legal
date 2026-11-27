-- Bloombot website: strategy upvotes.
-- Run in the Supabase SQL editor. Safe to run again.
--
-- One upvote per trader per strategy; you can't upvote your own. Everyone can
-- see the counts; voting needs a Bloombot account. RLS on, no policies, no
-- table grants: st_votes / st_vote take the voter from their Discord login.
-- (Map tags need no table: they come from the "Map:" line authors already
-- fill in when they share a strategy.)

create or replace function public.st_me()
returns text language sql stable security definer set search_path = '' as $$
  select i.provider_id from auth.identities i
  where i.user_id = auth.uid() and i.provider = 'discord'
  limit 1
$$;

create table if not exists public.strategy_votes (
  strategy_id bigint not null,
  discord_id  text not null check (discord_id ~ '^[0-9]{15,22}$'),
  created_at  timestamptz not null default now(),
  primary key (strategy_id, discord_id)
);
create index if not exists strategy_votes_voter_idx on public.strategy_votes (discord_id, created_at desc);
alter table public.strategy_votes enable row level security;
revoke all on public.strategy_votes from anon, authenticated, public;

-- {"counts": {"<strategy id>": n, ...}, "mine": [ids you upvoted]}
create or replace function public.st_votes()
returns json language plpgsql stable security definer set search_path = '' as $$
declare me text := public.st_me();
begin
  return json_build_object(
    'counts', coalesce((select json_object_agg(v.strategy_id, v.n) from
                         (select strategy_id, count(*) as n from public.strategy_votes group by strategy_id) v), '{}'::json),
    'mine', coalesce((select json_agg(strategy_id) from public.strategy_votes where discord_id = me), '[]'::json));
end $$;

-- Upvote (p_on) or take it back. Returns the strategy's new count.
create or replace function public.st_vote(p_id bigint, p_on boolean)
returns integer language plpgsql volatile security definer set search_path = '' as $$
declare me text := public.st_me(); author text;
begin
  if me is null then raise exception 'st:login'; end if;
  if not exists (select 1 from public.profiles where discord_id::text = me) then raise exception 'st:profile'; end if;
  select s.author_id::text into author from public.strategies s where s.id = p_id;
  if not found then raise exception 'st:not_found'; end if;
  if author = me then raise exception 'st:own'; end if;
  if p_on then
    if (select count(*) from public.strategy_votes where discord_id = me and created_at > now() - interval '1 hour') >= 60 then
      raise exception 'st:slow';
    end if;
    insert into public.strategy_votes (strategy_id, discord_id) values (p_id, me) on conflict do nothing;
  else
    delete from public.strategy_votes where strategy_id = p_id and discord_id = me;
  end if;
  return (select count(*)::int from public.strategy_votes where strategy_id = p_id);
end $$;

-- Votes go when the strategy goes (the bot removes deleted strategies here).
create or replace function public.st_forget_strategy()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.strategy_votes where strategy_id = old.id;
  return old;
end $$;
drop trigger if exists st_forget_strategy on public.strategies;
create trigger st_forget_strategy after delete on public.strategies for each row execute function public.st_forget_strategy();

-- ... and a deleted account's votes go too.
create or replace function public.st_forget_voter()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.strategy_votes where discord_id = old.discord_id::text;
  return old;
end $$;
drop trigger if exists st_forget_voter on public.profiles;
create trigger st_forget_voter after delete on public.profiles for each row execute function public.st_forget_voter();

do $$
declare f text;
begin
  revoke all on function public.st_votes() from public;
  grant execute on function public.st_votes() to anon, authenticated;
  revoke all on function public.st_vote(bigint, boolean) from public, anon;
  grant execute on function public.st_vote(bigint, boolean) to authenticated;
  foreach f in array array['st_me()', 'st_forget_strategy()', 'st_forget_voter()']
  loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;
