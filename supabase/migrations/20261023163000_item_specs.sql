-- Public spec checklist, plus owner-only requirements.
-- Visitors may read specs. requirements has no anon grant.
-- Safe to re-run.

alter table public.items add column if not exists specs jsonb not null default '[]'::jsonb;
alter table public.items add column if not exists requirements jsonb not null default '[]'::jsonb;

alter table public.items drop constraint if exists items_specs_array;
alter table public.items add constraint items_specs_array check (jsonb_typeof(specs) = 'array');

alter table public.items drop constraint if exists items_requirements_array;
alter table public.items add constraint items_requirements_array check (jsonb_typeof(requirements) = 'array');

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
  created_at,
  updated_at
) on table public.items to anon;
