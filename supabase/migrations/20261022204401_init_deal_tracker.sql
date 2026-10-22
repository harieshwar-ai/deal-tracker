-- Reference copy of the migration already applied to project
-- ieohjxtkoiphewcfttuw as schema_migrations version 20261022204401
-- (init_deal_tracker). Do not run this file again.
--
-- Postgres named the unnamed indexes:
--   price_snapshots_item_id_captured_at_idx
--   deals_found_at_idx

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  base_url text,
  country text default 'CA',
  membership text,
  notes text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category text,
  keywords text[],
  target_price numeric(10,2),
  max_price numeric(10,2),
  priority text not null default 'normal' check (priority in ('low','normal','high')),
  condition text default 'new',
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.price_snapshots (
  id bigint generated always as identity primary key,
  item_id uuid not null references public.items(id) on delete cascade,
  store_id uuid references public.stores(id) on delete set null,
  product_title text,
  product_url text,
  price numeric(10,2) not null,
  regular_price numeric(10,2),
  currency text not null default 'CAD',
  in_stock boolean,
  member_only boolean default false,
  captured_at timestamptz not null default now()
);
create index on public.price_snapshots (item_id, captured_at desc);

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  store_id uuid references public.stores(id) on delete set null,
  snapshot_id bigint references public.price_snapshots(id) on delete set null,
  title text not null,
  url text,
  price numeric(10,2) not null,
  regular_price numeric(10,2),
  discount_pct numeric(5,2),
  score int check (score between 0 and 100),
  verdict text check (verdict in ('must_buy','good','ok','skip')),
  reason text,
  notified_at timestamptz,
  expires_at timestamptz,
  status text not null default 'open' check (status in ('open','bought','dismissed','expired')),
  found_at timestamptz not null default now()
);
create index on public.deals (found_at desc);

create or replace function public.touch_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger stores_touch before update on public.stores
for each row execute function public.touch_updated_at();

create trigger items_touch before update on public.items
for each row execute function public.touch_updated_at();

alter table public.stores enable row level security;
alter table public.items enable row level security;
alter table public.price_snapshots enable row level security;
alter table public.deals enable row level security;

create policy "owner full access" on public.stores
  for all to authenticated using (true) with check (true);
create policy "owner full access" on public.items
  for all to authenticated using (true) with check (true);
create policy "owner full access" on public.price_snapshots
  for all to authenticated using (true) with check (true);
create policy "owner full access" on public.deals
  for all to authenticated using (true) with check (true);

insert into public.stores (name, base_url, membership) values
  ('Costco', 'https://www.costco.ca', 'Executive'),
  ('Amazon', 'https://www.amazon.ca', 'Prime'),
  ('Walmart', 'https://www.walmart.ca', null),
  ('Canada Computers', 'https://www.canadacomputers.com', null),
  ('Best Buy', 'https://www.bestbuy.ca', null),
  ('Staples', 'https://www.staples.ca', null),
  ('Visions Electronics', 'https://www.visions.ca', null);
