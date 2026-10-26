-- Invoke the deal-alerts edge function when a deal becomes publicly notable.
-- Secrets are read from Supabase Vault; missing secrets no-op without failing writes.
-- Safe to re-run.

create extension if not exists pg_net with schema extensions;

create table if not exists public.deal_alert_dispatches (
  item_id uuid not null,
  store_id uuid,
  price numeric(10, 2) not null,
  invoked_at timestamptz not null default now(),
  constraint deal_alert_dispatches_price_positive check (price > 0)
);

create unique index if not exists deal_alert_dispatches_item_store_price_uidx
  on public.deal_alert_dispatches (
    item_id,
    (coalesce(store_id, '00000000-0000-0000-0000-000000000000'::uuid)),
    price
  );

alter table public.deal_alert_dispatches enable row level security;

revoke all on table public.deal_alert_dispatches from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'service_role') then
    grant all on table public.deal_alert_dispatches to service_role;
  end if;
end
$$;

create or replace function public.deal_is_alert_eligible(p_verdict text, p_status text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_verdict in ('must_buy', 'good') and p_status = 'open';
$$;

create or replace function public.notify_deal_alerts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  if not public.deal_is_alert_eligible(new.verdict, new.status) then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and public.deal_is_alert_eligible(old.verdict, old.status)
     and old.item_id = new.item_id
     and old.store_id is not distinct from new.store_id
     and old.price = new.price then
    return new;
  end if;

  select ds.decrypted_secret
  into v_url
  from vault.decrypted_secrets ds
  where ds.name = 'deal_alerts_function_url'
  limit 1;

  select ds.decrypted_secret
  into v_secret
  from vault.decrypted_secrets ds
  where ds.name = 'deal_alerts_service_role_key'
  limit 1;

  if v_url is null or v_url = '' or v_secret is null or v_secret = '' then
    return new;
  end if;

  if exists (
    select 1
    from public.deal_alert_dispatches d
    where d.item_id = new.item_id
      and d.store_id is not distinct from new.store_id
      and d.price = new.price
  ) then
    return new;
  end if;

  begin
    perform net.http_post(
      url := v_url,
      headers := pg_catalog.jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_secret
      ),
      body := pg_catalog.jsonb_build_object(
        'action', 'deal',
        'item_id', new.item_id,
        'store_id', new.store_id,
        'price', new.price
      )
    );
    insert into public.deal_alert_dispatches (item_id, store_id, price)
    values (new.item_id, new.store_id, new.price)
    on conflict do nothing;
  exception
    when others then
      null;
  end;

  return new;
end;
$$;

drop trigger if exists deals_notify_alert_subscribers on public.deals;

create trigger deals_notify_alert_subscribers
  after insert or update of verdict, status, price, store_id, item_id
  on public.deals
  for each row
  execute function public.notify_deal_alerts();
