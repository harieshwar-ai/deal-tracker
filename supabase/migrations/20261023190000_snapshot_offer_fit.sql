-- Which listing a snapshot is, and whether it meets the item's hard requirements.
-- meets_requirements is a plain flag: true qualifies, false does not, null is unverified.
-- It carries no personal detail. Safe to re-run.

alter table public.price_snapshots add column if not exists product_name text;
alter table public.price_snapshots add column if not exists meets_requirements boolean;

grant select (product_name, meets_requirements) on table public.price_snapshots to anon;
