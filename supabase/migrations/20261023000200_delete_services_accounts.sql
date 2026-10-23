-- Deleting: a service or account never used is removed; one with entries is only marked deleted,
-- so old entries and reports keep its name. Deleted rows are also inactive, so they leave every list.
alter table public.services add column deleted_at timestamptz;
alter table public.accounts add column deleted_at timestamptz;

-- A deleted name can be used again.
drop index public.services_shop_name_key;
create unique index services_shop_name_key on public.services (shop_id, lower(trim(name))) where deleted_at is null;
alter table public.accounts drop constraint accounts_branch_id_name_key;
create unique index accounts_branch_name_key on public.accounts (branch_id, name) where deleted_at is null;

-- Owner deletes services (many at once). Returns how many were deleted.
create function public.delete_services(p_ids uuid[]) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_shop uuid := private.my_shop_id();
  v_count integer;
begin
  if not private.is_owner() then
    raise exception 'Only the owner can delete services';
  end if;

  delete from public.services s
  where s.id = any(p_ids) and s.shop_id = v_shop
    and not exists (select 1 from public.transactions t where t.service_id = s.id);

  update public.services s
  set deleted_at = now(), active = false
  where s.id = any(p_ids) and s.shop_id = v_shop and s.deleted_at is null;

  select count(*) into v_count from unnest(p_ids) as x(id)
  where not exists (select 1 from public.services s where s.id = x.id and s.deleted_at is null);
  return v_count;
end $$;

-- Owner deletes a cash drawer, wallet or bank account. Only at ₹0, and never the branch's last cash drawer.
create function public.delete_account(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_acct public.accounts;
  v_balance bigint;
begin
  if not private.is_owner() then
    raise exception 'Only the owner can delete accounts';
  end if;
  select * into v_acct from public.accounts where id = p_id and shop_id = private.my_shop_id() and deleted_at is null;
  if not found then
    raise exception 'Account not found';
  end if;

  select coalesce(sum(amount), 0) into v_balance from public.ledger_lines where account_id = p_id;
  if v_balance <> 0 then
    raise exception '₹% is still in %. Move it out first, then delete.', to_char(v_balance / 100.0, 'FM999999990.00'), v_acct.name;
  end if;

  if v_acct.type = 'cash' and not exists (
    select 1 from public.accounts
    where branch_id = v_acct.branch_id and type = 'cash' and id <> p_id and deleted_at is null
  ) then
    raise exception 'This is the only cash drawer in this branch, so it can''t be deleted.';
  end if;

  if exists (select 1 from public.ledger_lines where account_id = p_id) then
    update public.accounts set deleted_at = now(), active = false where id = p_id;
  else
    delete from public.accounts where id = p_id;
  end if;

  -- Drop it from the branch's payment buttons.
  update public.branches
  set pay_buttons = array_remove(pay_buttons, p_id::text),
      default_pay = nullif(default_pay, p_id::text)
  where id = v_acct.branch_id;
end $$;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
