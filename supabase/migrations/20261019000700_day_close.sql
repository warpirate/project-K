create function public.close_day(
  p_branch_id uuid,
  p_counted_cash bigint,
  p_note text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_shop uuid;
  v_expected bigint;
  v_id uuid;
begin
  v_shop := private.require_branch(p_branch_id);
  if p_counted_cash is null or p_counted_cash < 0 then
    raise exception 'counted cash must be zero or more';
  end if;
  if exists (
    select 1 from public.day_closes where branch_id = p_branch_id and business_date = private.today()
  ) then
    raise exception 'day already closed for this branch';
  end if;

  select coalesce(sum(l.amount), 0) into v_expected
  from public.ledger_lines l
  join public.accounts a on a.id = l.account_id
  where a.branch_id = p_branch_id and a.type = 'cash';

  insert into public.day_closes (shop_id, branch_id, business_date, expected_cash, counted_cash, note, closed_by)
  values (v_shop, p_branch_id, private.today(), v_expected, p_counted_cash, p_note, auth.uid())
  returning id into v_id;
  return v_id;
end $$;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
