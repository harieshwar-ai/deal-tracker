-- latest_store_prices exposed member_only with security_invoker; after column
-- privileges, anon and non-owner authenticated roles cannot read member_only and
-- the view fails for them. The app never queried it.

drop view if exists public.latest_store_prices;

revoke execute on function public.owner_catalog_private() from public;
revoke execute on function public.owner_catalog_private() from anon;
grant execute on function public.owner_catalog_private() to authenticated;
