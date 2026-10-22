-- Customer takes cash/UPI from the shop without buying anything: their due goes up by the amount,
-- the account goes down. Also used to hand back an advance. Not earning, so lines sum to zero.
create function public.post_udhaar_given(
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
    p_client_id, v_shop, p_branch_id, 'udhaar_given', p_amount,
    p_customer => p_customer_id, p_note => p_note
  );
  perform private.add_account_line(v_txn, p_account_id, -p_amount);
  perform private.add_customer_line(v_txn, p_customer_id, p_branch_id, p_amount);
  perform private.assert_balanced(v_txn);
  return v_txn;
end $$;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
