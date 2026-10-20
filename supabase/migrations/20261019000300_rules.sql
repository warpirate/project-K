create function public.is_valid_rule(p_rule jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select case
    when p_rule is null or jsonb_typeof(p_rule) = 'null' then true
    when p_rule->>'type' = 'fixed' then jsonb_typeof(p_rule->'value') = 'number'
    when p_rule->>'type' = 'percent' then jsonb_typeof(p_rule->'bps') = 'number'
    when p_rule->>'type' = 'slab' then
      case when jsonb_typeof(p_rule->'slabs') = 'array'
           then jsonb_array_length(p_rule->'slabs') > 0
           else false end
    else false
  end
$$;

create function public.calc_rule(p_rule jsonb, p_amount bigint) returns bigint
language plpgsql immutable set search_path = '' as $$
declare
  v_slab jsonb;
begin
  if p_rule is null or jsonb_typeof(p_rule) = 'null' then
    return 0;
  end if;
  case p_rule->>'type'
    when 'fixed' then
      return (p_rule->>'value')::bigint;
    when 'percent' then
      return round(p_amount::numeric * (p_rule->>'bps')::numeric / 10000)::bigint;
    when 'slab' then
      for v_slab in
        select e.value from jsonb_array_elements(p_rule->'slabs') with ordinality as e(value, idx)
        order by e.idx
      loop
        if v_slab->>'upto' is null or p_amount <= (v_slab->>'upto')::bigint then
          return (v_slab->>'value')::bigint;
        end if;
      end loop;
      raise exception 'no slab matches amount %', p_amount;
    else
      raise exception 'unknown rule type %', p_rule->>'type';
  end case;
end $$;

alter table public.services
  add constraint services_fee_rule_valid check (public.is_valid_rule(fee_rule)),
  add constraint services_commission_rule_valid check (public.is_valid_rule(commission_rule)),
  add constraint services_portal_cost_rule_valid check (public.is_valid_rule(portal_cost_rule));

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
