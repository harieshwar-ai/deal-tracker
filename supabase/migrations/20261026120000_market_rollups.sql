-- Apply by hand. Harbour does not run this file.
-- Until it is applied, the app loads price_snapshots directly.
-- After it is applied, the first load reads these two views instead of
-- every snapshot: the latest offer per listing, and one qualifying CAD low
-- per item, store, and Toronto day.
--
-- security_invoker keeps row level security and column privileges in force.
-- The views do not expose member_only, notes, targets, requirements, or emails.

create or replace view public.market_latest
with (security_invoker = true) as
select distinct on (
  ps.item_id,
  ps.store_id,
  coalesce(ps.product_name, ps.product_title, '')
)
  ps.id,
  ps.item_id,
  ps.store_id,
  ps.product_title,
  ps.product_url,
  ps.price,
  ps.regular_price,
  ps.currency,
  ps.in_stock,
  ps.captured_at,
  ps.sale_ends_at,
  ps.shipping,
  ps.product_name,
  ps.meets_requirements
from public.price_snapshots ps
order by
  ps.item_id,
  ps.store_id,
  coalesce(ps.product_name, ps.product_title, ''),
  ps.captured_at desc,
  ps.id desc;

comment on view public.market_latest is
  'Latest public offer for each item, store, and listing name.';

create or replace view public.market_daily
with (security_invoker = true) as
select
  ps.item_id,
  ps.store_id,
  (ps.captured_at at time zone 'America/Toronto')::date as day,
  min(ps.price) filter (
    where ps.meets_requirements is true
      and ps.currency = 'CAD'
      and ps.in_stock is distinct from false
  ) as qualifying_low
from public.price_snapshots ps
group by ps.item_id, ps.store_id, (ps.captured_at at time zone 'America/Toronto')::date
having min(ps.price) filter (
  where ps.meets_requirements is true
    and ps.currency = 'CAD'
    and ps.in_stock is distinct from false
) is not null;

comment on view public.market_daily is
  'Lowest qualifying in-stock CAD price per item, store, and Toronto day.';

grant select on public.market_latest, public.market_daily to anon, authenticated;
