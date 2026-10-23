-- Public product photo. Visitors may read image_url. Personal columns stay revoked.
-- Safe to re-run.

alter table public.items add column if not exists image_url text;

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
  created_at,
  updated_at
) on table public.items to anon;
