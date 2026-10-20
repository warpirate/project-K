-- Replace the security-definer customer_dues view with one that respects RLS.
-- Dues are shop-wide, so customer (udhaar) ledger lines are readable by anyone in the shop;
-- account lines stay restricted to the branch.
drop policy ledger_lines_select on public.ledger_lines;
create policy ledger_lines_select on public.ledger_lines for select to authenticated
  using (
    private.can_access_branch(branch_id)
    or (customer_id is not null and shop_id = private.my_shop_id())
  );

drop view public.customer_dues;
create view public.customer_dues with (security_invoker = true) as
select c.id as customer_id, c.shop_id, c.name, c.phone,
       coalesce(sum(l.amount), 0)::bigint as due
from public.customers c
left join public.ledger_lines l on l.customer_id = c.id
group by c.id;

revoke all on public.customer_dues from anon;
grant select on public.customer_dues to authenticated;
