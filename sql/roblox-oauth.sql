-- Roblox OAuth verification (run once in the Supabase SQL editor).
-- Adds roblox_verifications.method: 'code' (About-text code, the old way) or 'oauth'
-- (Log in with Roblox). Only the roblox-oauth edge function (service role) can write
-- 'oauth' rows: signed-in users still only have SELECT on this table.

alter table public.roblox_verifications
  add column if not exists method text not null default 'code';

alter table public.roblox_verifications
  drop constraint if exists roblox_verifications_method_check;
alter table public.roblox_verifications
  add constraint roblox_verifications_method_check check (method in ('code', 'oauth'));

-- "Check again" is only for About codes; an OAuth try is redone by logging in with Roblox again.
create or replace function public.roblox_verify_check(vid bigint)
 returns text
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare did text := public.my_discord_id(); r record;
begin
  if did is null then return 'Log in first.'; end if;
  select * into r from public.roblox_verifications where id = vid and discord_id = did;
  if not found then return 'That code has gone. Get a new one.'; end if;
  if r.status in ('pending', 'processing') then return 'ok'; end if;
  if r.status = 'verified' then return 'verified'; end if;
  if r.method <> 'code' then return 'Connect with Roblox again.'; end if;
  if r.created_at < now() - interval '1 hour' then return 'That code ran out. Get a new one.'; end if;
  if r.checks >= 15 then return 'Too many checks for this code. Get a new one.'; end if;
  update public.roblox_verifications
    set status = 'pending', reason = null, checks = checks + 1
    where id = vid;
  return 'ok';
end $function$;
