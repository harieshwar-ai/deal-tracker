-- A product link the owner pasted, plus whether a scan still needs to fill it in.
-- Both columns are public. Personal columns stay revoked.
-- Safe to re-run.

alter table public.items add column if not exists product_url text;
alter table public.items add column if not exists enrichment_status text not null default 'ready';

alter table public.items drop constraint if exists items_enrichment_status;
alter table public.items add constraint items_enrichment_status
  check (enrichment_status in ('ready', 'pending_enrichment'));

revoke select on table public.items from anon;

grant select (
  id,
  name,
  public_summary,
  category,
  keywords,
  condition,
  priority,
  active,
  image_url,
  specs,
  product_url,
  enrichment_status,
  created_at,
  updated_at
) on table public.items to anon;
