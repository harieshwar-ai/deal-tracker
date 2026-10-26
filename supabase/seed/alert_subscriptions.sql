-- Owner opt-in. Apply by hand after 20261025120000_alert_subscriptions.sql.
-- Tokens are generated here so they are not stored in git.
-- group:pc-hardware matches Prebuilt PCs, Graphics cards, Memory (RAM), and SSDs.
-- Re-running does not add a second row and does not revive an unsubscribed row.

insert into public.alert_subscriptions (
  email,
  category,
  status,
  confirm_token,
  unsubscribe_token,
  confirmed_at
)
select
  'harirmdeee@gmail.com',
  'group:pc-hardware',
  'confirmed',
  pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', '') || pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''),
  pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', '') || pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''),
  pg_catalog.now()
on conflict (email, category) where category is not null do nothing;
