create function public.post_expense(
  p_client_id uuid,
  p_branch_id uuid,
  p_account_id uuid,
  p_amount bigint,
  p_note text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_existing uuid;
  v_shop uuid;
  v_txn uuid;
begin
  v_existing := private.existing_txn(p_client_id);
  if v_existing is not null then
    return v_existing;
  end if;
  v_shop := private.require_branch(p_branch_id);
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;
  perform private.require_account(p_account_id, p_branch_id);

  v_txn := private.insert_txn(
    p_client_id, v_shop, p_branch_id, 'expense', p_amount,
    p_earning => -p_amount, p_note => p_note
  );
  perform private.add_account_line(v_txn, p_account_id, -p_amount);
  perform private.assert_balanced(v_txn);
  return v_txn;
end $$;

create function public.post_transfer(
  p_client_id uuid,
  p_from_account_id uuid,
  p_to_account_id uuid,
  p_amount bigint,
  p_note text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_existing uuid;
  v_from public.accounts;
  v_to public.accounts;
  v_txn uuid;
begin
  v_existing := private.existing_txn(p_client_id);
  if v_existing is not null then
    return v_existing;
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;
  if p_from_account_id = p_to_account_id then
    raise exception 'cannot transfer to the same account';
  end if;
  select * into v_from from public.accounts where id = p_from_account_id and active;
  select * into v_to from public.accounts where id = p_to_account_id and active;
  if v_from.id is null or v_to.id is null then
    raise exception 'account not found';
  end if;
  perform private.require_branch(v_from.branch_id);
  perform private.require_branch(v_to.branch_id);

  v_txn := private.insert_txn(
    p_client_id, v_from.shop_id, v_from.branch_id, 'transfer', p_amount, p_note => p_note
  );
  perform private.add_account_line(v_txn, p_from_account_id, -p_amount);
  perform private.add_account_line(v_txn, p_to_account_id, p_amount);
  perform private.assert_balanced(v_txn);
  return v_txn;
end $$;

create function public.post_udhaar_payment(
  p_client_id uuid,
  p_branch_id uuid,
  p_customer_id uuid,
  p_account_id uuid,
  p_amount bigint,
  p_note text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_existing uuid;
  v_shop uuid;
  v_txn uuid;
begin
  v_existing := private.existing_txn(p_client_id);
  if v_existing is not null then
    return v_existing;
  end if;
  v_shop := private.require_branch(p_branch_id);
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;
  perform private.require_account(p_account_id, p_branch_id);
  perform private.require_customer(p_customer_id, v_shop);

  v_txn := private.insert_txn(
    p_client_id, v_shop, p_branch_id, 'udhaar_payment', p_amount,
    p_customer => p_customer_id, p_note => p_note
  );
  perform private.add_account_line(v_txn, p_account_id, p_amount);
  perform private.add_customer_line(v_txn, p_customer_id, p_branch_id, -p_amount);
  perform private.assert_balanced(v_txn);
  return v_txn;
end $$;

create function public.post_opening_balance(
  p_client_id uuid,
  p_account_id uuid,
  p_amount bigint,
  p_note text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_existing uuid;
  v_acct public.accounts;
  v_txn uuid;
begin
  v_existing := private.existing_txn(p_client_id);
  if v_existing is not null then
    return v_existing;
  end if;
  if not private.is_owner() then
    raise exception 'owner only' using errcode = '42501';
  end if;
  select * into v_acct from public.accounts where id = p_account_id;
  if v_acct.id is null then
    raise exception 'account not found';
  end if;
  perform private.require_branch(v_acct.branch_id);
  if p_amount is null or p_amount = 0 then
    raise exception 'amount must not be zero';
  end if;

  -- Opening balance is capital, not earning, so assert_balanced is not applied.
  v_txn := private.insert_txn(
    p_client_id, v_acct.shop_id, v_acct.branch_id, 'opening_balance', p_amount, p_note => p_note
  );
  perform private.add_account_line(v_txn, p_account_id, p_amount);
  return v_txn;
end $$;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
