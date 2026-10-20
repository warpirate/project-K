-- A missing key makes jsonb_typeof() return NULL, and a NULL check constraint passes.
-- Coalesce so incomplete rules are rejected.
create or replace function public.is_valid_rule(p_rule jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(case
    when p_rule is null or jsonb_typeof(p_rule) = 'null' then true
    when p_rule->>'type' = 'fixed' then jsonb_typeof(p_rule->'value') = 'number'
    when p_rule->>'type' = 'percent' then jsonb_typeof(p_rule->'bps') = 'number'
    when p_rule->>'type' = 'slab' then
      case when jsonb_typeof(p_rule->'slabs') = 'array'
           then jsonb_array_length(p_rule->'slabs') > 0
           else false end
    else false
  end, false)
$$;
