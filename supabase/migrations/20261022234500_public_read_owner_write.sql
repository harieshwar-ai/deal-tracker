-- Record of the production migration public_read_owner_write.
-- Already applied on project ieohjxtkoiphewcfttuw. Safe to re-run:
-- policies are dropped if they exist, then created again.
--
-- Visitors (anon) can read stores, items, price snapshots, deals,
-- latest_store_prices, and item_all_time_lows.
-- Writes succeed only for the Harbour owner.

do $$
declare
  target text;
begin
  foreach target in array array['stores', 'items', 'price_snapshots', 'deals']
  loop
    execute format('drop policy if exists "owner full access" on public.%I', target);
    execute format('drop policy if exists "public read" on public.%I', target);
    execute format('drop policy if exists "owner insert" on public.%I', target);
    execute format('drop policy if exists "owner update" on public.%I', target);
    execute format('drop policy if exists "owner delete" on public.%I', target);
  end loop;
end $$;

create policy "public read" on public.stores
  for select to anon, authenticated
  using (true);
create policy "owner insert" on public.stores
  for insert to authenticated
  with check ((select auth.uid()) = 'ce399408-8885-49fd-a960-ce4479603aaa'::uuid);
create policy "owner update" on public.stores
  for update to authenticated
  using ((select auth.uid()) = 'ce399408-8885-49fd-a960-ce4479603aaa'::uuid)
  with check ((select auth.uid()) = 'ce399408-8885-49fd-a960-ce4479603aaa'::uuid);
create policy "owner delete" on public.stores
  for delete to authenticated
  using ((select auth.uid()) = 'ce399408-8885-49fd-a960-ce4479603aaa'::uuid);

create policy "public read" on public.items
  for select to anon, authenticated
  using (true);
create policy "owner insert" on public.items
  for insert to authenticated
  with check ((select auth.uid()) = 'ce399408-8885-49fd-a960-ce4479603aaa'::uuid);
create policy "owner update" on public.items
  for update to authenticated
  using ((select auth.uid()) = 'ce399408-8885-49fd-a960-ce4479603aaa'::uuid)
  with check ((select auth.uid()) = 'ce399408-8885-49fd-a960-ce4479603aaa'::uuid);
create policy "owner delete" on public.items
  for delete to authenticated
  using ((select auth.uid()) = 'ce399408-8885-49fd-a960-ce4479603aaa'::uuid);

create policy "public read" on public.price_snapshots
  for select to anon, authenticated
  using (true);
create policy "owner insert" on public.price_snapshots
  for insert to authenticated
  with check ((select auth.uid()) = 'ce399408-8885-49fd-a960-ce4479603aaa'::uuid);
create policy "owner update" on public.price_snapshots
  for update to authenticated
  using ((select auth.uid()) = 'ce399408-8885-49fd-a960-ce4479603aaa'::uuid)
  with check ((select auth.uid()) = 'ce399408-8885-49fd-a960-ce4479603aaa'::uuid);
create policy "owner delete" on public.price_snapshots
  for delete to authenticated
  using ((select auth.uid()) = 'ce399408-8885-49fd-a960-ce4479603aaa'::uuid);

create policy "public read" on public.deals
  for select to anon, authenticated
  using (true);
create policy "owner insert" on public.deals
  for insert to authenticated
  with check ((select auth.uid()) = 'ce399408-8885-49fd-a960-ce4479603aaa'::uuid);
create policy "owner update" on public.deals
  for update to authenticated
  using ((select auth.uid()) = 'ce399408-8885-49fd-a960-ce4479603aaa'::uuid)
  with check ((select auth.uid()) = 'ce399408-8885-49fd-a960-ce4479603aaa'::uuid);
create policy "owner delete" on public.deals
  for delete to authenticated
  using ((select auth.uid()) = 'ce399408-8885-49fd-a960-ce4479603aaa'::uuid);

grant select on public.stores, public.items, public.price_snapshots, public.deals to anon;

do $$
begin
  if to_regclass('public.latest_store_prices') is not null then
    grant select on public.latest_store_prices to anon;
  end if;
  if to_regclass('public.item_all_time_lows') is not null then
    grant select on public.item_all_time_lows to anon;
  end if;
end $$;
