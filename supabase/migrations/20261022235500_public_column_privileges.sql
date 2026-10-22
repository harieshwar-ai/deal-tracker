-- Repo record for production migration items_public_summary, plus the
-- column privileges the owner applies after this file is merged.
-- Safe to re-run. Do not apply from the app.
--
-- anon may read only the listed columns. The authenticated owner keeps
-- the table-level select grant from the earlier policies.

alter table public.items add column if not exists public_summary text;

revoke select on table public.items from anon;
revoke select on table public.stores from anon;
revoke select on table public.deals from anon;

grant select (
  id,
  name,
  public_summary,
  category,
  keywords,
  condition,
  priority,
  active,
  created_at,
  updated_at
) on table public.items to anon;

grant select (
  id,
  name,
  base_url,
  country,
  enabled,
  created_at,
  updated_at
) on table public.stores to anon;

grant select (
  id,
  item_id,
  store_id,
  snapshot_id,
  title,
  url,
  price,
  regular_price,
  discount_pct,
  score,
  verdict,
  notified_at,
  expires_at,
  status,
  found_at
) on table public.deals to anon;
