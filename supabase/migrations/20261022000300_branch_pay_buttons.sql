-- Which "How did the customer pay?" buttons a branch shows on New entry, in order, and which one is picked first.
-- Items: 'cash', 'udhaar', 'split' (Mixed) or a bank/UPI account id. Null = Cash + every bank/UPI account.
alter table public.branches
  add column pay_buttons text[],
  add column default_pay text;
