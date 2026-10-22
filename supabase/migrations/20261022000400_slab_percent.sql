-- A charge-by-amount row may be a percent: {"upto": 100000, "value": 1000} is ₹10 flat,
-- {"upto": null, "bps": 100} is 1% of the amount. Lets owners write "up to ₹1,000 → ₹10, above → 1%".
create or replace function public.calc_rule(p_rule jsonb, p_amount bigint) returns bigint
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
          if v_slab ? 'bps' then
            return round(p_amount::numeric * (v_slab->>'bps')::numeric / 10000)::bigint;
          end if;
          return (v_slab->>'value')::bigint;
        end if;
      end loop;
      raise exception 'no slab matches amount %', p_amount;
    else
      raise exception 'unknown rule type %', p_rule->>'type';
  end case;
end $$;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
