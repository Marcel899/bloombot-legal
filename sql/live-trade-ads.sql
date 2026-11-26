-- Bloombot website: live trade ads.
-- Run in the Supabase SQL editor. Safe to run again.
--
-- Adds trade_ads to Supabase Realtime so the Trade ads page can show
-- "N new trade ads" as they are posted. Realtime follows the table's row
-- level security, so it only sends rows a logged-in user could already read.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'No supabase_realtime publication here: the page will refresh on its own instead.';
  elsif not exists (select 1 from pg_publication_tables
                    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'trade_ads') then
    alter publication supabase_realtime add table public.trade_ads;
  end if;
end $$;
