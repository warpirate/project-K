-- Helper schema, not exposed through the API.
create schema if not exists private;
grant usage on schema private to authenticated, service_role;
alter default privileges in schema private revoke execute on functions from public;

create function private.my_shop_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select shop_id from public.profiles where user_id = auth.uid() and active
$$;

create function private.is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles where user_id = auth.uid() and active and role = 'owner'
  )
$$;

create function private.can_access_branch(p_branch_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.profiles p
    join public.branches b on b.shop_id = p.shop_id
    where p.user_id = auth.uid()
      and p.active
      and b.id = p_branch_id
      and (p.role = 'owner' or p.branch_id = p_branch_id)
  )
$$;

revoke execute on all functions in schema private from public;
grant execute on function private.my_shop_id(), private.is_owner(), private.can_access_branch(uuid)
  to authenticated, service_role;

-- Row Level Security
alter table public.shops enable row level security;
alter table public.branches enable row level security;
alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.services enable row level security;
alter table public.customers enable row level security;
alter table public.transactions enable row level security;
alter table public.ledger_lines enable row level security;
alter table public.day_closes enable row level security;

create policy shops_select on public.shops for select to authenticated
  using (id = private.my_shop_id());
create policy shops_update on public.shops for update to authenticated
  using (id = private.my_shop_id() and private.is_owner())
  with check (id = private.my_shop_id());

create policy branches_select on public.branches for select to authenticated
  using (shop_id = private.my_shop_id());
create policy branches_insert on public.branches for insert to authenticated
  with check (shop_id = private.my_shop_id() and private.is_owner());
create policy branches_update on public.branches for update to authenticated
  using (shop_id = private.my_shop_id() and private.is_owner())
  with check (shop_id = private.my_shop_id());

create policy profiles_select on public.profiles for select to authenticated
  using (user_id = auth.uid() or (shop_id = private.my_shop_id() and private.is_owner()));
create policy profiles_update on public.profiles for update to authenticated
  using (shop_id = private.my_shop_id() and private.is_owner())
  with check (shop_id = private.my_shop_id());

create policy accounts_select on public.accounts for select to authenticated
  using (private.can_access_branch(branch_id));
create policy accounts_insert on public.accounts for insert to authenticated
  with check (shop_id = private.my_shop_id() and private.is_owner() and private.can_access_branch(branch_id));
create policy accounts_update on public.accounts for update to authenticated
  using (shop_id = private.my_shop_id() and private.is_owner())
  with check (shop_id = private.my_shop_id() and private.can_access_branch(branch_id));

create policy services_select on public.services for select to authenticated
  using (shop_id = private.my_shop_id());
-- Staff may create services from the entry form; only the owner edits them.
create policy services_insert on public.services for insert to authenticated
  with check (shop_id = private.my_shop_id());
create policy services_update on public.services for update to authenticated
  using (shop_id = private.my_shop_id() and private.is_owner())
  with check (shop_id = private.my_shop_id());

create policy customers_select on public.customers for select to authenticated
  using (shop_id = private.my_shop_id());
create policy customers_insert on public.customers for insert to authenticated
  with check (shop_id = private.my_shop_id());
create policy customers_update on public.customers for update to authenticated
  using (shop_id = private.my_shop_id())
  with check (shop_id = private.my_shop_id());

create policy transactions_select on public.transactions for select to authenticated
  using (private.can_access_branch(branch_id));
create policy ledger_lines_select on public.ledger_lines for select to authenticated
  using (private.can_access_branch(branch_id));
create policy day_closes_select on public.day_closes for select to authenticated
  using (private.can_access_branch(branch_id));

-- Stamp who created a service; staff-created services start unreviewed.
create function private.stamp_service() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.created_by := auth.uid();
  new.reviewed := coalesce(private.is_owner(), false);
  return new;
end $$;

create trigger services_stamp before insert on public.services
  for each row execute function private.stamp_service();

-- Ledger tables are written only by security definer functions.
revoke insert, update, delete on public.transactions, public.ledger_lines, public.day_closes
  from anon, authenticated;

-- First-time owner signup.
create function public.create_shop(p_shop_name text, p_owner_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_shop uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if exists (select 1 from public.profiles where user_id = auth.uid()) then
    raise exception 'user already belongs to a shop';
  end if;
  insert into public.shops (name) values (p_shop_name) returning id into v_shop;
  insert into public.profiles (user_id, shop_id, role, name)
  values (auth.uid(), v_shop, 'owner', p_owner_name);
  return v_shop;
end $$;

-- Balances: always computed from ledger lines.
create view public.account_balances with (security_invoker = true) as
select a.id as account_id, a.shop_id, a.branch_id, a.name, a.type, a.active,
       coalesce(sum(l.amount), 0)::bigint as balance
from public.accounts a
left join public.ledger_lines l on l.account_id = a.id
group by a.id;

-- Customer dues are shop-wide (a customer may take udhaar in one branch and pay in another),
-- so this view runs as its owner and filters by the caller's shop explicitly.
create view public.customer_dues as
select c.id as customer_id, c.shop_id, c.name, c.phone,
       coalesce(sum(l.amount), 0)::bigint as due
from public.customers c
left join public.ledger_lines l on l.customer_id = c.id
where c.shop_id = private.my_shop_id()
group by c.id;

revoke all on public.account_balances, public.customer_dues from anon;
grant select on public.account_balances, public.customer_dues to authenticated;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
