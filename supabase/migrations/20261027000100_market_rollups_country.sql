-- Refresh market rollups with store country and currency. Apply after 20261027000000_multi_country.sql.

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
  ps.meets_requirements,
  s.country_code,
  coalesce(ps.currency, c.currency) as store_currency
from public.price_snapshots ps
left join public.stores s on s.id = ps.store_id
left join public.countries c on c.code = s.country_code
order by
  ps.item_id,
  ps.store_id,
  coalesce(ps.product_name, ps.product_title, ''),
  ps.captured_at desc,
  ps.id desc;

comment on view public.market_latest is
  'Latest public offer for each item, store, and listing name, with store country.';

create or replace view public.market_daily
with (security_invoker = true) as
select
  ps.item_id,
  ps.store_id,
  s.country_code,
  coalesce(ps.currency, c.currency) as store_currency,
  (ps.captured_at at time zone 'America/Toronto')::date as day,
  min(ps.price) filter (
    where ps.meets_requirements is true
      and ps.currency = c.currency
      and ps.in_stock is distinct from false
  ) as qualifying_low
from public.price_snapshots ps
left join public.stores s on s.id = ps.store_id
left join public.countries c on c.code = s.country_code
group by
  ps.item_id,
  ps.store_id,
  s.country_code,
  coalesce(ps.currency, c.currency),
  (ps.captured_at at time zone 'America/Toronto')::date
having min(ps.price) filter (
  where ps.meets_requirements is true
    and ps.currency = c.currency
    and ps.in_stock is distinct from false
) is not null;

comment on view public.market_daily is
  'Lowest qualifying in-stock local-currency price per item, store, and Toronto day.';

grant select on public.market_latest, public.market_daily to anon, authenticated;
