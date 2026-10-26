-- Trusted international stores (disabled until the owner enables each row).
-- Apply after 20261027000000_multi_country.sql.
-- Currency for each store comes from public.countries via country_code; price_snapshots carry currency at scan time.

update public.countries
set enabled = true
where code in ('US', 'GB', 'IN', 'AU', 'DE');

insert into public.stores (name, base_url, country, country_code, membership, notes, enabled)
values
  ('Amazon.com', 'https://www.amazon.com', 'US', 'US', null, null, false),
  (
    'Best Buy (US)',
    'https://www.bestbuy.com',
    'US',
    'US',
    null,
    'Scanner: append intl=nosplash to product URLs.',
    false
  ),
  ('Scan', 'https://www.scan.co.uk', 'GB', 'GB', null, null, false),
  ('Overclockers UK', 'https://www.overclockers.co.uk', 'GB', 'GB', null, null, false),
  ('Amazon UK', 'https://www.amazon.co.uk', 'GB', 'GB', null, null, false),
  ('Amazon India', 'https://www.amazon.in', 'IN', 'IN', null, null, false),
  ('Flipkart', 'https://www.flipkart.com', 'IN', 'IN', null, null, false),
  ('MD Computers', 'https://mdcomputers.in', 'IN', 'IN', null, null, false),
  ('Vedant Computers', 'https://www.vedantcomputers.com', 'IN', 'IN', null, null, false),
  ('PrimeABGB', 'https://www.primeabgb.com', 'IN', 'IN', null, 'Lower priority for scans.', false),
  ('Amazon AU', 'https://www.amazon.com.au', 'AU', 'AU', null, null, false),
  ('JB Hi-Fi', 'https://www.jbhifi.com.au', 'AU', 'AU', null, null, false),
  ('PLE', 'https://www.ple.com.au', 'AU', 'AU', null, null, false),
  ('Alternate', 'https://www.alternate.de', 'DE', 'DE', null, null, false),
  ('Caseking', 'https://www.caseking.de', 'DE', 'DE', null, null, false)
on conflict (name) do update set
  base_url = excluded.base_url,
  country = excluded.country,
  country_code = excluded.country_code,
  notes = coalesce(excluded.notes, stores.notes);
