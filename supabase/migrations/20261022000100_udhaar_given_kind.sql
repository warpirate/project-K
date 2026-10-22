-- New entry kind: customer takes money from the shop as udhaar (or takes back their advance).
-- Separate file: a new enum value can't be used in the same transaction that adds it.
alter type public.txn_kind add value if not exists 'udhaar_given';
