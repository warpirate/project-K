-- Reports. Security invoker: RLS decides what the caller can see (staff → own branch, owner → shop).
-- A reversal is counted under the kind of the entry it reverses, so reversed entries net out to zero.

create function public.report_totals(p_from date, p_to date, p_branch uuid default null)
returns table (profit bigint, charges bigint, commission bigint, expenses bigint, entries bigint)
language sql stable security invoker set search_path = '' as $$
  select
    coalesce(sum(t.earning), 0)::bigint,
    coalesce(sum(t.fee), 0)::bigint,
    coalesce(sum(t.commission), 0)::bigint,
    coalesce(-sum(t.earning) filter (where coalesce(o.kind, t.kind) = 'expense'), 0)::bigint,
    (count(*) filter (where t.kind = 'service') - count(*) filter (where t.kind = 'reversal' and o.kind = 'service'))::bigint
  from public.transactions t
  left join public.transactions o on o.id = t.reversal_of
  where t.business_date between p_from and p_to
    and (p_branch is null or t.branch_id = p_branch)
$$;

create function public.report_groups(p_from date, p_to date, p_group text, p_branch uuid default null)
returns table (key text, label text, profit bigint, entries bigint)
language sql stable security invoker set search_path = '' as $$
  select r.key, max(r.label), sum(r.earning)::bigint, sum(r.cnt)::bigint
  from (
    select
      case p_group
        when 'service' then coalesce(t.service_id::text, e.kind)
        when 'branch' then t.branch_id::text
        when 'staff' then coalesce(o.created_by, t.created_by)::text
        else t.business_date::text
      end as key,
      case p_group
        when 'service' then coalesce(s.name, 'Expenses')
        when 'branch' then b.name
        when 'staff' then coalesce(p.name, 'Someone')
        else t.business_date::text
      end as label,
      t.earning,
      case when t.kind = 'service' then 1 when t.kind = 'reversal' and o.kind = 'service' then -1 else 0 end as cnt
    from public.transactions t
    left join public.transactions o on o.id = t.reversal_of
    cross join lateral (select coalesce(o.kind, t.kind)::text as kind) e
    left join public.services s on s.id = t.service_id
    left join public.branches b on b.id = t.branch_id
    left join public.profiles p on p.user_id = coalesce(o.created_by, t.created_by)
    where t.business_date between p_from and p_to
      and (p_branch is null or t.branch_id = p_branch)
      and e.kind in ('service', 'expense')
  ) r
  group by r.key
  order by 3 desc
$$;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
