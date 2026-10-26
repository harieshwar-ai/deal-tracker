-- Multi-country support. Review and apply by hand after merge.
-- Apply after 20261026120000_market_rollups.sql when that view migration is present.

create table if not exists public.countries (
  code char(2) primary key,
  name text not null,
  currency char(3) not null,
  locale text not null,
  tax_label text not null,
  tax_rate numeric(6, 4),
  prices_include_tax boolean not null default false,
  enabled boolean not null default false,
  sort_order integer not null default 0,
  constraint countries_code_shape check (code ~ '^[A-Z]{2}$'),
  constraint countries_currency_shape check (currency ~ '^[A-Z]{3}$')
);

insert into public.countries (
  code, name, currency, locale, tax_label, tax_rate, prices_include_tax, enabled, sort_order
) values
  ('CA', 'Canada', 'CAD', 'en-CA', 'HST', 0.13, false, true, 10),
  ('US', 'United States', 'USD', 'en-US', 'sales tax', null, false, false, 20),
  ('GB', 'United Kingdom', 'GBP', 'en-GB', 'VAT', 0.20, true, false, 30),
  ('IN', 'India', 'INR', 'en-IN', 'GST', 0.18, true, false, 40),
  ('AU', 'Australia', 'AUD', 'en-AU', 'GST', 0.10, true, false, 50),
  ('DE', 'Germany', 'EUR', 'de-DE', 'MwSt', 0.19, true, false, 60)
on conflict (code) do update set
  name = excluded.name,
  currency = excluded.currency,
  locale = excluded.locale,
  tax_label = excluded.tax_label,
  tax_rate = excluded.tax_rate,
  prices_include_tax = excluded.prices_include_tax,
  sort_order = excluded.sort_order;

alter table public.stores add column if not exists country_code char(2);

update public.stores
set country_code = upper(left(pg_catalog.btrim(coalesce(country, 'CA')), 2))
where country_code is null;

update public.stores
set country_code = 'CA'
where country_code is null or country_code !~ '^[A-Z]{2}$';

alter table public.stores alter column country_code set default 'CA';
alter table public.stores alter column country_code set not null;

alter table public.stores
  add constraint stores_country_code_fkey
  foreign key (country_code) references public.countries (code);

create index if not exists stores_country_code_idx on public.stores (country_code);

alter table public.alert_subscriptions add column if not exists country_code char(2) not null default 'CA';

alter table public.alert_subscriptions
  add constraint alert_subscriptions_country_fkey
  foreign key (country_code) references public.countries (code);

drop index if exists public.alert_subscriptions_email_item_uidx;
create unique index if not exists alert_subscriptions_email_item_country_uidx
  on public.alert_subscriptions (email, item_id, country_code)
  where item_id is not null;

drop index if exists public.alert_subscriptions_email_category_uidx;
create unique index if not exists alert_subscriptions_email_category_country_uidx
  on public.alert_subscriptions (email, category, country_code)
  where category is not null;

create table if not exists public.country_waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  country_code char(2) not null,
  country_name text not null,
  status text not null default 'pending',
  confirm_token text not null,
  unsubscribe_token text not null,
  consented_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  constraint country_waitlist_status_check check (status in ('pending', 'confirmed', 'unsubscribed')),
  constraint country_waitlist_email_shape check (
    email = lower(email)
    and position('@' in email) > 1
    and char_length(email) between 3 and 320
  ),
  constraint country_waitlist_country_code_shape check (country_code ~ '^[A-Z]{2}$'),
  constraint country_waitlist_country_name_len check (char_length(country_name) between 2 and 80),
  constraint country_waitlist_token_len check (
    char_length(confirm_token) between 32 and 128
    and char_length(unsubscribe_token) between 32 and 128
    and confirm_token <> unsubscribe_token
  )
);

create unique index if not exists country_waitlist_email_country_uidx
  on public.country_waitlist (email, country_code);

create unique index if not exists country_waitlist_confirm_token_uidx
  on public.country_waitlist (confirm_token);

create unique index if not exists country_waitlist_unsubscribe_token_uidx
  on public.country_waitlist (unsubscribe_token);

create index if not exists country_waitlist_country_status_idx
  on public.country_waitlist (country_code, status);

alter table public.countries enable row level security;
alter table public.country_waitlist enable row level security;

drop policy if exists countries_public_read on public.countries;
create policy countries_public_read
  on public.countries
  for select
  to anon, authenticated
  using (enabled = true);

drop policy if exists countries_owner_write on public.countries;
create policy countries_owner_write
  on public.countries
  for all
  to authenticated
  using ((select auth.uid()) = 'ce399408-8885-49fd-a960-ce4479603aaa'::uuid)
  with check ((select auth.uid()) = 'ce399408-8885-49fd-a960-ce4479603aaa'::uuid);

revoke all on table public.country_waitlist from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'service_role') then
    grant all on table public.country_waitlist to service_role;
  end if;
end
$$;

grant select on table public.countries to anon, authenticated;

revoke select on table public.stores from anon;
grant select (
  id,
  name,
  base_url,
  country,
  country_code,
  enabled,
  created_at,
  updated_at
) on table public.stores to anon;

create or replace function public.join_country_waitlist(
  p_email text,
  p_country_code text,
  p_country_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_code text;
  v_name text;
  v_existing public.country_waitlist%rowtype;
  v_pending_count integer;
  v_pending_limit integer := 5;
  v_id uuid;
begin
  v_email := pg_catalog.lower(pg_catalog.btrim(coalesce(p_email, '')));
  if pg_catalog.char_length(v_email) < 3
     or pg_catalog.char_length(v_email) > 320
     or v_email !~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$'
  then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'invalid_email');
  end if;

  v_code := pg_catalog.upper(pg_catalog.btrim(coalesce(p_country_code, '')));
  if v_code !~ '^[A-Z]{2}$' then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'invalid_country');
  end if;

  v_name := pg_catalog.regexp_replace(pg_catalog.btrim(coalesce(p_country_name, '')), '\s+', ' ', 'g');
  if pg_catalog.char_length(v_name) < 2 or pg_catalog.char_length(v_name) > 80 or v_name ~ '[[:cntrl:]]' then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'invalid_country');
  end if;

  if exists (select 1 from public.countries where code = v_code and enabled) then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'already_available');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_email, 0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('waitlist:' || v_code, 0));

  select * into v_existing
  from public.country_waitlist
  where email = v_email and country_code = v_code
  limit 1;

  if v_existing.id is not null and v_existing.status = 'confirmed' then
    return pg_catalog.jsonb_build_object('ok', true, 'result', 'already_confirmed', 'waitlist_id', v_existing.id);
  end if;

  if v_existing.id is not null and v_existing.status = 'pending' then
    return pg_catalog.jsonb_build_object('ok', true, 'result', 'pending', 'waitlist_id', v_existing.id);
  end if;

  select count(*) into v_pending_count
  from public.country_waitlist
  where email = v_email
    and status = 'pending'
    and created_at > pg_catalog.now() - interval '1 hour';

  if v_pending_count >= v_pending_limit then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;

  if v_existing.id is not null and v_existing.status = 'unsubscribed' then
    update public.country_waitlist
    set status = 'pending',
        country_name = v_name,
        confirm_token = pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', '') || pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''),
        unsubscribe_token = pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', '') || pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''),
        consented_at = pg_catalog.now(),
        confirmed_at = null,
        created_at = pg_catalog.now()
    where id = v_existing.id
    returning id into v_id;

    return pg_catalog.jsonb_build_object('ok', true, 'result', 'pending', 'waitlist_id', v_id);
  end if;

  insert into public.country_waitlist (
    email, country_code, country_name, status, confirm_token, unsubscribe_token
  ) values (
    v_email,
    v_code,
    v_name,
    'pending',
    pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', '') || pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''),
    pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', '') || pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', '')
  )
  returning id into v_id;

  return pg_catalog.jsonb_build_object('ok', true, 'result', 'pending', 'waitlist_id', v_id);
exception
  when unique_violation then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'rate_limited');
end;
$$;

create or replace function public.confirm_country_waitlist(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.country_waitlist%rowtype;
begin
  if p_token is null or pg_catalog.char_length(p_token) < 32 or pg_catalog.char_length(p_token) > 128 then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  select * into v_row from public.country_waitlist where confirm_token = p_token;

  if v_row.id is null or v_row.status = 'unsubscribed' then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  if v_row.status = 'confirmed' then
    return pg_catalog.jsonb_build_object(
      'ok', true,
      'result', 'already_confirmed',
      'country_code', v_row.country_code,
      'country_name', v_row.country_name
    );
  end if;

  update public.country_waitlist
  set status = 'confirmed',
      confirmed_at = pg_catalog.now()
  where id = v_row.id
    and status = 'pending';

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'result', 'confirmed',
    'country_code', v_row.country_code,
    'country_name', v_row.country_name
  );
end;
$$;

create or replace function public.unsubscribe_country_waitlist(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.country_waitlist%rowtype;
begin
  if p_token is null or pg_catalog.char_length(p_token) < 32 or pg_catalog.char_length(p_token) > 128 then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  select * into v_row from public.country_waitlist where unsubscribe_token = p_token;

  if v_row.id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  if v_row.status <> 'unsubscribed' then
    update public.country_waitlist set status = 'unsubscribed' where id = v_row.id;
  end if;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'result', 'unsubscribed',
    'country_code', v_row.country_code,
    'country_name', v_row.country_name
  );
end;
$$;

create or replace function public.list_country_waitlist_counts()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select auth.uid()) is distinct from 'ce399408-8885-49fd-a960-ce4479603aaa'::uuid then '[]'::jsonb
    else coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'country_code', bucket.country_code,
          'country_name', bucket.country_name,
          'pending', bucket.pending,
          'confirmed', bucket.confirmed,
          'emails', bucket.emails
        )
        order by bucket.confirmed desc, bucket.pending desc, bucket.country_name
      )
      from (
        select
          country_code,
          pg_catalog.max(country_name) as country_name,
          count(*) filter (where status = 'pending')::integer as pending,
          count(*) filter (where status = 'confirmed')::integer as confirmed,
          coalesce((
            select pg_catalog.jsonb_agg(sub.email order by sub.created_at desc)
            from (
              select email, created_at
              from public.country_waitlist cw
              where cw.country_code = outer_waitlist.country_code
                and cw.status = 'confirmed'
              order by created_at desc
              limit 200
            ) sub
          ), '[]'::jsonb) as emails
        from public.country_waitlist outer_waitlist
        group by country_code
      ) bucket
    ), '[]'::jsonb)
  end;
$$;

revoke all on function public.join_country_waitlist(text, text, text) from public;
revoke all on function public.confirm_country_waitlist(text) from public;
revoke all on function public.unsubscribe_country_waitlist(text) from public;
revoke all on function public.list_country_waitlist_counts() from public, anon;

grant execute on function public.join_country_waitlist(text, text, text) to anon, authenticated;
grant execute on function public.confirm_country_waitlist(text) to anon, authenticated;
grant execute on function public.unsubscribe_country_waitlist(text) to anon, authenticated;
grant execute on function public.list_country_waitlist_counts() to authenticated;

-- subscribe_to_alerts with country_code (drop 3-arg overload to avoid PostgREST ambiguity).
drop function if exists public.subscribe_to_alerts(text, uuid, text);

create or replace function public.subscribe_to_alerts(
  p_email text,
  p_item_id uuid,
  p_category text,
  p_country_code text default 'CA'
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
  v_country char(2);
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

  v_country := pg_catalog.upper(pg_catalog.btrim(coalesce(p_country_code, 'CA')));
  if v_country !~ '^[A-Z]{2}$' then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'invalid_country');
  end if;

  if not exists (select 1 from public.countries where code = v_country and enabled) then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'invalid_country');
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
    select 1 from public.items where id = v_item_id and active
  ) then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'unknown_item');
  end if;

  if v_category = 'group:pc-hardware' then
    if not exists (
      select 1 from public.items
      where active
        and category in ('Prebuilt PCs', 'Graphics cards', 'Memory (RAM)', 'SSDs')
    ) then
      return pg_catalog.jsonb_build_object('ok', false, 'error', 'invalid_category');
    end if;
  elsif v_category is not null and not exists (
    select 1 from public.items
    where category = v_category
      and active
  ) then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'invalid_category');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_email, 0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(coalesce(v_item_id::text, 'category:' || v_category), 0));

  select * into v_existing
  from public.alert_subscriptions
  where email = v_email
    and country_code = v_country
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
      and country_code = v_country
      and created_at > pg_catalog.now() - interval '1 hour';
  else
    select count(*) into v_target_count
    from public.alert_subscriptions
    where category = v_category
      and country_code = v_country
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
    email, item_id, category, country_code, status, confirm_token, unsubscribe_token
  ) values (
    v_email,
    v_item_id,
    v_category,
    v_country,
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

revoke all on function public.subscribe_to_alerts(text, uuid, text, text) from public;
grant execute on function public.subscribe_to_alerts(text, uuid, text, text) to anon, authenticated;
