-- Any kind of shop, not only CSC: the owner picks a business type at setup and gets a ready service/item list.

-- Which starter pack the shop was set up from (see src/lib/business-packs.ts). Null = not picked yet.
alter table public.shops add column business_type text;
update public.shops set business_type = 'csc';

-- Usual price of a fixed-price service or item, in paise. Filled in on the entry screen; can still be changed per sale.
alter table public.services add column price bigint check (price is null or price >= 0);
