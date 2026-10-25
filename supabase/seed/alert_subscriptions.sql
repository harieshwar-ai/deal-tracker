-- Owner opt-in. Apply by hand after 20261025120000_alert_subscriptions.sql.
-- Tokens are generated here so they are not stored in git.
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
  seed.category,
  'confirmed',
  pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', '') || pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''),
  pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', '') || pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''),
  pg_catalog.now()
from (
  values ('prebuilt-pc'), ('gpu'), ('ram'), ('ssd')
) as seed(category)
where not exists (
  select 1
  from public.alert_subscriptions existing
  where existing.email = 'harirmdeee@gmail.com'
    and existing.category = seed.category
);
