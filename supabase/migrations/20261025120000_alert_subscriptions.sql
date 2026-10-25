-- Deal alert subscriptions. Review and apply by hand. The app does not run this file.
-- Addresses and tokens are not granted to anon. Writes go through the definer functions.
-- Rate limits stay aligned with PENDING_PER_EMAIL_PER_HOUR (5) and TARGET_PER_HOUR (10)
-- in src/domain/alerts.ts.

create table if not exists public.alert_subscriptions (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  item_id uuid references public.items (id) on delete cascade,
  category text,
  status text not null default 'pending',
  confirm_token text not null,
  unsubscribe_token text not null,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  last_notified_at timestamptz,
  constraint alert_subscriptions_status_check check (status in ('pending', 'confirmed', 'unsubscribed')),
  constraint alert_subscriptions_one_target check (
    (item_id is not null and category is null)
    or (item_id is null and category is not null)
  ),
  constraint alert_subscriptions_email_shape check (
    email = lower(email)
    and position('@' in email) > 1
    and char_length(email) between 3 and 320
  ),
  constraint alert_subscriptions_category_len check (category is null or char_length(category) between 1 and 80),
  constraint alert_subscriptions_token_len check (
    char_length(confirm_token) between 32 and 128
    and char_length(unsubscribe_token) between 32 and 128
    and confirm_token <> unsubscribe_token
  )
);

create unique index if not exists alert_subscriptions_email_item_uidx
  on public.alert_subscriptions (email, item_id)
  where item_id is not null;

create unique index if not exists alert_subscriptions_email_category_uidx
  on public.alert_subscriptions (email, category)
  where category is not null;

create unique index if not exists alert_subscriptions_confirm_token_uidx
  on public.alert_subscriptions (confirm_token);

create unique index if not exists alert_subscriptions_unsubscribe_token_uidx
  on public.alert_subscriptions (unsubscribe_token);

create index if not exists alert_subscriptions_email_created_idx
  on public.alert_subscriptions (email, created_at desc);

create index if not exists alert_subscriptions_item_created_idx
  on public.alert_subscriptions (item_id, created_at desc);

create index if not exists alert_subscriptions_category_created_idx
  on public.alert_subscriptions (category, created_at desc);

create table if not exists public.alert_notifications (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.alert_subscriptions (id) on delete cascade,
  item_id uuid,
  store_id uuid,
  price numeric(12, 2),
  kind text not null,
  status text not null,
  idempotency_key text not null,
  detail text,
  sent_at timestamptz not null default now(),
  constraint alert_notifications_kind_check check (kind in ('confirm', 'deal')),
  constraint alert_notifications_status_check check (status in ('sent', 'failed')),
  constraint alert_notifications_deal_shape_check check (
    kind <> 'deal' or (item_id is not null and price is not null)
  ),
  constraint alert_notifications_key_len check (char_length(idempotency_key) between 8 and 256),
  constraint alert_notifications_detail_len check (detail is null or char_length(detail) <= 500)
);

-- Null store ids would not collide in a plain unique index. The nil uuid is only
-- in the index expression, so one store-less price is still sent once.
create unique index if not exists alert_notifications_sent_deal_uidx
  on public.alert_notifications (
    subscription_id,
    item_id,
    (coalesce(store_id, '00000000-0000-0000-0000-000000000000'::uuid)),
    price
  )
  where status = 'sent' and kind = 'deal';

create index if not exists alert_notifications_confirm_idx
  on public.alert_notifications (subscription_id, sent_at desc)
  where kind = 'confirm' and status = 'sent';

alter table public.alert_subscriptions enable row level security;
alter table public.alert_notifications enable row level security;

drop policy if exists alert_subscriptions_owner_read on public.alert_subscriptions;
create policy alert_subscriptions_owner_read
  on public.alert_subscriptions
  for select
  to authenticated
  using ((select auth.uid()) = 'ce399408-8885-49fd-a960-ce4479603aaa'::uuid);

revoke all on table public.alert_subscriptions from public, anon, authenticated;
revoke all on table public.alert_notifications from public, anon, authenticated;

grant select (
  id,
  email,
  item_id,
  category,
  status,
  created_at,
  confirmed_at,
  last_notified_at
) on table public.alert_subscriptions to authenticated;

do $$
begin
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'service_role') then
    grant all on table public.alert_subscriptions to service_role;
    grant all on table public.alert_notifications to service_role;
  end if;
end
$$;

create or replace function public.subscribe_to_alerts(
  p_email text,
  p_item_id uuid,
  p_category text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_category text;
  v_item_id uuid;
  v_existing public.alert_subscriptions%rowtype;
  v_pending_count integer;
  v_target_count integer;
  v_pending_limit integer := 5;
  v_target_limit integer := 10;
  v_id uuid;
begin
  v_email := pg_catalog.lower(pg_catalog.btrim(coalesce(p_email, '')));
  if pg_catalog.char_length(v_email) < 3
     or pg_catalog.char_length(v_email) > 320
     or v_email !~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$'
  then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'invalid_email');
  end if;

  v_item_id := p_item_id;
  v_category := nullif(pg_catalog.btrim(coalesce(p_category, '')), '');
  if v_category is not null then
    v_category := pg_catalog.regexp_replace(v_category, '\s+', ' ', 'g');
  end if;

  if (v_item_id is not null and v_category is not null)
     or (v_item_id is null and v_category is null)
  then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'choose_one');
  end if;

  if v_category is not null and (
    pg_catalog.char_length(v_category) > 80
    or v_category ~ '[[:cntrl:]]'
  ) then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'invalid_category');
  end if;

  if v_item_id is not null and not exists (
    select 1 from public.items where id = v_item_id
  ) then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'unknown_item');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_email, 0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(coalesce(v_item_id::text, 'category:' || v_category), 0));

  select * into v_existing
  from public.alert_subscriptions
  where email = v_email
    and (
      (v_item_id is not null and item_id = v_item_id)
      or (v_category is not null and category = v_category)
    )
  limit 1;

  if v_existing.id is not null and v_existing.status = 'confirmed' then
    return pg_catalog.jsonb_build_object('ok', true, 'result', 'already_confirmed', 'subscription_id', v_existing.id);
  end if;

  if v_existing.id is not null and v_existing.status = 'pending' then
    return pg_catalog.jsonb_build_object('ok', true, 'result', 'pending', 'subscription_id', v_existing.id);
  end if;

  select count(*) into v_pending_count
  from public.alert_subscriptions
  where email = v_email
    and status = 'pending'
    and created_at > pg_catalog.now() - interval '1 hour';

  if v_pending_count >= v_pending_limit then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;

  if v_item_id is not null then
    select count(*) into v_target_count
    from public.alert_subscriptions
    where item_id = v_item_id
      and created_at > pg_catalog.now() - interval '1 hour';
  else
    select count(*) into v_target_count
    from public.alert_subscriptions
    where category = v_category
      and created_at > pg_catalog.now() - interval '1 hour';
  end if;

  if v_target_count >= v_target_limit then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;

  if v_existing.id is not null and v_existing.status = 'unsubscribed' then
    update public.alert_subscriptions
    set status = 'pending',
        confirm_token = pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', '') || pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''),
        unsubscribe_token = pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', '') || pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''),
        confirmed_at = null,
        created_at = pg_catalog.now()
    where id = v_existing.id
    returning id into v_id;

    return pg_catalog.jsonb_build_object('ok', true, 'result', 'pending', 'subscription_id', v_id);
  end if;

  insert into public.alert_subscriptions (
    email, item_id, category, status, confirm_token, unsubscribe_token
  ) values (
    v_email,
    v_item_id,
    v_category,
    'pending',
    pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', '') || pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''),
    pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', '') || pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', '')
  )
  returning id into v_id;

  return pg_catalog.jsonb_build_object('ok', true, 'result', 'pending', 'subscription_id', v_id);
exception
  when unique_violation then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'rate_limited');
end;
$$;

create or replace function public.confirm_alert(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.alert_subscriptions%rowtype;
begin
  if p_token is null or pg_catalog.char_length(p_token) < 32 or pg_catalog.char_length(p_token) > 128 then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  select * into v_row
  from public.alert_subscriptions
  where confirm_token = p_token;

  if v_row.id is null or v_row.status = 'unsubscribed' then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  if v_row.status = 'confirmed' then
    return pg_catalog.jsonb_build_object('ok', true, 'result', 'already_confirmed');
  end if;

  update public.alert_subscriptions
  set status = 'confirmed',
      confirmed_at = pg_catalog.now()
  where id = v_row.id
    and status = 'pending';

  return pg_catalog.jsonb_build_object('ok', true, 'result', 'confirmed');
end;
$$;

create or replace function public.unsubscribe_alert(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.alert_subscriptions%rowtype;
begin
  if p_token is null or pg_catalog.char_length(p_token) < 32 or pg_catalog.char_length(p_token) > 128 then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  select * into v_row
  from public.alert_subscriptions
  where unsubscribe_token = p_token;

  if v_row.id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  if v_row.status <> 'unsubscribed' then
    update public.alert_subscriptions
    set status = 'unsubscribed'
    where id = v_row.id;
  end if;

  return pg_catalog.jsonb_build_object('ok', true, 'result', 'unsubscribed');
end;
$$;

revoke all on function public.subscribe_to_alerts(text, uuid, text) from public;
revoke all on function public.confirm_alert(text) from public;
revoke all on function public.unsubscribe_alert(text) from public;

grant execute on function public.subscribe_to_alerts(text, uuid, text) to anon, authenticated;
grant execute on function public.confirm_alert(text) to anon, authenticated;
grant execute on function public.unsubscribe_alert(text) to anon, authenticated;
