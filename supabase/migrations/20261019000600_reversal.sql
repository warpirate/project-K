create function public.reverse_transaction(
  p_client_id uuid,
  p_transaction_id uuid,
  p_reason text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_existing uuid;
  v_orig public.transactions;
  v_txn uuid;
begin
  v_existing := private.existing_txn(p_client_id);
  if v_existing is not null then
    return v_existing;
  end if;

  select * into v_orig from public.transactions where id = p_transaction_id;
  if v_orig.id is null then
    raise exception 'transaction not found';
  end if;
  perform private.require_branch(v_orig.branch_id);
  if exists (
    select 1 from public.ledger_lines l
    where l.transaction_id = p_transaction_id
      and l.account_id is not null
      and not private.can_access_branch(l.branch_id)
  ) then
    raise exception 'no access to all accounts in this entry' using errcode = '42501';
  end if;

  if v_orig.kind = 'reversal' then
    raise exception 'cannot reverse a reversal';
  end if;
  if exists (select 1 from public.transactions where reversal_of = p_transaction_id) then
    raise exception 'entry already reversed';
  end if;
  if not private.is_owner() and v_orig.business_date <> private.today() then
    raise exception 'staff can only reverse today''s entries';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'reason required';
  end if;

  v_txn := private.insert_txn(
    p_client_id, v_orig.shop_id, v_orig.branch_id, 'reversal', -v_orig.amount,
    p_service => v_orig.service_id, p_customer => v_orig.customer_id,
    p_fee => -v_orig.fee, p_commission => -v_orig.commission, p_portal_cost => -v_orig.portal_cost,
    p_earning => -v_orig.earning, p_note => trim(p_reason), p_reversal_of => p_transaction_id
  );

  insert into public.ledger_lines (transaction_id, shop_id, branch_id, account_id, customer_id, amount)
  select v_txn, shop_id, branch_id, account_id, customer_id, -amount
  from public.ledger_lines
  where transaction_id = p_transaction_id;

  return v_txn;
end $$;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
