-- Bloombot website: trade offers in messages ("Make an offer").
-- Run in the Supabase SQL editor AFTER dm-messages.sql. Safe to run again.
--
-- An offer is a normal message (so every chat rule still applies: blocks,
-- "new chats", verified-only, rate limits, the filters) with a structured
-- `offer` attached: what the sender gives, what they want, and a status the
-- recipient can change (accept / decline) or answer with a counter offer.
--
-- offer = { "give": [{"name","qty"}], "get": [{"name","qty"}],
--           "status": "open" | "accepted" | "declined" | "countered" | "withdrawn",
--           "reply_to": <message id or null>, "ad": <trade ad id or null> }

alter table public.dm_messages add column if not exists offer jsonb;
create index if not exists dm_offer_idx on public.dm_messages ((offer->>'status')) where offer is not null;

-- One side of an offer, checked and tidied: names on the value list, 1–999 each,
-- 1–15 different units. Raises dm:bad_offer otherwise.
create or replace function public.dm_offer_side(p jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare out jsonb := '[]'::jsonb; e jsonb; n text; q integer; seen text[] := '{}';
begin
  if p is null or jsonb_typeof(p) <> 'array' or jsonb_array_length(p) = 0 or jsonb_array_length(p) > 15 then
    raise exception 'dm:bad_offer';
  end if;
  for e in select * from jsonb_array_elements(p) loop
    n := e->>'name';
    q := coalesce((e->>'qty')::integer, 1);
    if n is null or q < 1 or q > 999 or n = any(seen)
       or not exists (select 1 from public.item_values v where v.name = n) then
      raise exception 'dm:bad_offer';
    end if;
    seen := seen || n;
    out := out || jsonb_build_array(jsonb_build_object('name', n, 'qty', q));
  end loop;
  return out;
end $$;

-- "2x Grim Gardener + Witchleaf"
create or replace function public.dm_offer_text(p jsonb)
returns text language sql immutable set search_path = '' as $$
  select string_agg(case when (e->>'qty')::int > 1 then (e->>'qty') || 'x ' else '' end || (e->>'name'), ' + ')
  from jsonb_array_elements(p) e
$$;

-- Send an offer (or a counter offer to p_reply_to). Returns what dm_send returns,
-- plus the offer.
create or replace function public.dm_offer_send(p_to text, p_give jsonb, p_get jsonb,
                                                p_reply_to bigint default null, p_ad bigint default null)
returns json language plpgsql volatile security definer set search_path = '' as $$
declare
  me text := public.dm_require();
  give jsonb := public.dm_offer_side(p_give);
  want jsonb := public.dm_offer_side(p_get);
  r json;
  o jsonb;
begin
  if p_reply_to is not null and not exists (
       select 1 from public.dm_messages m
       where m.id = p_reply_to and m.sender = p_to and m.recipient = me and not m.unsent
         and m.offer is not null and m.offer->>'status' = 'open') then
    raise exception 'dm:offer_gone';
  end if;
  r := public.dm_send(p_to, 'Offer: ' || public.dm_offer_text(give) || ' for ' || public.dm_offer_text(want));
  if r::jsonb ? 'error' then return r; end if;
  o := jsonb_build_object('give', give, 'get', want, 'status', 'open', 'reply_to', p_reply_to, 'ad', p_ad);
  update public.dm_messages set offer = o where id = (r->>'id')::bigint and sender = me;
  if p_reply_to is not null then
    update public.dm_messages set offer = jsonb_set(offer, '{status}', '"countered"') where id = p_reply_to;
  end if;
  return (r::jsonb || jsonb_build_object('offer', o))::json;
end $$;

-- accept / decline (the person it was sent to), withdraw (the sender). Only while open.
create or replace function public.dm_offer_respond(p_id bigint, p_action text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare me text := public.dm_require(); m public.dm_messages; st text;
begin
  select * into m from public.dm_messages where id = p_id and not unsent and offer is not null for update;
  if not found then raise exception 'dm:not_found'; end if;
  st := case
          when p_action = 'accept' and m.recipient = me then 'accepted'
          when p_action = 'decline' and m.recipient = me then 'declined'
          when p_action = 'withdraw' and m.sender = me then 'withdrawn'
        end;
  if st is null then raise exception 'dm:bad_action'; end if;
  if m.offer->>'status' <> 'open' then raise exception 'dm:offer_gone'; end if;
  if m.recipient = me and exists (select 1 from public.dm_blocks where blocker = m.sender and blocked = me) then
    raise exception 'dm:closed';
  end if;
  update public.dm_messages set offer = jsonb_set(offer, '{status}', to_jsonb(st)) where id = p_id;
  return jsonb_set(m.offer, '{status}', to_jsonb(st));
end $$;

-- Threads and live updates now carry the offer (hidden once a message is unsent).
drop function if exists public.dm_thread(text, bigint, integer);
create or replace function public.dm_thread(p_other text, p_before bigint default null, p_limit integer default 50)
returns table (id bigint, from_me boolean, body text, image_path text, created_at timestamptz, read_at timestamptz, unsent boolean, offer jsonb)
language plpgsql stable security definer set search_path = '' as $$
declare me text := public.dm_require();
begin
  if p_other is null or p_other !~ '^[0-9]{15,22}$' then raise exception 'dm:bad_user'; end if;
  return query
  select m.id, m.sender = me,
         case when m.unsent then '' else m.body end,
         case when m.unsent then null else m.image_path end,
         m.created_at, m.read_at, m.unsent,
         case when m.unsent then null else m.offer end
  from public.dm_messages m
  where least(m.sender, m.recipient) = least(me, p_other) and greatest(m.sender, m.recipient) = greatest(me, p_other)
    and ((m.sender = me and not m.hidden_sender) or (m.recipient = me and not m.hidden_recipient))
    and (p_before is null or m.id < p_before)
  order by m.id desc
  limit greatest(1, least(coalesce(p_limit, 50), 100));
end $$;

create or replace function public.dm_poll(p_other text, p_after bigint)
returns json language plpgsql stable security definer set search_path = '' as $$
declare me text := public.dm_require();
begin
  if p_other is null or p_other !~ '^[0-9]{15,22}$' then raise exception 'dm:bad_user'; end if;
  return json_build_object(
    'msgs', coalesce((select json_agg(t order by t.id) from (
               select m.id, m.sender = me as from_me,
                      case when m.unsent then '' else m.body end as body,
                      case when m.unsent then null else m.image_path end as image_path,
                      m.created_at, m.read_at, m.unsent,
                      case when m.unsent then null else m.offer end as offer
               from public.dm_messages m
               where least(m.sender, m.recipient) = least(me, p_other) and greatest(m.sender, m.recipient) = greatest(me, p_other)
                 and ((m.sender = me and not m.hidden_sender) or (m.recipient = me and not m.hidden_recipient))
                 and m.id > coalesce(p_after, 0)
               order by m.id
               limit 100) t), '[]'::json),
    'read_upto', (select max(m.id) from public.dm_messages m where m.sender = me and m.recipient = p_other and m.read_at is not null),
    'unsent', coalesce((select json_agg(m.id) from public.dm_messages m
                        where least(m.sender, m.recipient) = least(me, p_other) and greatest(m.sender, m.recipient) = greatest(me, p_other)
                          and m.unsent and m.id <= coalesce(p_after, 0)), '[]'::json),
    -- current status of every offer already on screen, so accept / decline shows up live
    'offers', coalesce((select json_object_agg(m.id, m.offer->>'status') from public.dm_messages m
                        where least(m.sender, m.recipient) = least(me, p_other) and greatest(m.sender, m.recipient) = greatest(me, p_other)
                          and m.offer is not null and not m.unsent and m.id <= coalesce(p_after, 0)), '{}'::json));
end $$;

-- Nudge both people when an offer's status changes too.
drop trigger if exists dm_nudge_update on public.dm_messages;
create trigger dm_nudge_update after update on public.dm_messages
  for each row when (old.read_at is distinct from new.read_at or old.unsent is distinct from new.unsent
                     or old.offer is distinct from new.offer)
  execute function public.dm_nudge();

do $$
declare f text;
begin
  foreach f in array array['dm_offer_send(text,jsonb,jsonb,bigint,bigint)', 'dm_offer_respond(bigint,text)',
                           'dm_thread(text,bigint,integer)', 'dm_poll(text,bigint)']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array['dm_offer_side(jsonb)', 'dm_offer_text(jsonb)']
  loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;
