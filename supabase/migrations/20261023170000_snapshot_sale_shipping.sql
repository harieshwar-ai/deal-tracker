-- Public sale end and shipping on a price snapshot.
-- price_snapshots is already readable by anon. These grants cover a
-- column-level policy if the table grant is ever narrowed.
-- Safe to re-run.

alter table public.price_snapshots add column if not exists sale_ends_at timestamptz;
alter table public.price_snapshots add column if not exists shipping numeric;

grant select (sale_ends_at, shipping) on table public.price_snapshots to anon;
