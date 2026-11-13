-- Bloombot website: direct messages between traders.
-- Run in the Supabase SQL editor, then run dm-filter.sql. Both are safe to run again.
--
-- Security model
--  * The tables have RLS on and NO policies, and anon/authenticated have no
--    table grants: nobody can read or write them through the REST API.
--  * Everything goes through SECURITY DEFINER functions that work out who
--    the caller is from their Discord login (auth.identities), never from
--    an argument the browser sends.
--  * Images live in a private bucket. You can upload only into your own
--    folder, and read only images from conversations you are part of.

-- ── Who is calling ────────────────────────────────────────────────────
create or replace function public.dm_me()
returns text language sql stable security definer set search_path = '' as $$
  select i.provider_id
  from auth.identities i
  where i.user_id = auth.uid() and i.provider = 'discord'
  limit 1
$$;

-- ── Tables ────────────────────────────────────────────────────────────
create table if not exists public.dm_messages (
  id            bigint generated always as identity primary key,
  sender        text not null check (sender ~ '^[0-9]{15,22}$'),
  recipient     text not null check (recipient ~ '^[0-9]{15,22}$'),
  body          text not null default '' check (char_length(body) <= 2000),
  image_path    text check (image_path is null or image_path ~ '^[0-9]{15,22}/[0-9a-f-]{36}\.(webp|jpg)$'),
  created_at    timestamptz not null default now(),
  read_at       timestamptz,
  unsent        boolean not null default false,
  hidden_sender    boolean not null default false,
  hidden_recipient boolean not null default false,
  constraint dm_not_self check (sender <> recipient),
  constraint dm_has_content check (unsent or char_length(body) > 0 or image_path is not null)
);
create index if not exists dm_pair_idx on public.dm_messages (least(sender, recipient), greatest(sender, recipient), id desc);
create index if not exists dm_unread_idx on public.dm_messages (recipient) where read_at is null;
create index if not exists dm_sender_time_idx on public.dm_messages (sender, created_at desc);
create unique index if not exists dm_image_once on public.dm_messages (image_path) where image_path is not null;

create table if not exists public.dm_blocks (
  blocker    text not null,
  blocked    text not null,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked)
);

create table if not exists public.dm_settings (
  discord_id text primary key,
  allow_new  boolean not null default true,   -- false: only people you already talk to
  updated_at timestamptz not null default now()
);

create table if not exists public.dm_reports (
  id          bigint generated always as identity primary key,
  reporter    text not null,
  message_id  bigint not null references public.dm_messages(id) on delete cascade,
  reason      text not null check (char_length(reason) between 1 and 300),
  created_at  timestamptz not null default now(),
  -- a copy, so a report still shows what was said after an unsend
  sender      text not null,
  body        text not null,
  image_path  text,
  unique (reporter, message_id)
);

-- Messages the filter stopped (bad words or links), for the owner to review.
create table if not exists public.dm_filtered (
  id         bigint generated always as identity primary key,
  sender     text not null,
  recipient  text not null,
  reason     text not null,
  body       text not null,
  created_at timestamptz not null default now()
);
create index if not exists dm_filtered_sender_idx on public.dm_filtered (sender, created_at desc);

create table if not exists public.dm_bans (
  discord_id text primary key,
  reason     text,
  created_at timestamptz not null default now()
);

alter table public.dm_messages enable row level security;
alter table public.dm_blocks   enable row level security;
alter table public.dm_settings enable row level security;
alter table public.dm_reports  enable row level security;
alter table public.dm_bans     enable row level security;
alter table public.dm_filtered enable row level security;
revoke all on public.dm_messages, public.dm_blocks, public.dm_settings, public.dm_reports, public.dm_bans, public.dm_filtered from anon, authenticated, public;

-- ── Helpers ───────────────────────────────────────────────────────────
-- The caller's Discord ID, after checking they may use messages at all.
create or replace function public.dm_require()
returns text language plpgsql stable security definer set search_path = '' as $$
declare me text := public.dm_me();
begin
  if me is null then raise exception 'dm:login'; end if;
  if exists (select 1 from public.dm_bans where discord_id = me) then raise exception 'dm:banned'; end if;
  if not exists (select 1 from public.profiles where discord_id::text = me) then raise exception 'dm:profile'; end if;
  return me;
end $$;

-- Strip invisible / control / direction-override characters and tidy whitespace.
create or replace function public.dm_clean(t text)
returns text language sql immutable set search_path = '' as $$
  select btrim(regexp_replace(
           regexp_replace(
             regexp_replace(coalesce(t, ''), '\r\n?', E'\n', 'g'),
             '[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]', '', 'g'),
           '\n{4,}', E'\n\n\n', 'g'), E' \t\n')
$$;

-- Links are blocked, except Bloombot's own website and support server.
-- Catches the usual tricks too: "site . com", "site(dot)com", "www site".
create or replace function public.dm_has_link(t text)
returns boolean language plpgsql immutable set search_path = '' as $$
declare s text := lower(coalesce(t, ''));
begin
  s := regexp_replace(s, '(https?://)?(www\.)?bloombot-gtd\.vercel\.app(/[^[:space:]]*)?', ' ', 'g');
  s := regexp_replace(s, '(https?://)?(www\.)?discord(app)?\.(gg|com/invite)/tguxfcjxwf\M', ' ', 'g');
  return s ~ '[a-z][a-z0-9+.-]*://'
      or s ~ '\mwww[[:space:]]*\.[[:space:]]*[a-z0-9]'
      or s ~ '[a-z0-9-]\.(com|net|org|gg|io|xyz|ru|ly|tk|ml|ga|cf|gq|info|biz|cc|gl|eu|ws|su|vip|tv|uk|de|fr|ca|au|nl|pl|online|shop|store|site|app|dev|link|gift|gifts|click|top|club|live|codes|sh|gd|nu)\M'
      or s ~ '[a-z0-9-][[:space:]]*(\(dot\)|\[dot\]|[[:space:]]dot[[:space:]])[[:space:]]*(com|net|org|gg|xyz|ru|io)\M'
      or s ~ '[a-z0-9-][[:space:]]+\.[[:space:]]*(com|net|org|gg|xyz|ru)\M'
      or s ~ '\m(discord|dsc)[[:space:]]*\.[[:space:]]*gg\M';
end $$;

-- Used by the storage policies below.
create or replace function public.dm_upload_ok()
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare me text := public.dm_me();
begin
  if me is null or exists (select 1 from public.dm_bans where discord_id = me) then return false; end if;
  if not exists (select 1 from public.profiles where discord_id::text = me) then return false; end if;
  -- at most 30 uploads an hour
  return (select count(*) from storage.objects o
          where o.bucket_id = 'dm-images' and o.name like me || '/%'
            and o.created_at > now() - interval '1 hour') < 30;
end $$;

create or replace function public.dm_can_see_image(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_name like public.dm_me() || '/%'
      or exists (select 1 from public.dm_messages m
                 where m.image_path = p_name and not m.unsent
                   and (m.sender = public.dm_me() or m.recipient = public.dm_me()))
$$;

-- ── Sending ───────────────────────────────────────────────────────────
create or replace function public.dm_send(p_to text, p_body text, p_image text default null)
returns json language plpgsql volatile security definer set search_path = '' as $$
declare
  me text := public.dm_require();
  b text := public.dm_clean(p_body);
  img text := nullif(btrim(coalesce(p_image, '')), '');
  talked boolean;
  they_replied boolean;
  why text;
  r public.dm_messages;
begin
  if p_to is null or p_to !~ '^[0-9]{15,22}$' then raise exception 'dm:bad_user'; end if;
  if p_to = me then raise exception 'dm:self'; end if;
  if char_length(b) > 2000 then raise exception 'dm:too_long'; end if;
  if char_length(b) = 0 and img is null then raise exception 'dm:empty'; end if;
  if img is not null then
    if img !~ ('^' || me || '/[0-9a-f-]{36}\.(webp|jpg)$') then raise exception 'dm:bad_image'; end if;
    if not exists (select 1 from storage.objects where bucket_id = 'dm-images' and name = img) then raise exception 'dm:bad_image'; end if;
    if exists (select 1 from public.dm_messages where image_path = img) then raise exception 'dm:bad_image'; end if;
  end if;
  if not exists (select 1 from public.profiles where discord_id::text = p_to) then raise exception 'dm:no_user'; end if;
  if exists (select 1 from public.dm_bans where discord_id = p_to) then raise exception 'dm:no_user'; end if;
  if exists (select 1 from public.dm_blocks where blocker = me and blocked = p_to) then raise exception 'dm:you_blocked'; end if;
  if exists (select 1 from public.dm_blocks where blocker = p_to and blocked = me) then raise exception 'dm:closed'; end if;

  -- One sender at a time, so the limits below can't be raced.
  perform pg_advisory_xact_lock(hashtext('dm:' || me));

  if (select count(*) from public.dm_messages where sender = me and created_at > now() - interval '10 seconds') >= 5
     or (select count(*) from public.dm_messages where sender = me and created_at > now() - interval '1 hour') >= 200
     or (select count(*) from public.dm_filtered where sender = me and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'dm:slow';
  end if;

  -- Content rules. Logged rather than raised, so the owner can see what was tried.
  if char_length(b) > 0 then
    why := case when public.dm_has_link(b) then 'link' when public.dm_bad_text(b) then 'bad_word' end;
    if why is not null then
      insert into public.dm_filtered (sender, recipient, reason, body) values (me, p_to, why, b);
      return json_build_object('error', why);
    end if;
  end if;

  select exists (select 1 from public.dm_messages where sender = p_to and recipient = me) into they_replied;
  select they_replied or exists (select 1 from public.dm_messages where sender = me and recipient = p_to) into talked;

  if not they_replied then
    if not coalesce((select allow_new from public.dm_settings where discord_id = p_to), true) then raise exception 'dm:closed'; end if;
    -- Until they answer, you can send 3 messages.
    if (select count(*) from public.dm_messages where sender = me and recipient = p_to and not unsent) >= 3 then raise exception 'dm:wait_reply'; end if;
    -- No pictures from strangers: they unlock once the other person replies.
    if img is not null then raise exception 'dm:image_wait'; end if;
  end if;
  if not talked and (select count(distinct m.recipient) from public.dm_messages m
                     where m.sender = me and m.created_at > now() - interval '1 day'
                       and not exists (select 1 from public.dm_messages o where o.sender = m.recipient and o.recipient = me)) >= 15 then
    raise exception 'dm:new_limit';
  end if;
  if char_length(b) > 0 and exists (select 1 from public.dm_messages
            where sender = me and recipient = p_to and body = b and created_at > now() - interval '1 minute') then
    raise exception 'dm:duplicate';
  end if;

  insert into public.dm_messages (sender, recipient, body, image_path)
  values (me, p_to, b, img) returning * into r;
  return json_build_object('id', r.id, 'from_me', true, 'body', r.body, 'image_path', r.image_path,
                           'created_at', r.created_at, 'read_at', r.read_at, 'unsent', false);
end $$;

-- ── Reading ───────────────────────────────────────────────────────────
create or replace function public.dm_inbox()
returns table (other text, last_id bigint, last_body text, last_image boolean, last_from_me boolean, last_unsent boolean,
               last_at timestamptz, unread integer, name text, avatar text, roblox_name text, roblox_verified boolean,
               level integer, blocked boolean)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare me text := public.dm_require();
begin
  return query
  with mine as (
    select m.*, case when m.sender = me then m.recipient else m.sender end as o
    from public.dm_messages m
    where (m.sender = me and not m.hidden_sender) or (m.recipient = me and not m.hidden_recipient)
  ), last as (
    select distinct on (o) * from mine order by o, id desc
  )
  select l.o, l.id, left(l.body, 140), l.image_path is not null, l.sender = me, l.unsent, l.created_at,
         (select count(*)::int from mine u where u.o = l.o and u.recipient = me and u.read_at is null and not u.unsent),
         p.discord_name::text, p.discord_avatar::text, p.roblox_name::text, coalesce(p.roblox_verified, false)::boolean,
         p.level::int,
         exists (select 1 from public.dm_blocks k where k.blocker = me and k.blocked = l.o)
  from last l
  left join public.profiles p on p.discord_id::text = l.o
  order by l.id desc
  limit 100;
end $$;

create or replace function public.dm_thread(p_other text, p_before bigint default null, p_limit integer default 50)
returns table (id bigint, from_me boolean, body text, image_path text, created_at timestamptz, read_at timestamptz, unsent boolean)
language plpgsql stable security definer set search_path = '' as $$
declare me text := public.dm_require();
begin
  if p_other is null or p_other !~ '^[0-9]{15,22}$' then raise exception 'dm:bad_user'; end if;
  return query
  select m.id, m.sender = me,
         case when m.unsent then '' else m.body end,
         case when m.unsent then null else m.image_path end,
         m.created_at, m.read_at, m.unsent
  from public.dm_messages m
  where least(m.sender, m.recipient) = least(me, p_other) and greatest(m.sender, m.recipient) = greatest(me, p_other)
    and ((m.sender = me and not m.hidden_sender) or (m.recipient = me and not m.hidden_recipient))
    and (p_before is null or m.id < p_before)
  order by m.id desc
  limit greatest(1, least(coalesce(p_limit, 50), 100));
end $$;

-- New messages after an id, plus which of mine were read (for live updates).
create or replace function public.dm_poll(p_other text, p_after bigint)
returns json language plpgsql stable security definer set search_path = '' as $$
declare me text := public.dm_require();
begin
  if p_other is null or p_other !~ '^[0-9]{15,22}$' then raise exception 'dm:bad_user'; end if;
  return json_build_object(
    'msgs', coalesce((select json_agg(t order by t.id) from public.dm_thread(p_other, null, 100) t where t.id > coalesce(p_after, 0)), '[]'::json),
    'read_upto', (select max(m.id) from public.dm_messages m where m.sender = me and m.recipient = p_other and m.read_at is not null),
    'unsent', coalesce((select json_agg(m.id) from public.dm_messages m
                        where least(m.sender, m.recipient) = least(me, p_other) and greatest(m.sender, m.recipient) = greatest(me, p_other)
                          and m.unsent and m.id <= coalesce(p_after, 0)), '[]'::json));
end $$;

create or replace function public.dm_read(p_other text)
returns integer language plpgsql volatile security definer set search_path = '' as $$
declare me text := public.dm_require(); n integer;
begin
  update public.dm_messages set read_at = now()
  where recipient = me and sender = p_other and read_at is null;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.dm_unread()
returns integer language plpgsql stable security definer set search_path = '' as $$
declare me text := public.dm_me();
begin
  if me is null then return 0; end if;
  return (select count(*)::int from public.dm_messages m
          where m.recipient = me and m.read_at is null and not m.unsent and not m.hidden_recipient
            and not exists (select 1 from public.dm_blocks k where k.blocker = me and k.blocked = m.sender));
end $$;

-- ── Managing messages ─────────────────────────────────────────────────
-- Unsend one of your own messages for both people. Returns the image path so
-- the browser can delete the file from storage too.
create or replace function public.dm_unsend(p_id bigint)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare me text := public.dm_require(); img text;
begin
  select image_path into img from public.dm_messages where id = p_id and sender = me and not unsent for update;
  if not found then raise exception 'dm:not_found'; end if;
  update public.dm_messages set unsent = true, body = '', image_path = null where id = p_id;
  return img;
end $$;

-- Hide a message (or a whole conversation) just for you.
create or replace function public.dm_hide(p_id bigint default null, p_other text default null)
returns integer language plpgsql volatile security definer set search_path = '' as $$
declare me text := public.dm_require(); n integer := 0; k integer;
begin
  if p_id is null and p_other is null then raise exception 'dm:not_found'; end if;
  update public.dm_messages set hidden_sender = true
  where sender = me and (id = p_id or (p_id is null and recipient = p_other));
  get diagnostics k = row_count; n := n + k;
  update public.dm_messages set hidden_recipient = true, read_at = coalesce(read_at, now())
  where recipient = me and (id = p_id or (p_id is null and sender = p_other));
  get diagnostics k = row_count; n := n + k;
  return n;
end $$;

create or replace function public.dm_block(p_other text, p_on boolean)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare me text := public.dm_require();
begin
  if p_other is null or p_other !~ '^[0-9]{15,22}$' or p_other = me then raise exception 'dm:bad_user'; end if;
  if p_on then
    insert into public.dm_blocks (blocker, blocked) values (me, p_other) on conflict do nothing;
  else
    delete from public.dm_blocks where blocker = me and blocked = p_other;
  end if;
  return p_on;
end $$;

create or replace function public.dm_report(p_id bigint, p_reason text)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare me text := public.dm_require(); why text := left(public.dm_clean(p_reason), 300); m public.dm_messages;
begin
  if char_length(why) = 0 then raise exception 'dm:empty'; end if;
  select * into m from public.dm_messages where id = p_id and recipient = me;
  if not found then raise exception 'dm:not_found'; end if;
  if (select count(*) from public.dm_reports where reporter = me and created_at > now() - interval '1 day') >= 10 then raise exception 'dm:slow'; end if;
  insert into public.dm_reports (reporter, message_id, reason, sender, body, image_path)
  values (me, p_id, why, m.sender, m.body, m.image_path)
  on conflict (reporter, message_id) do nothing;
  return true;
end $$;

create or replace function public.dm_get_settings()
returns json language plpgsql stable security definer set search_path = '' as $$
declare me text := public.dm_require();
begin
  return json_build_object(
    'allow_new', coalesce((select allow_new from public.dm_settings where discord_id = me), true),
    'blocked', coalesce((select json_agg(json_build_object('id', k.blocked, 'name', p.discord_name, 'avatar', p.discord_avatar) order by k.created_at desc)
                         from public.dm_blocks k left join public.profiles p on p.discord_id::text = k.blocked
                         where k.blocker = me), '[]'::json));
end $$;

create or replace function public.dm_set_allow(p_allow boolean)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare me text := public.dm_require();
begin
  insert into public.dm_settings (discord_id, allow_new, updated_at) values (me, coalesce(p_allow, true), now())
  on conflict (discord_id) do update set allow_new = excluded.allow_new, updated_at = now();
  return coalesce(p_allow, true);
end $$;

-- Can I message this person right now? Used to show the right note before typing.
create or replace function public.dm_can_message(p_other text)
returns text language plpgsql stable security definer set search_path = '' as $$
declare me text := public.dm_require(); they_replied boolean;
begin
  if p_other is null or p_other !~ '^[0-9]{15,22}$' then return 'bad_user'; end if;
  if p_other = me then return 'self'; end if;
  if not exists (select 1 from public.profiles where discord_id::text = p_other)
     or exists (select 1 from public.dm_bans where discord_id = p_other) then return 'no_user'; end if;
  if exists (select 1 from public.dm_blocks where blocker = me and blocked = p_other) then return 'you_blocked'; end if;
  if exists (select 1 from public.dm_blocks where blocker = p_other and blocked = me) then return 'closed'; end if;
  select exists (select 1 from public.dm_messages where sender = p_other and recipient = me) into they_replied;
  if not they_replied then
    if not coalesce((select allow_new from public.dm_settings where discord_id = p_other), true) then return 'closed'; end if;
    if (select count(*) from public.dm_messages where sender = me and recipient = p_other and not unsent) >= 3 then return 'wait_reply'; end if;
    return 'new';   -- can write; pictures unlock once they reply
  end if;
  return 'ok';
end $$;

-- ── Owner tools (checked with the existing is_site_owner()) ───────────
create or replace function public.dm_admin_reports()
returns table (id bigint, reporter text, sender text, body text, image_path text, reason text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not coalesce(public.is_site_owner(), false) then raise exception 'dm:forbidden'; end if;
  return query select r.id, r.reporter, r.sender, r.body, r.image_path, r.reason, r.created_at
               from public.dm_reports r order by r.id desc limit 200;
end $$;

create or replace function public.dm_admin_filtered()
returns table (id bigint, sender text, recipient text, reason text, body text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not coalesce(public.is_site_owner(), false) then raise exception 'dm:forbidden'; end if;
  return query select f.id, f.sender, f.recipient, f.reason, f.body, f.created_at
               from public.dm_filtered f order by f.id desc limit 200;
end $$;

create or replace function public.dm_admin_ban(p_user text, p_on boolean, p_reason text default null)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
begin
  if not coalesce(public.is_site_owner(), false) then raise exception 'dm:forbidden'; end if;
  if p_on then
    insert into public.dm_bans (discord_id, reason) values (p_user, left(p_reason, 300))
    on conflict (discord_id) do update set reason = excluded.reason;
  else
    delete from public.dm_bans where discord_id = p_user;
  end if;
  return p_on;
end $$;

-- ── Function grants: logged-in users only ─────────────────────────────
do $$
declare f text;
begin
  foreach f in array array[
    'dm_me()', 'dm_require()', 'dm_clean(text)', 'dm_upload_ok()', 'dm_can_see_image(text)',
    'dm_send(text,text,text)', 'dm_inbox()', 'dm_thread(text,bigint,integer)', 'dm_poll(text,bigint)',
    'dm_read(text)', 'dm_unread()', 'dm_unsend(bigint)', 'dm_hide(bigint,text)', 'dm_block(text,boolean)',
    'dm_report(bigint,text)', 'dm_get_settings()', 'dm_set_allow(boolean)', 'dm_can_message(text)',
    'dm_admin_reports()', 'dm_admin_filtered()', 'dm_admin_ban(text,boolean,text)', 'dm_has_link(text)']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- ── Image storage ─────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dm-images', 'dm-images', false, 3145728, array['image/webp', 'image/jpeg'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "dm images: upload own" on storage.objects;
drop policy if exists "dm images: read own chats" on storage.objects;
drop policy if exists "dm images: delete own" on storage.objects;

create policy "dm images: upload own" on storage.objects for insert to authenticated
with check (
  bucket_id = 'dm-images'
  and name ~ '^[0-9]{15,22}/[0-9a-f-]{36}\.(webp|jpg)$'
  and (storage.foldername(name))[1] = public.dm_me()
  and public.dm_upload_ok()
);

create policy "dm images: read own chats" on storage.objects for select to authenticated
using (bucket_id = 'dm-images' and public.dm_can_see_image(name));

create policy "dm images: delete own" on storage.objects for delete to authenticated
using (bucket_id = 'dm-images' and (storage.foldername(name))[1] = public.dm_me());
-- No update policy: files can't be swapped after a message is sent.
