# Plan 2b + 3 — Rest of v1 (money pages, udhaar, day close, settings, owner dashboard)

> Executed inline in one go at the user's request (2026-10-20). TDD for logic and SQL; screens verified by Playwright on desktop + phone.

**Goal:** Finish v1 from the spec: other money entries, balances, udhaar, day close, owner settings, owner dashboard + reports.

**Rule (from user feedback):** think like a village counter. Only truly required fields are required; everything else optional, defaulted, plain words.

## Tasks

1. **Navigation** — `src/app/(app)/nav.tsx`: phone bottom tab bar, desktop top links. Items: Entry `/`, Money `/money`, Udhaar `/udhaar`, Close `/close`; owner also Dashboard `/dashboard`, Settings `/settings`.
2. **Money page** `/money` — live balances for the current branch (owner: shop total + per branch); forms: Expense (amount required; paid from defaults to cash; note optional), Move money (from/to accounts; owner can pick other branch's accounts), owner-only "Fix a balance" (enter real balance → posts the difference as an opening-balance adjustment). Uses `post_expense`, `post_transfer`, `post_opening_balance`.
3. **Udhaar page** `/udhaar` — who owes how much (search by name/phone), total outstanding, receive payment (amount; Cash/UPI), per-customer history, add customer. Uses `customer_dues`, `post_udhaar_payment`.
4. **Day close** `/close` — expected cash in drawer, counted cash, difference shown live, optional note; shows today's close if done; last 14 closes. Uses `close_day`.
5. **Settings** `/settings` (owner) — services (edit name/type/charges/aliases, turn off, mark reviewed; staff-created highlighted), accounts (add/rename/turn off per branch), branches (add/rename), staff (add, turn off, reset password).
6. **Reports SQL** — migration `20261020000200_reports.sql`: `report_totals(from,to,branch)` and `report_groups(from,to,branch,group_by)` (security invoker, RLS applies). Reversals are counted against the original's kind so they net out. DB tests.
7. **Dashboard** `/dashboard` (owner) — period (today, yesterday, 7 days, this month, last month, custom) + branch filter; cards (profit, your charges, commission, expenses, entries) with change vs previous period; profit by service / branch / staff; daily profit trend; live balances; alerts (cash differences, udhaar outstanding, negative balances, services to review); entries list for the period with CSV export.
8. **Verify + ship** — unit, DB, e2e (desktop + phone) green; migrations to prod; push → Vercel; smoke-test live.
