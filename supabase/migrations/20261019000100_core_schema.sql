create type public.user_role as enum ('owner', 'staff');
create type public.account_type as enum ('cash', 'wallet', 'bank');
create type public.flow_type as enum ('cash_out', 'cash_in', 'pay_through', 'application', 'counter_sale');
create type public.txn_kind as enum ('service', 'expense', 'transfer', 'udhaar_payment', 'opening_balance', 'reversal');

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now()
);

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id),
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  unique (shop_id, name)
);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  shop_id uuid not null references public.shops(id),
  role public.user_role not null,
  branch_id uuid references public.branches(id),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check ((role = 'owner' and branch_id is null) or (role = 'staff' and branch_id is not null))
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id),
  branch_id uuid not null references public.branches(id),
  name text not null check (length(trim(name)) > 0),
  type public.account_type not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (branch_id, name)
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id),
  name text not null check (length(trim(name)) > 0),
  category text not null default 'general',
  flow public.flow_type not null,
  fee_rule jsonb,
  commission_rule jsonb,
  portal_cost_rule jsonb,
  aliases text[] not null default '{}', -- extra search words, e.g. {zerox,photocopy}
  active boolean not null default true,
  reviewed boolean not null default false, -- false = created by staff, owner should check fee/commission
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- "Xerox" and " xerox" are the same service.
create unique index services_shop_name_key on public.services (shop_id, lower(trim(name)));

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id),
  name text not null check (length(trim(name)) > 0),
  phone text,
  created_at timestamptz not null default now(),
  unique (shop_id, phone)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id),
  branch_id uuid not null references public.branches(id),
  kind public.txn_kind not null,
  service_id uuid references public.services(id),
  customer_id uuid references public.customers(id),
  amount bigint not null,
  fee bigint not null default 0,
  commission bigint not null default 0,
  portal_cost bigint not null default 0,
  earning bigint not null default 0,
  note text,
  client_id uuid not null unique,
  reversal_of uuid unique references public.transactions(id),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  business_date date not null
);

create index transactions_branch_date_idx on public.transactions (branch_id, business_date);
create index transactions_shop_date_idx on public.transactions (shop_id, business_date);

create table public.ledger_lines (
  id bigint generated always as identity primary key,
  transaction_id uuid not null references public.transactions(id),
  shop_id uuid not null references public.shops(id),
  branch_id uuid not null references public.branches(id),
  account_id uuid references public.accounts(id),
  customer_id uuid references public.customers(id),
  amount bigint not null check (amount <> 0),
  check ((account_id is null) <> (customer_id is null))
);

create index ledger_lines_account_idx on public.ledger_lines (account_id);
create index ledger_lines_customer_idx on public.ledger_lines (customer_id);
create index ledger_lines_txn_idx on public.ledger_lines (transaction_id);

create table public.day_closes (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id),
  branch_id uuid not null references public.branches(id),
  business_date date not null,
  expected_cash bigint not null,
  counted_cash bigint not null,
  difference bigint generated always as (counted_cash - expected_cash) stored,
  note text,
  closed_by uuid not null references auth.users(id),
  closed_at timestamptz not null default now(),
  unique (branch_id, business_date)
);
