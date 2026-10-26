-- Non-owner signed-in users get the same column visibility as anon.
-- The Harbour owner reads private fields through owner_catalog_private().
-- Safe to re-run.

do $$
begin
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'authenticated') then
    revoke select on table public.items from authenticated;
    revoke select on table public.stores from authenticated;
    revoke select on table public.deals from authenticated;
    revoke select on table public.price_snapshots from authenticated;
  end if;
end
$$;

revoke select on table public.price_snapshots from anon;

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
) on table public.items to anon, authenticated;

grant select (
  id,
  name,
  base_url,
  country,
  country_code,
  enabled,
  created_at,
  updated_at
) on table public.stores to anon, authenticated;

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
) on table public.deals to anon, authenticated;

grant select (
  id,
  item_id,
  store_id,
  product_title,
  product_url,
  price,
  regular_price,
  currency,
  in_stock,
  captured_at,
  sale_ends_at,
  shipping,
  product_name,
  meets_requirements
) on table public.price_snapshots to anon, authenticated;

create or replace function public.owner_catalog_private()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_owner constant uuid := 'ce399408-8885-49fd-a960-ce4479603aaa'::uuid;
begin
  if (select auth.uid()) is distinct from v_owner then
    return pg_catalog.jsonb_build_object(
      'stores', '{}'::jsonb,
      'items', '{}'::jsonb,
      'deals', '{}'::jsonb,
      'snapshots', '{}'::jsonb
    );
  end if;

  return pg_catalog.jsonb_build_object(
    'stores', coalesce((
      select pg_catalog.jsonb_object_agg(
        s.id::text,
        pg_catalog.jsonb_build_object(
          'membership', s.membership,
          'notes', s.notes
        )
      )
      from public.stores s
    ), '{}'::jsonb),
    'items', coalesce((
      select pg_catalog.jsonb_object_agg(
        i.id::text,
        pg_catalog.jsonb_build_object(
          'description', i.description,
          'notes', i.notes,
          'target_price', i.target_price,
          'max_price', i.max_price,
          'requirements', i.requirements
        )
      )
      from public.items i
    ), '{}'::jsonb),
    'deals', coalesce((
      select pg_catalog.jsonb_object_agg(
        d.id::text,
        pg_catalog.jsonb_build_object('reason', d.reason)
      )
      from public.deals d
    ), '{}'::jsonb),
    'snapshots', coalesce((
      select pg_catalog.jsonb_object_agg(
        ps.id::text,
        pg_catalog.jsonb_build_object('member_only', ps.member_only)
      )
      from public.price_snapshots ps
    ), '{}'::jsonb)
  );
end;
$$;

revoke all on function public.owner_catalog_private() from public;
grant execute on function public.owner_catalog_private() to authenticated;
