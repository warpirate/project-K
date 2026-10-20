create function private.today() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'Asia/Kolkata')::date
$$;

create function private.require_branch(p_branch_id uuid) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare
  v_shop uuid;
begin
  if not private.can_access_branch(p_branch_id) then
    raise exception 'no access to branch %', p_branch_id using errcode = '42501';
  end if;
  select shop_id into v_shop from public.branches where id = p_branch_id;
  return v_shop;
end $$;

create function private.require_account(p_account_id uuid, p_branch_id uuid) returns void
language plpgsql stable set search_path = '' as $$
begin
  if not exists (
    select 1 from public.accounts where id = p_account_id and branch_id = p_branch_id and active
  ) then
    raise exception 'account % not in branch %', p_account_id, p_branch_id;
  end if;
end $$;

create function private.require_customer(p_customer_id uuid, p_shop_id uuid) returns void
language plpgsql stable set search_path = '' as $$
begin
  if not exists (select 1 from public.customers where id = p_customer_id and shop_id = p_shop_id) then
    raise exception 'customer % not found', p_customer_id;
  end if;
end $$;

create function private.existing_txn(p_client_id uuid) returns uuid
language sql stable set search_path = '' as $$
  select id from public.transactions where client_id = p_client_id
$$;

create function private.insert_txn(
  p_client_id uuid,
  p_shop uuid,
  p_branch uuid,
  p_kind public.txn_kind,
  p_amount bigint,
  p_service uuid default null,
  p_customer uuid default null,
  p_fee bigint default 0,
  p_commission bigint default 0,
  p_portal_cost bigint default 0,
  p_earning bigint default 0,
  p_note text default null,
  p_reversal_of uuid default null
) returns uuid
language plpgsql set search_path = '' as $$
declare
  v_id uuid;
begin
  insert into public.transactions (
    client_id, shop_id, branch_id, kind, amount, service_id, customer_id,
    fee, commission, portal_cost, earning, note, reversal_of, created_by, business_date
  ) values (
    p_client_id, p_shop, p_branch, p_kind, p_amount, p_service, p_customer,
    p_fee, p_commission, p_portal_cost, p_earning, p_note, p_reversal_of, auth.uid(), private.today()
  ) returning id into v_id;
  return v_id;
end $$;

create function private.add_account_line(p_txn uuid, p_account uuid, p_amount bigint) returns void
language plpgsql set search_path = '' as $$
begin
  if p_amount = 0 then
    return;
  end if;
  insert into public.ledger_lines (transaction_id, shop_id, branch_id, account_id, amount)
  select p_txn, a.shop_id, a.branch_id, a.id, p_amount from public.accounts a where a.id = p_account;
end $$;

create function private.add_customer_line(p_txn uuid, p_customer uuid, p_branch uuid, p_amount bigint) returns void
language plpgsql set search_path = '' as $$
begin
  if p_amount = 0 then
    return;
  end if;
  insert into public.ledger_lines (transaction_id, shop_id, branch_id, customer_id, amount)
  select p_txn, c.shop_id, p_branch, c.id, p_amount from public.customers c where c.id = p_customer;
end $$;

-- Customer side of a service entry. p_sign = 1 when the customer pays the shop, -1 when the shop pays out.
create function private.apply_payments(
  p_txn uuid,
  p_branch uuid,
  p_customer uuid,
  p_payments jsonb,
  p_total bigint,
  p_sign int,
  p_allow_udhaar boolean
) returns void
language plpgsql set search_path = '' as $$
declare
  v_part jsonb;
  v_amt bigint;
  v_sum bigint := 0;
begin
  if jsonb_typeof(p_payments) is distinct from 'array' or jsonb_array_length(p_payments) = 0 then
    raise exception 'payments required';
  end if;
  for v_part in select value from jsonb_array_elements(p_payments) loop
    v_amt := (v_part->>'amount')::bigint;
    if v_amt is null or v_amt <= 0 then
      raise exception 'payment amount must be positive';
    end if;
    if v_part ? 'account_id' then
      perform private.require_account((v_part->>'account_id')::uuid, p_branch);
      perform private.add_account_line(p_txn, (v_part->>'account_id')::uuid, p_sign * v_amt);
    elsif (v_part->>'udhaar')::boolean is true then
      if not p_allow_udhaar then
        raise exception 'udhaar not allowed for this entry';
      end if;
      if p_customer is null then
        raise exception 'customer required for udhaar';
      end if;
      perform private.add_customer_line(p_txn, p_customer, p_branch, p_sign * v_amt);
    else
      raise exception 'payment part needs account_id or udhaar';
    end if;
    v_sum := v_sum + v_amt;
  end loop;
  if v_sum <> p_total then
    raise exception 'payments total % does not match %', v_sum, p_total;
  end if;
end $$;

-- Every entry except opening balances must satisfy: sum of ledger lines = earning.
create function private.assert_balanced(p_txn uuid) returns void
language plpgsql set search_path = '' as $$
declare
  v_sum bigint;
  v_earning bigint;
begin
  select coalesce(sum(amount), 0) into v_sum from public.ledger_lines where transaction_id = p_txn;
  select earning into v_earning from public.transactions where id = p_txn;
  if v_sum <> v_earning then
    raise exception 'ledger imbalance on %: lines % vs earning %', p_txn, v_sum, v_earning;
  end if;
end $$;

create function public.post_service(
  p_client_id uuid,
  p_branch_id uuid,
  p_service_id uuid,
  p_amount bigint,
  p_payments jsonb,
  p_wallet_account_id uuid default null,
  p_customer_id uuid default null,
  p_fee bigint default null,
  p_commission bigint default null,
  p_portal_cost bigint default null,
  p_note text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_existing uuid;
  v_shop uuid;
  v_svc public.services;
  v_fee bigint;
  v_comm bigint;
  v_cost bigint;
  v_total bigint;
  v_sign int;
  v_earning bigint;
  v_txn uuid;
begin
  v_existing := private.existing_txn(p_client_id);
  if v_existing is not null then
    return v_existing;
  end if;

  v_shop := private.require_branch(p_branch_id);

  select * into v_svc from public.services where id = p_service_id and shop_id = v_shop and active;
  if not found then
    raise exception 'service % not found', p_service_id;
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;
  if p_customer_id is not null then
    perform private.require_customer(p_customer_id, v_shop);
  end if;

  v_fee := coalesce(p_fee, public.calc_rule(v_svc.fee_rule, p_amount));
  v_comm := coalesce(p_commission, public.calc_rule(v_svc.commission_rule, p_amount));
  v_cost := coalesce(p_portal_cost, public.calc_rule(v_svc.portal_cost_rule, p_amount));
  if v_fee < 0 or v_comm < 0 or v_cost < 0 then
    raise exception 'fee, commission and portal cost cannot be negative';
  end if;

  if v_svc.flow = 'counter_sale' then
    if p_wallet_account_id is not null then
      raise exception 'counter sale takes no wallet account';
    end if;
  else
    if p_wallet_account_id is null then
      raise exception 'wallet account required';
    end if;
    perform private.require_account(p_wallet_account_id, p_branch_id);
  end if;

  case v_svc.flow
    when 'cash_out' then
      if v_fee >= p_amount then
        raise exception 'fee must be less than amount';
      end if;
      v_total := p_amount - v_fee; v_sign := -1; v_earning := v_fee + v_comm; v_cost := 0;
    when 'cash_in', 'pay_through' then
      v_total := p_amount + v_fee; v_sign := 1; v_earning := v_fee + v_comm; v_cost := 0;
    when 'application' then
      v_total := p_amount; v_sign := 1; v_earning := p_amount - v_cost; v_fee := 0; v_comm := 0;
    when 'counter_sale' then
      v_total := p_amount; v_sign := 1; v_earning := p_amount; v_fee := 0; v_comm := 0; v_cost := 0;
  end case;

  v_txn := private.insert_txn(
    p_client_id, v_shop, p_branch_id, 'service', p_amount,
    p_service => p_service_id, p_customer => p_customer_id,
    p_fee => v_fee, p_commission => v_comm, p_portal_cost => v_cost,
    p_earning => v_earning, p_note => p_note
  );

  perform private.apply_payments(
    v_txn, p_branch_id, p_customer_id, p_payments, v_total, v_sign, v_svc.flow <> 'cash_out'
  );

  case v_svc.flow
    when 'cash_out' then
      perform private.add_account_line(v_txn, p_wallet_account_id, p_amount + v_comm);
    when 'cash_in', 'pay_through' then
      perform private.add_account_line(v_txn, p_wallet_account_id, -p_amount + v_comm);
    when 'application' then
      perform private.add_account_line(v_txn, p_wallet_account_id, -v_cost);
    else
      null;
  end case;

  perform private.assert_balanced(v_txn);
  return v_txn;
end $$;

revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.my_shop_id(), private.is_owner(), private.can_access_branch(uuid)
  to authenticated, service_role;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
