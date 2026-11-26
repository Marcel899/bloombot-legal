-- Bloombot website: price alerts ("tell me when Grim Gardener goes above 60k").
-- Run in the Supabase SQL editor. Safe to run again.
--
-- The website saves alerts here; the bot delivers them (Discord DM or email)
-- by calling alert_queue() with the service key, then alert_sent() for each
-- one it delivered. Same pattern as the message email alerts.
--
-- Security: RLS on, no policies, no table grants. Traders manage only their
-- own alerts through the alert_* functions, which take the caller from their
-- Discord login. Email addresses only ever reach the service key.

create or replace function public.alert_me()
returns text language sql stable security definer set search_path = '' as $$
  select i.provider_id from auth.identities i
  where i.user_id = auth.uid() and i.provider = 'discord'
  limit 1
$$;

create table if not exists public.value_alerts (
  id          bigint generated always as identity primary key,
  discord_id  text not null check (discord_id ~ '^[0-9]{15,22}$'),
  item        text not null check (char_length(item) between 1 and 80),
  kind        text not null check (kind in ('above', 'below', 'change')),
  target      numeric check (target is null or (target > 0 and target < 1e12)),
  via         text not null default 'dm' check (via in ('dm', 'email')),
  last_value  numeric,                    -- value when set or last delivered
  created_at  timestamptz not null default now(),
  fired_at    timestamptz,
  constraint value_alerts_target check ((kind = 'change') = (target is null)),
  unique (discord_id, item, kind)
);
create index if not exists value_alerts_item_idx on public.value_alerts (item);
alter table public.value_alerts enable row level security;
revoke all on public.value_alerts from anon, authenticated, public;

-- A unit's value as a number: the listed value, or the number in its text
-- ("55.85k+", "O/C 300k"). Same rule as the website's estimate.
create or replace function public.alert_value_of(p_item text)
returns numeric language sql stable security definer set search_path = '' as $$
  select case
    when v.value > 0 then v.value
    else (select (m[1])::numeric * case lower(m[2]) when 'k' then 1e3 when 'm' then 1e6 else 1 end
          from regexp_match(replace(coalesce(v.value_text, ''), ',', ''), '(\d+(?:\.\d+)?)\s*([kKmM]?)') m)
  end
  from public.item_values v where v.name = p_item
$$;

create or replace function public.alert_require()
returns text language plpgsql stable security definer set search_path = '' as $$
declare me text := public.alert_me();
begin
  if me is null then raise exception 'alert:login'; end if;
  if not exists (select 1 from public.profiles where discord_id::text = me) then raise exception 'alert:profile'; end if;
  return me;
end $$;

-- Email of a Discord user's website login, or null.
create or replace function public.alert_email_of(p_user text)
returns text language sql stable security definer set search_path = '' as $$
  select u.email::text from auth.identities i join auth.users u on u.id = i.user_id
  where i.provider = 'discord' and i.provider_id = p_user
    and u.email is not null and u.email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  order by u.created_at limit 1
$$;

-- My alerts, with each unit's value right now.
create or replace function public.alert_list()
returns json language plpgsql stable security definer set search_path = '' as $$
declare me text := public.alert_require();
begin
  return json_build_object(
    'has_email', public.alert_email_of(me) is not null,
    'alerts', coalesce((select json_agg(json_build_object(
        'id', a.id, 'item', a.item, 'kind', a.kind, 'target', a.target, 'via', a.via,
        'now', public.alert_value_of(a.item), 'created_at', a.created_at, 'fired_at', a.fired_at) order by a.created_at desc)
      from public.value_alerts a where a.discord_id = me), '[]'::json));
end $$;

-- Add or change an alert. One per unit and kind; 25 at most.
create or replace function public.alert_set(p_item text, p_kind text, p_target numeric default null, p_via text default 'dm')
returns bigint language plpgsql volatile security definer set search_path = '' as $$
declare
  me text := public.alert_require();
  t numeric := case when p_kind = 'change' then null else round(p_target, 2) end;
  v text := coalesce(nullif(p_via, ''), 'dm');
  now_v numeric;
  rid bigint;
begin
  if p_kind not in ('above', 'below', 'change') then raise exception 'alert:bad_kind'; end if;
  if not exists (select 1 from public.item_values where name = p_item) then raise exception 'alert:bad_item'; end if;
  if p_kind <> 'change' and (t is null or t <= 0 or t >= 1e12) then raise exception 'alert:bad_target'; end if;
  if v not in ('dm', 'email') then raise exception 'alert:bad_via'; end if;
  if v = 'email' and public.alert_email_of(me) is null then raise exception 'alert:no_email'; end if;
  if not exists (select 1 from public.value_alerts where discord_id = me and item = p_item and kind = p_kind)
     and (select count(*) from public.value_alerts where discord_id = me) >= 25 then raise exception 'alert:full'; end if;
  now_v := public.alert_value_of(p_item);
  insert into public.value_alerts (discord_id, item, kind, target, via, last_value)
  values (me, p_item, p_kind, t, v, now_v)
  on conflict (discord_id, item, kind) do update
    set target = excluded.target, via = excluded.via, last_value = excluded.last_value, fired_at = null
  returning id into rid;
  return rid;
end $$;

create or replace function public.alert_delete(p_id bigint)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare me text := public.alert_require();
begin
  delete from public.value_alerts where id = p_id and discord_id = me;
  return found;
end $$;

-- ── For the bot (service key only) ───────────────────────────────────
-- Alerts that should go out now:
--   above:  the value crossed up through the target since the last delivery
--   below:  the value crossed down through the target
--   change: the value is different from the last delivery
-- An above/below alert fires once per crossing, then re-arms when the value
-- goes back to the other side. At most one alert per person every 10 minutes
-- per unit, and 20 a day per person.
create or replace function public.alert_queue(p_limit integer default 100)
returns table (id bigint, discord_id text, email text, item text, kind text, target numeric,
               old_value numeric, new_value numeric, via text)
language sql stable security definer set search_path = '' as $$
  with cur as (
    select a.*, public.alert_value_of(a.item) as now_v from public.value_alerts a
  )
  select c.id, c.discord_id, case when c.via = 'email' then public.alert_email_of(c.discord_id) end,
         c.item, c.kind, c.target, c.last_value, c.now_v, c.via
  from cur c
  where c.now_v is not null and c.now_v > 0
    and case c.kind
          when 'above' then c.now_v >= c.target and coalesce(c.last_value, 0) < c.target
          when 'below' then c.now_v <= c.target and coalesce(c.last_value, 1e12) > c.target
          else c.last_value is not null and c.now_v <> c.last_value
        end
    and (c.fired_at is null or c.fired_at < now() - interval '10 minutes')
    and (select count(*) from public.value_alerts x where x.discord_id = c.discord_id and x.fired_at > now() - interval '1 day') < 20
    and (c.via = 'dm' or public.alert_email_of(c.discord_id) is not null)
  order by c.id
  limit greatest(1, least(coalesce(p_limit, 100), 500))
$$;

-- Call after delivering one: remembers the value it was sent at.
create or replace function public.alert_sent(p_id bigint, p_value numeric)
returns void language sql volatile security definer set search_path = '' as $$
  update public.value_alerts set last_value = p_value, fired_at = now() where id = p_id;
$$;

-- Value moved but nothing to send (e.g. an "above" alert while it's still below):
-- keep last_value current so crossings are measured from the latest value.
create or replace function public.alert_track()
returns integer language plpgsql volatile security definer set search_path = '' as $$
declare n integer;
begin
  update public.value_alerts a set last_value = v.now_v
  from (select x.id, public.alert_value_of(x.item) as now_v from public.value_alerts x) v
  where a.id = v.id and v.now_v is not null and v.now_v > 0 and a.last_value is distinct from v.now_v
    and a.id not in (select q.id from public.alert_queue(500) q);
  get diagnostics n = row_count;
  return n;
end $$;

-- Deleting a Bloombot account removes its alerts too.
create or replace function public.alert_forget()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.value_alerts where discord_id = old.discord_id::text;
  return old;
end $$;
drop trigger if exists alert_forget on public.profiles;
create trigger alert_forget after delete on public.profiles for each row execute function public.alert_forget();

do $$
declare f text;
begin
  foreach f in array array['alert_me()', 'alert_require()', 'alert_value_of(text)', 'alert_list()',
                           'alert_set(text,text,numeric,text)', 'alert_delete(bigint)']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array['alert_email_of(text)', 'alert_queue(integer)', 'alert_sent(bigint,numeric)', 'alert_track()', 'alert_forget()']
  loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
