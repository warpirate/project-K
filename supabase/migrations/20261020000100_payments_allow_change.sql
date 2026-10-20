-- Allow "change given back": an account part may be negative (customer sent ₹500 by UPI for a ₹299
-- recharge and took ₹201 cash back → bank +500, cash −201). Parts must still add up to the total.
-- Udhaar parts stay positive.
create or replace function private.apply_payments(
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
    if v_amt is null or v_amt = 0 then
      raise exception 'payment amount must not be zero';
    end if;
    if v_part ? 'account_id' then
      perform private.require_account((v_part->>'account_id')::uuid, p_branch);
      perform private.add_account_line(p_txn, (v_part->>'account_id')::uuid, p_sign * v_amt);
    elsif (v_part->>'udhaar')::boolean is true then
      if not p_allow_udhaar then
        raise exception 'udhaar not allowed for this entry';
      end if;
      if v_amt < 0 then
        raise exception 'udhaar amount must be positive';
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
