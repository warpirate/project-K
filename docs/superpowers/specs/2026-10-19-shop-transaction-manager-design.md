# Project K — Shop Transaction 



Manager (v1) Design

Date: 2026-10-19
Status: Draft for review

## 1. Purpose

A web app for an internet / CSP shop ("net center") to record every money transaction and service sale, track cash and portal balances per branch, manage customer dues (udhaar), and show the owner live profit and commission across all branches.

First user: one shop with two branches. Later goal: offer it to other shops, so data is structured as shop → branches from day one.

## 2. Scope

### In v1

- Website only (no mobile app), works in PC and phone browsers.
- Manual transaction entry.
- Shop, branches, staff logins, roles.
- Money accounts per branch: cash drawer, portal wallets, bank/UPI accounts.
- Configurable services with fee and commission rules.
- Double-entry ledger with automatic balance updates.
- Customers and udhaar (dues, partial payments).
- Expenses and internal transfers (wallet top-up, cash deposit to bank).
- Day close (expected vs counted cash).
- Owner home: quick entry + dashboard (profit, fees, commission, expenses, balances, alerts).
- Reports with Excel export.
- First-time setup wizard.

### Not in v1 (later)

- v1.1: offline fallback (queue entries during internet loss, sync later).
- v2: Android helper app capturing transaction SMS / portal notifications as draft entries.
- Portal report (CSV/Excel) upload and auto-matching.
- Application status tracking (PAN submitted / pending / delivered).
- Receipt printing, SMS to customers.
- Multi-shop signup and billing (selling to other shops).

## 3. Users and roles

| Role  | Access                                                                                                                                                                                |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner | All branches. Enters transactions in any branch, manages settings, staff, services, sees all reports and dashboard.                                                                   |
| Staff | Exactly one branch. Enters transactions, reversals, transfers, expenses, customers/udhaar, day close for own branch. Sees only own branch data. No settings, no cross-branch reports. |

Access rules are enforced in the database (Supabase Row Level Security), not only in the UI.

## 4. Architecture

```
Branch PC browser ─┐
Owner phone/PC  ───┼──> Web app (Next.js, TypeScript) ──> Supabase
                   │                                      (Postgres, Auth, RLS, Realtime)
```

- **Web app:** Next.js (App Router) + TypeScript + Tailwind, hosted on Vercel.
- **Database/Auth:** Supabase Postgres. Supabase Auth for logins. RLS policies per shop and branch. Realtime so the owner dashboard updates live.
- **Money logic** (posting a transaction into ledger lines) runs in a single Postgres function per operation, inside one database transaction, so a transaction and its ledger lines are always saved together or not at all.
- **Every table carries `shop_id`**; branch-level tables also carry `branch_id`.

## 5. Data model

| Table            | Key fields                                                                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `shops`        | id, name                                                                                                                                                                             |
| `branches`     | id, shop_id, name                                                                                                                                                                    |
| `profiles`     | user_id, shop_id, role (owner/staff), branch_id (null for owner), name, active                                                                                                       |
| `accounts`     | id, shop_id, branch_id, name, type (cash / wallet / bank), active                                                                                                                    |
| `services`     | id, shop_id, name, category, flow_type, fee_rule, commission_rule, portal_cost_rule, aliases, active, reviewed, created_by                                                                      |
| `customers`    | id, shop_id, name, phone                                                                                                                                                             |
| `transactions` | id, shop_id, branch_id, service_id, customer_id?, kind, amount, fee, commission, portal_cost, payment_mode (cash / upi / udhaar / split), note, created_by, created_at, reversal_of? |
| `ledger_lines` | id, transaction_id, account_id OR customer_id, amount (signed, paise)                                                                                                                |
| `day_closes`   | id, branch_id, date, expected_cash, counted_cash, difference, note, closed_by, closed_at                                                                                             |

- All money stored as integer paise.
- Account balance = sum of its ledger lines. Customer due = sum of that customer's ledger lines. Never stored as editable numbers.
- Opening balances are posted as an "opening balance" transaction during setup.
- `transactions.kind`: `service`, `expense`, `transfer`, `udhaar_payment`, `opening_balance`, `reversal`.

### Fee / commission rules

Each rule is one of: fixed amount, percentage of amount, or slab table (amount ranges → fixed value). Staff can override the computed fee on the entry form; the override is stored on the transaction.

## 6. Money flows

`flow_type` on each service defines how ledger lines are generated. "Customer side" = drawer cash, or bank/UPI account if paid by UPI, or customer due if udhaar.

| flow_type                                   | Example                         | Customer side              | Portal wallet                   | Shop earns                    |
| ------------------------------------------- | ------------------------------- | -------------------------- | ------------------------------- | ----------------------------- |
| `cash_out` (AEPS withdrawal)              | ₹2000, fee ₹20                | −(amount − fee) = −1980 | +amount = +2000, + commission   | fee + commission              |
| `cash_in` (money transfer, deposit)       | ₹5000, fee ₹50                | +(amount + fee) = +5050    | −amount = −5000, + commission | fee + commission              |
| `pay_through` (recharge, bill pay)        | ₹299                           | +amount = +299             | −amount = −299, + commission  | commission (+ fee if charged) |
| `application` (PAN, certificates)         | charge ₹250, portal cost ₹107 | +charge = +250             | −portal_cost = −107           | charge − portal_cost         |
| `counter_sale` (xerox, print, lamination) | 10 pages, ₹20                  | +amount = +20              | —                              | amount                        |

Other entries:

- **Expense:** cash/bank −amount; reported as expense.
- **Transfer:** account A −amount, account B +amount (wallet top-up, cash deposit to bank, moving cash between branches by owner). Not earnings.
- **Udhaar payment:** customer due −amount, cash/bank +amount.
- **Split payment:** customer side split across cash, UPI and udhaar; parts must sum to the total.
- **Commission timing:** v1 assumes commission is credited to the wallet at transaction time. To be confirmed with the owner; if commission arrives later, commission becomes a separate periodic entry.

Profit = fees + commissions + counter sales + (application charge − portal cost) − expenses.

## 7. Corrections and audit

- Transactions and ledger lines are never edited or deleted.
- A mistake is fixed with **Reverse**: creates a `reversal` transaction with opposite ledger lines, linked via `reversal_of`, with a required reason. The user can then enter the correct transaction.
- Every transaction records who created it and when.
- Staff can reverse only same-day entries in their branch; the owner can reverse any.

## 8. Screens

| Screen                 | Who                             | Notes                                                                                                                                                     |
| ---------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Setup wizard           | Owner, first login              | Branches → accounts + opening balances → services + fees/commission → staff invites.                                                                   |
| Owner home             | Owner                           | Quick entry form at top (branch picker remembers last branch), dashboard below. On phone a fixed "+ New entry" button.                                    |
| Staff home / New entry | Staff                           | Fast form: service → amount → fee (auto, editable) → payment mode → optional customer → save. Keyboard-friendly for PC. Shows today's entries below. |
| Entries list           | Staff (own branch), Owner (all) | Filter by date, branch, service, staff. Reverse button.                                                                                                   |
| Balances & transfers   | Staff, Owner                    | Live balance per account; transfer / top-up form; expense form.                                                                                           |
| Customers & udhaar     | Staff, Owner                    | Customer search by name/phone, dues list, history, record payment.                                                                                        |
| Day close              | Staff, Owner                    | Shows expected cash, enter counted cash, save difference with note.                                                                                       |
| Reports                | Owner                           | Profit by day / month / service / branch / staff; transaction list; Excel export.                                                                         |
| Settings               | Owner                           | Branches, staff, accounts, services and rules.                                                                                                            |

### Service picker (entry form)

- Typing in the service box filters existing services by name and aliases (e.g. "zerox", "photocopy" find Xerox); matching ignores case and extra spaces.
- If a match exists, staff select it. No duplicate service can be created (names unique ignoring case/spaces).
- If nothing matches, the list offers **+ Create "<typed text>"**: a small popup (name, flow type, fee/commission) creates the service and returns to the entry with it selected.
- Owner and staff can both create services. Staff-created services are marked unreviewed and shown on the owner dashboard so the owner can check fee/commission. Only the owner can edit services.

### Owner dashboard contents

- Filters: date range (today, yesterday, week, month, custom), branch (all / one).
- Cards: profit, fees, commission, expenses, each with change vs previous period. Card click → underlying entries.
- Profit by branch, profit by service, 30-day profit trend.
- Live balances per branch account.
- Alerts: day-close cash differences, total udhaar outstanding, accounts with negative balance, new services created by staff awaiting review.

## 9. Error handling

- Form validation: amount > 0, required fields per flow type, split parts sum to total.
- Warning (not block) when an entry would make a wallet or cash balance negative.
- Lost connection or failed save: clear "Not saved" banner, form contents kept, retry button. No silent loss.
- Double-submit protection: each entry form carries a client-generated id; the server ignores duplicates.
- Staff attempting cross-branch access is blocked by RLS.

## 10. Testing

- Unit tests for fee / commission / slab rule calculation.
- Database tests for every flow type: correct ledger lines, balances, profit; reversal returns balances exactly to before.
- RLS tests: staff cannot read or write another branch; owner can read all.
- End-to-end tests (Playwright) for setup wizard, new entry, reversal, udhaar payment, day close, dashboard numbers.
- Pilot with real shop data at one branch before rollout to the second.

## 11. Open questions

- Does portal commission arrive in the wallet instantly or later (daily/monthly)?
- List of portals, banks and services actually used, with current fees and commission rates (needed for setup wizard defaults).
