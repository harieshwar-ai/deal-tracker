-- Apply this migration. The browser app computes the same figures itself, so
-- Harbour works before this file is applied. The views are for SQL clients
-- (the daily price checker) and the indexes support those scans.
--
-- security_invoker keeps RLS on price_snapshots in force for the querying role.

create index if not exists price_snapshots_item_store_captured_idx
  on public.price_snapshots (item_id, store_id, captured_at desc, id desc);

create index if not exists price_snapshots_item_price_idx
  on public.price_snapshots (item_id, price asc, captured_at asc, id asc);

create index if not exists deals_item_id_idx
  on public.deals (item_id);

create index if not exists deals_status_found_idx
  on public.deals (status, found_at desc);

create index if not exists deals_open_found_idx
  on public.deals (found_at desc)
  where status = 'open';

create or replace view public.latest_store_prices
with (security_invoker = true) as
select distinct on (ps.item_id, ps.store_id)
  ps.id,
  ps.item_id,
  ps.store_id,
  ps.product_title,
  ps.product_url,
  ps.price,
  ps.regular_price,
  ps.currency,
  ps.in_stock,
  ps.member_only,
  ps.captured_at
from public.price_snapshots ps
order by ps.item_id, ps.store_id, ps.captured_at desc, ps.id desc;

comment on view public.latest_store_prices is
  'Latest price snapshot for each item and store. Null store_id values collapse to one row per item.';

create or replace view public.item_all_time_lows
with (security_invoker = true) as
select distinct on (ps.item_id)
  ps.item_id,
  ps.id as snapshot_id,
  ps.store_id,
  ps.price,
  ps.regular_price,
  ps.currency,
  ps.captured_at,
  ps.product_title,
  ps.product_url
from public.price_snapshots ps
where ps.currency = 'CAD'
order by ps.item_id, ps.price asc, ps.captured_at asc, ps.id asc;

comment on view public.item_all_time_lows is
  'Lowest CAD price observed for each item, preferring the earliest capture when prices tie.';

grant select on public.latest_store_prices to authenticated, service_role;
grant select on public.item_all_time_lows to authenticated, service_role;
