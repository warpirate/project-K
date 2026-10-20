# Plan 1 — Money Core (Database, Ledger, Access Rules) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Supabase database for Project K — shops, branches, staff roles, accounts, services, customers, an append-only double-entry ledger, posting functions for every money flow, reversals, and day close — fully covered by integration tests.

**Architecture:** All money logic lives in Postgres functions (`security definer`) so a transaction and its ledger lines are written atomically and only through validated paths. Tables are read through Row Level Security: staff see only their branch, the owner sees the whole shop. Direct writes to the ledger are revoked. Tests are Vitest integration tests that log in as real users against a local Supabase stack, so they exercise RLS exactly as the web app will.

**Tech Stack:** Supabase (Postgres 15+, Auth, PostgREST) via Supabase CLI + Docker, TypeScript, Vitest, `@supabase/supabase-js`.

**Spec:** `docs/superpowers/specs/2026-10-19-shop-transaction-manager-design.md`

**This is plan 1 of 3.** Plan 2 = web app screens (login, setup wizard, entry forms, balances, udhaar, day close). Plan 3 = owner dashboard + reports.

**Deviations from spec (deliberate):**
- `services.default_account_id` dropped: wallets are per branch, so one service cannot point to one wallet. The entry form (plan 2) will remember the last wallet used per service per branch.
- `transactions` gains `earning` and `business_date` columns. `earning` = shop profit effect of the entry, so profit = `sum(earning)`. Invariant enforced in code: for every non-opening entry, `sum(ledger_lines.amount) = earning`.
- Reversals land on the reversal date (`business_date` = day the reversal is made).

---

## Conventions

- **Money:** integer paise (`bigint`). ₹20 = `2000`.
- **Sign:** ledger line `amount` > 0 = money into that account (or customer owes more). < 0 = money out (or customer owes less).
- **Rules (jsonb):** `{"type":"fixed","value":2000}`, `{"type":"percent","bps":100}` (bps = 1/100 of a percent, so 100 bps = 1%), `{"type":"slab","slabs":[{"upto":100000,"value":1000},{"upto":null,"value":2000}]}`.
- **Payments (jsonb array) on service entries:** `[{"account_id":"<uuid>","amount":198000}]` or for udhaar `[{"udhaar":true,"amount":51000}]`. Parts must sum to the customer-side total.
- **Idempotency:** every posting function takes `p_client_id uuid`. Same id twice returns the first transaction id and posts nothing new.
- **Business date:** `Asia/Kolkata` calendar date.
- All commands run from repo root `D:\project K` in Git Bash.

## File Structure

```
package.json                     # scripts + deps (no Next.js yet; plan 2 adds it)
tsconfig.json                    # TS config for tests
vitest.config.ts                 # reads local Supabase keys, runs tests/db
.gitignore
supabase/config.toml             # from `supabase init`
supabase/migrations/
  20261019000100_core_schema.sql       # enums + tables
  20261019000200_access_and_views.sql  # private helpers, RLS, create_shop, balance views
  20261019000300_rules.sql             # calc_rule, is_valid_rule, rule constraints
  20261019000400_post_service.sql      # posting helpers + post_service
  20261019000500_other_entries.sql     # expense, transfer, udhaar payment, opening balance
  20261019000600_reversal.sql          # reverse_transaction
  20261019000700_day_close.sql         # close_day
tests/helpers.ts                 # clients, user creation, shop fixture, balance readers
tests/db/smoke.test.ts
tests/db/access.test.ts
tests/db/rules.test.ts
tests/db/post-service.test.ts
tests/db/other-entries.test.ts
tests/db/reversal.test.ts
tests/db/day-close.test.ts
src/lib/database.types.ts        # generated in Task 8
```

---

### Task 1: Project scaffold + local Supabase + test harness

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `tests/helpers.ts`, `tests/db/smoke.test.ts`
- Create (by CLI): `supabase/config.toml`, `supabase/.gitignore`

- [ ] **Step 1: Make sure Docker Desktop is running**

Run: `docker info --format '{{.ServerVersion}}'`
Expected: a version number (e.g. `29.6.1`). If it prints an error, start Docker Desktop and wait until it says "Engine running", then re-run.

- [ ] **Step 2: Create `package.json`**

The folder name `project K` is not a valid npm package name, so write the file by hand:

```json
{
  "name": "project-k",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "db:start": "supabase start",
    "db:stop": "supabase stop",
    "db:reset": "supabase db reset",
    "db:types": "supabase gen types typescript --local > src/lib/database.types.ts",
    "test:db": "vitest run",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 3: Install dependencies**

Run:
```bash
npm install @supabase/supabase-js
npm install -D supabase vitest typescript @types/node
```
Expected: both finish without `ERR!`. `node_modules/.bin/supabase` exists.

- [ ] **Step 4: Create `.gitignore`**

```gitignore
node_modules/
.env
.env.*
!.env.example
*.log
.DS_Store
.next/
```

- [ ] **Step 5: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["node"],
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["tests/**/*.ts", "src/**/*.ts", "vitest.config.ts"]
}
```

- [ ] **Step 6: Initialise Supabase**

Run: `npx supabase init`
If asked "Generate VS Code settings for Deno?" or "IntelliJ settings?", answer `N`.
Expected: `supabase/config.toml` created.

Then open `supabase/config.toml` and set the first line to:
```toml
project_id = "project-k"
```

- [ ] **Step 7: Start local Supabase**

Run: `npx supabase start` (first run downloads images, can take 5–10 min)
Expected: ends with a block listing `API URL`, `DB URL`, `anon key`, `service_role key`.

If it fails with a mount/path error mentioning the space in `project K`: stop, report it — the fix is moving the repo to a path without spaces (e.g. `D:\project-k`).

- [ ] **Step 8: Confirm env output format**

Run: `npx supabase status -o env`
Expected: lines including `API_URL="http://127.0.0.1:54321"`, `ANON_KEY="..."`, `SERVICE_ROLE_KEY="..."`. If the CLI names them differently (e.g. `PUBLISHABLE_KEY` / `SECRET_KEY`), use those names in Step 9's mapping.

- [ ] **Step 9: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import { execSync } from "node:child_process";

function supabaseEnv(): Record<string, string> {
  const out = execSync("npx supabase status -o env", { encoding: "utf8" });
  const env: Record<string, string> = {};
  for (const line of out.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)="?(.*?)"?$/);
    if (m) env[m[1]] = m[2];
  }
  if (!env.API_URL || !env.ANON_KEY || !env.SERVICE_ROLE_KEY) {
    throw new Error("Local Supabase not running or keys missing. Run: npm run db:start");
  }
  return {
    SUPABASE_URL: env.API_URL,
    SUPABASE_ANON_KEY: env.ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: env.SERVICE_ROLE_KEY,
  };
}

export default defineConfig({
  test: {
    include: ["tests/db/**/*.test.ts"],
    env: supabaseEnv(),
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
```

- [ ] **Step 10: Write the failing smoke test `tests/db/smoke.test.ts`**

```ts
import { it, expect } from "vitest";
import { newUserClient } from "../helpers";

it("creates and signs in a user against local Supabase", async () => {
  const { client, userId } = await newUserClient();
  const { data } = await client.auth.getUser();
  expect(data.user?.id).toBe(userId);
});
```

- [ ] **Step 11: Run it to verify it fails**

Run: `npm run test:db`
Expected: FAIL — cannot resolve `../helpers`.

- [ ] **Step 12: Create `tests/helpers.ts`**

```ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const url = process.env.SUPABASE_URL!;
const anonKey = process.env.SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

/** Service-role client: bypasses RLS. Use only for test setup, never to assert app behaviour. */
export const admin = createClient(url, serviceKey, noSession);

/** Throws on a Supabase error, otherwise returns data. */
export function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

/** Creates a confirmed auth user and returns a client signed in as that user. */
export async function newUserClient(): Promise<{ client: SupabaseClient; userId: string }> {
  const email = `u-${randomUUID()}@test.local`;
  const password = "test-password-123";
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  const client = createClient(url, anonKey, noSession);
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  return { client, userId: created.data.user.id };
}
```

- [ ] **Step 13: Run tests to verify pass, and typecheck**

Run: `npm run test:db && npm run typecheck`
Expected: `1 passed`, no type errors.

- [ ] **Step 14: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts .gitignore supabase tests
git commit -m "chore: scaffold Supabase local stack and Vitest DB test harness"
```

---

### Task 2: Core schema, access rules, create_shop, balance views

**Files:**
- Create: `supabase/migrations/20261019000100_core_schema.sql`
- Create: `supabase/migrations/20261019000200_access_and_views.sql`
- Modify: `tests/helpers.ts` (append fixture + readers)
- Test: `tests/db/access.test.ts`

- [ ] **Step 1: Append shop fixture and readers to `tests/helpers.ts`**

Add at the end of the file:

```ts
export async function insertId(
  client: SupabaseClient,
  table: string,
  row: Record<string, unknown>,
): Promise<string> {
  const data = must(await client.from(table).insert(row).select("id").single()) as { id: string };
  return data.id;
}

export interface ShopFixture {
  owner: SupabaseClient;
  ownerId: string;
  staff: SupabaseClient; // staff member of branch1
  staffId: string;
  shopId: string;
  branch1: string;
  branch2: string;
  cash1: string;
  wallet1: string;
  bank1: string;
  cash2: string;
  services: { aeps: string; transfer: string; recharge: string; pan: string; xerox: string };
}

/**
 * Fresh shop with 2 branches, 4 accounts, 5 services and one staff member in branch1.
 * Service rules:
 *  aeps      cash_out     fee slab ≤₹1000 → ₹10, above → ₹20; commission 0.25%
 *  transfer  cash_in      fee 1%; commission ₹5
 *  recharge  pay_through  no fee; commission 3%
 *  pan       application  portal cost ₹107
 *  xerox     counter_sale
 */
export async function setupShop(): Promise<ShopFixture> {
  const { client: owner, userId: ownerId } = await newUserClient();
  const shopId = must(
    await owner.rpc("create_shop", { p_shop_name: "Test Shop", p_owner_name: "Owner" }),
  ) as string;
  const branch1 = await insertId(owner, "branches", { shop_id: shopId, name: "Branch 1" });
  const branch2 = await insertId(owner, "branches", { shop_id: shopId, name: "Branch 2" });
  const acct = (branch_id: string, name: string, type: string) =>
    insertId(owner, "accounts", { shop_id: shopId, branch_id, name, type });
  const cash1 = await acct(branch1, "Cash drawer", "cash");
  const wallet1 = await acct(branch1, "PayNearby", "wallet");
  const bank1 = await acct(branch1, "SBI UPI", "bank");
  const cash2 = await acct(branch2, "Cash drawer", "cash");
  const svc = (name: string, flow: string, rules: Record<string, unknown>) =>
    insertId(owner, "services", { shop_id: shopId, name, flow, ...rules });
  const services = {
    aeps: await svc("AEPS withdrawal", "cash_out", {
      fee_rule: { type: "slab", slabs: [{ upto: 100000, value: 1000 }, { upto: null, value: 2000 }] },
      commission_rule: { type: "percent", bps: 25 },
    }),
    transfer: await svc("Money transfer", "cash_in", {
      fee_rule: { type: "percent", bps: 100 },
      commission_rule: { type: "fixed", value: 500 },
    }),
    recharge: await svc("Mobile recharge", "pay_through", {
      commission_rule: { type: "percent", bps: 300 },
    }),
    pan: await svc("PAN application", "application", {
      portal_cost_rule: { type: "fixed", value: 10700 },
    }),
    xerox: await svc("Xerox", "counter_sale", {}),
  };
  const { client: staff, userId: staffId } = await newUserClient();
  must(
    await admin
      .from("profiles")
      .insert({ user_id: staffId, shop_id: shopId, role: "staff", branch_id: branch1, name: "Staff 1" }),
  );
  return { owner, ownerId, staff, staffId, shopId, branch1, branch2, cash1, wallet1, bank1, cash2, services };
}

/** Balance of one account as seen by `client` (RLS applies). */
export async function balanceOf(client: SupabaseClient, accountId: string): Promise<number> {
  const row = must(
    await client.from("account_balances").select("balance").eq("account_id", accountId).single(),
  ) as { balance: number };
  return Number(row.balance);
}

/** Amount a customer owes the shop, as seen by `client`. */
export async function dueOf(client: SupabaseClient, customerId: string): Promise<number> {
  const row = must(
    await client.from("customer_dues").select("due").eq("customer_id", customerId).single(),
  ) as { due: number };
  return Number(row.due);
}

export interface TxnRow {
  id: string;
  kind: string;
  amount: number;
  fee: number;
  commission: number;
  portal_cost: number;
  earning: number;
  note: string | null;
  reversal_of: string | null;
}

export async function txnRow(client: SupabaseClient, id: string): Promise<TxnRow> {
  return must(await client.from("transactions").select("*").eq("id", id).single()) as TxnRow;
}
```

- [ ] **Step 2: Write the failing test `tests/db/access.test.ts`**

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { randomUUID } from "node:crypto";
import { setupShop, newUserClient, must, type ShopFixture } from "../helpers";

let f: ShopFixture;
beforeAll(async () => {
  f = await setupShop();
});

describe("create_shop", () => {
  it("makes the caller owner of a new shop", async () => {
    const profile = must(
      await f.owner.from("profiles").select("role, shop_id, branch_id").eq("user_id", f.ownerId).single(),
    );
    expect(profile).toEqual({ role: "owner", shop_id: f.shopId, branch_id: null });
  });

  it("refuses a second shop for the same user", async () => {
    const { error } = await f.owner.rpc("create_shop", { p_shop_name: "Again", p_owner_name: "Owner" });
    expect(error?.message).toMatch(/already belongs/);
  });
});

describe("branch isolation", () => {
  it("staff sees only own branch accounts", async () => {
    const rows = must(await f.staff.from("accounts").select("id")) as { id: string }[];
    expect(rows.map((r) => r.id).sort()).toEqual([f.cash1, f.wallet1, f.bank1].sort());
  });

  it("owner sees accounts of all branches", async () => {
    const rows = must(await f.owner.from("accounts").select("id")) as { id: string }[];
    expect(rows).toHaveLength(4);
  });

  it("staff sees only own branch balances", async () => {
    const row = must(
      await f.staff.from("account_balances").select("balance").eq("account_id", f.cash2).maybeSingle(),
    );
    expect(row).toBeNull();
  });

  it("a user with no shop sees nothing", async () => {
    const { client } = await newUserClient();
    expect(must(await client.from("accounts").select("id"))).toHaveLength(0);
    expect(must(await client.from("branches").select("id"))).toHaveLength(0);
  });

  it("staff cannot create accounts", async () => {
    const { error } = await f.staff
      .from("accounts")
      .insert({ shop_id: f.shopId, branch_id: f.branch1, name: "Hack", type: "cash" });
    expect(error).not.toBeNull();
  });

  it("owner of another shop cannot add accounts to this shop", async () => {
    const other = await setupShop();
    const { error } = await other.owner
      .from("accounts")
      .insert({ shop_id: f.shopId, branch_id: f.branch1, name: "X", type: "cash" });
    expect(error).not.toBeNull();
  });

  it("staff can create a service, which starts unreviewed", async () => {
    const row = must(
      await f.staff
        .from("services")
        .insert({ shop_id: f.shopId, name: "Lamination", flow: "counter_sale" })
        .select("reviewed, created_by")
        .single(),
    );
    expect(row).toEqual({ reviewed: false, created_by: f.staffId });
  });

  it("owner-created services are reviewed", async () => {
    const row = must(await f.owner.from("services").select("reviewed").eq("id", f.services.xerox).single());
    expect(row).toEqual({ reviewed: true });
  });

  it("service names are unique ignoring case and spaces", async () => {
    const { error } = await f.staff
      .from("services")
      .insert({ shop_id: f.shopId, name: " xerox", flow: "counter_sale" });
    expect(error).not.toBeNull();
  });

  it("staff cannot edit services", async () => {
    const rows = must(
      await f.staff.from("services").update({ fee_rule: { type: "fixed", value: 1 } }).eq("id", f.services.xerox).select("id"),
    );
    expect(rows).toHaveLength(0);
  });

  it("staff can add customers to the shop", async () => {
    const { error } = await f.staff
      .from("customers")
      .insert({ shop_id: f.shopId, name: "Ramesh", phone: "9000000001" });
    expect(error).toBeNull();
  });
});

describe("ledger is append-only", () => {
  it("blocks direct inserts into transactions", async () => {
    const { error } = await f.owner.from("transactions").insert({
      shop_id: f.shopId,
      branch_id: f.branch1,
      kind: "expense",
      amount: 100,
      client_id: randomUUID(),
      created_by: f.ownerId,
      business_date: "2026-10-19",
    });
    expect(error).not.toBeNull();
  });

  it("blocks direct inserts into ledger_lines", async () => {
    const { error } = await f.owner.from("ledger_lines").insert({
      transaction_id: randomUUID(),
      shop_id: f.shopId,
      branch_id: f.branch1,
      account_id: f.cash1,
      amount: 100,
    });
    expect(error).not.toBeNull();
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm run test:db -- tests/db/access.test.ts`
Expected: FAIL — `Could not find the function public.create_shop` (or similar).

- [ ] **Step 4: Create `supabase/migrations/20261019000100_core_schema.sql`**

```sql
create type public.user_role as enum ('owner', 'staff');
create type public.account_type as enum ('cash', 'wallet', 'bank');
create type public.flow_type as enum ('cash_out', 'cash_in', 'pay_through', 'application', 'counter_sale');
create type public.txn_kind as enum ('service', 'expense', 'transfer', 'udhaar_payment', 'opening_balance', 'reversal');

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now()
);

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id),
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  unique (shop_id, name)
);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  shop_id uuid not null references public.shops(id),
  role public.user_role not null,
  branch_id uuid references public.branches(id),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check ((role = 'owner' and branch_id is null) or (role = 'staff' and branch_id is not null))
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id),
  branch_id uuid not null references public.branches(id),
  name text not null check (length(trim(name)) > 0),
  type public.account_type not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (branch_id, name)
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id),
  name text not null check (length(trim(name)) > 0),
  category text not null default 'general',
  flow public.flow_type not null,
  fee_rule jsonb,
  commission_rule jsonb,
  portal_cost_rule jsonb,
  aliases text[] not null default '{}', -- extra search words, e.g. {zerox,photocopy}
  active boolean not null default true,
  reviewed boolean not null default false, -- false = created by staff, owner should check fee/commission
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- "Xerox" and " xerox" are the same service.
create unique index services_shop_name_key on public.services (shop_id, lower(trim(name)));

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id),
  name text not null check (length(trim(name)) > 0),
  phone text,
  created_at timestamptz not null default now(),
  unique (shop_id, phone)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id),
  branch_id uuid not null references public.branches(id),
  kind public.txn_kind not null,
  service_id uuid references public.services(id),
  customer_id uuid references public.customers(id),
  amount bigint not null,
  fee bigint not null default 0,
  commission bigint not null default 0,
  portal_cost bigint not null default 0,
  earning bigint not null default 0,
  note text,
  client_id uuid not null unique,
  reversal_of uuid unique references public.transactions(id),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  business_date date not null
);

create index transactions_branch_date_idx on public.transactions (branch_id, business_date);
create index transactions_shop_date_idx on public.transactions (shop_id, business_date);

create table public.ledger_lines (
  id bigint generated always as identity primary key,
  transaction_id uuid not null references public.transactions(id),
  shop_id uuid not null references public.shops(id),
  branch_id uuid not null references public.branches(id),
  account_id uuid references public.accounts(id),
  customer_id uuid references public.customers(id),
  amount bigint not null check (amount <> 0),
  check ((account_id is null) <> (customer_id is null))
);

create index ledger_lines_account_idx on public.ledger_lines (account_id);
create index ledger_lines_customer_idx on public.ledger_lines (customer_id);
create index ledger_lines_txn_idx on public.ledger_lines (transaction_id);

create table public.day_closes (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id),
  branch_id uuid not null references public.branches(id),
  business_date date not null,
  expected_cash bigint not null,
  counted_cash bigint not null,
  difference bigint generated always as (counted_cash - expected_cash) stored,
  note text,
  closed_by uuid not null references auth.users(id),
  closed_at timestamptz not null default now(),
  unique (branch_id, business_date)
);
```

- [ ] **Step 5: Create `supabase/migrations/20261019000200_access_and_views.sql`**

```sql
-- Helper schema, not exposed through the API.
create schema if not exists private;
grant usage on schema private to authenticated, service_role;
alter default privileges in schema private revoke execute on functions from public;

create function private.my_shop_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select shop_id from public.profiles where user_id = auth.uid() and active
$$;

create function private.is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles where user_id = auth.uid() and active and role = 'owner'
  )
$$;

create function private.can_access_branch(p_branch_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.profiles p
    join public.branches b on b.shop_id = p.shop_id
    where p.user_id = auth.uid()
      and p.active
      and b.id = p_branch_id
      and (p.role = 'owner' or p.branch_id = p_branch_id)
  )
$$;

revoke execute on all functions in schema private from public;
grant execute on function private.my_shop_id(), private.is_owner(), private.can_access_branch(uuid)
  to authenticated, service_role;

-- Row Level Security
alter table public.shops enable row level security;
alter table public.branches enable row level security;
alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.services enable row level security;
alter table public.customers enable row level security;
alter table public.transactions enable row level security;
alter table public.ledger_lines enable row level security;
alter table public.day_closes enable row level security;

create policy shops_select on public.shops for select to authenticated
  using (id = private.my_shop_id());
create policy shops_update on public.shops for update to authenticated
  using (id = private.my_shop_id() and private.is_owner())
  with check (id = private.my_shop_id());

create policy branches_select on public.branches for select to authenticated
  using (shop_id = private.my_shop_id());
create policy branches_insert on public.branches for insert to authenticated
  with check (shop_id = private.my_shop_id() and private.is_owner());
create policy branches_update on public.branches for update to authenticated
  using (shop_id = private.my_shop_id() and private.is_owner())
  with check (shop_id = private.my_shop_id());

create policy profiles_select on public.profiles for select to authenticated
  using (user_id = auth.uid() or (shop_id = private.my_shop_id() and private.is_owner()));
create policy profiles_update on public.profiles for update to authenticated
  using (shop_id = private.my_shop_id() and private.is_owner())
  with check (shop_id = private.my_shop_id());

create policy accounts_select on public.accounts for select to authenticated
  using (private.can_access_branch(branch_id));
create policy accounts_insert on public.accounts for insert to authenticated
  with check (shop_id = private.my_shop_id() and private.is_owner() and private.can_access_branch(branch_id));
create policy accounts_update on public.accounts for update to authenticated
  using (shop_id = private.my_shop_id() and private.is_owner())
  with check (shop_id = private.my_shop_id() and private.can_access_branch(branch_id));

create policy services_select on public.services for select to authenticated
  using (shop_id = private.my_shop_id());
-- Staff may create services from the entry form; only the owner edits them.
create policy services_insert on public.services for insert to authenticated
  with check (shop_id = private.my_shop_id());
create policy services_update on public.services for update to authenticated
  using (shop_id = private.my_shop_id() and private.is_owner())
  with check (shop_id = private.my_shop_id());

create policy customers_select on public.customers for select to authenticated
  using (shop_id = private.my_shop_id());
create policy customers_insert on public.customers for insert to authenticated
  with check (shop_id = private.my_shop_id());
create policy customers_update on public.customers for update to authenticated
  using (shop_id = private.my_shop_id())
  with check (shop_id = private.my_shop_id());

create policy transactions_select on public.transactions for select to authenticated
  using (private.can_access_branch(branch_id));
create policy ledger_lines_select on public.ledger_lines for select to authenticated
  using (private.can_access_branch(branch_id));
create policy day_closes_select on public.day_closes for select to authenticated
  using (private.can_access_branch(branch_id));

-- Stamp who created a service; staff-created services start unreviewed.
create function private.stamp_service() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.created_by := auth.uid();
  new.reviewed := coalesce(private.is_owner(), false);
  return new;
end $$;

create trigger services_stamp before insert on public.services
  for each row execute function private.stamp_service();

-- Ledger tables are written only by security definer functions.
revoke insert, update, delete on public.transactions, public.ledger_lines, public.day_closes
  from anon, authenticated;

-- First-time owner signup.
create function public.create_shop(p_shop_name text, p_owner_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_shop uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if exists (select 1 from public.profiles where user_id = auth.uid()) then
    raise exception 'user already belongs to a shop';
  end if;
  insert into public.shops (name) values (p_shop_name) returning id into v_shop;
  insert into public.profiles (user_id, shop_id, role, name)
  values (auth.uid(), v_shop, 'owner', p_owner_name);
  return v_shop;
end $$;

-- Balances: always computed from ledger lines.
create view public.account_balances with (security_invoker = true) as
select a.id as account_id, a.shop_id, a.branch_id, a.name, a.type, a.active,
       coalesce(sum(l.amount), 0)::bigint as balance
from public.accounts a
left join public.ledger_lines l on l.account_id = a.id
group by a.id;

-- Customer dues are shop-wide (a customer may take udhaar in one branch and pay in another),
-- so this view runs as its owner and filters by the caller's shop explicitly.
create view public.customer_dues as
select c.id as customer_id, c.shop_id, c.name, c.phone,
       coalesce(sum(l.amount), 0)::bigint as due
from public.customers c
left join public.ledger_lines l on l.customer_id = c.id
where c.shop_id = private.my_shop_id()
group by c.id;

revoke all on public.account_balances, public.customer_dues from anon;
grant select on public.account_balances, public.customer_dues to authenticated;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
```

- [ ] **Step 6: Apply migrations**

Run: `npm run db:reset`
Expected: ends with `Finished supabase db reset`. No SQL errors.

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm run test:db -- tests/db/access.test.ts`
Expected: all 15 tests PASS.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations tests
git commit -m "feat(db): core schema, branch-level RLS, create_shop, balance views"
```

---

### Task 3: Fee / commission rule calculation

**Files:**
- Create: `supabase/migrations/20261019000300_rules.sql`
- Test: `tests/db/rules.test.ts`

- [ ] **Step 1: Write the failing test `tests/db/rules.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { admin, must, setupShop } from "../helpers";

const calc = async (rule: unknown, amount: number) =>
  Number(must(await admin.rpc("calc_rule", { p_rule: rule, p_amount: amount })));

describe("calc_rule", () => {
  it("returns 0 for no rule", async () => {
    expect(await calc(null, 50000)).toBe(0);
  });

  it("fixed returns the value", async () => {
    expect(await calc({ type: "fixed", value: 500 }, 200000)).toBe(500);
  });

  it("percent uses basis points and rounds half up", async () => {
    expect(await calc({ type: "percent", bps: 300 }, 29900)).toBe(897);
    expect(await calc({ type: "percent", bps: 25 }, 199999)).toBe(500);
  });

  it("slab picks the first slab the amount fits", async () => {
    const rule = { type: "slab", slabs: [{ upto: 100000, value: 1000 }, { upto: null, value: 2000 }] };
    expect(await calc(rule, 100000)).toBe(1000);
    expect(await calc(rule, 100001)).toBe(2000);
  });

  it("rejects unknown rule types", async () => {
    const { error } = await admin.rpc("calc_rule", { p_rule: { type: "magic" }, p_amount: 100 });
    expect(error?.message).toMatch(/unknown rule type/);
  });
});

describe("service rule validation", () => {
  it("rejects a malformed fee rule", async () => {
    const f = await setupShop();
    const { error } = await f.owner
      .from("services")
      .insert({ shop_id: f.shopId, name: "Bad", flow: "cash_in", fee_rule: { type: "percent" } });
    expect(error).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:db -- tests/db/rules.test.ts`
Expected: FAIL — `Could not find the function public.calc_rule`.

- [ ] **Step 3: Create `supabase/migrations/20261019000300_rules.sql`**

```sql
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
```

- [ ] **Step 4: Apply and run tests**

Run: `npm run db:reset && npm run test:db -- tests/db/rules.test.ts`
Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations tests
git commit -m "feat(db): fee/commission rule calculation with validation"
```

---

### Task 4: Posting helpers + post_service (all 5 money flows)

**Files:**
- Create: `supabase/migrations/20261019000400_post_service.sql`
- Test: `tests/db/post-service.test.ts`

- [ ] **Step 1: Write the failing test `tests/db/post-service.test.ts`**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { setupShop, must, balanceOf, dueOf, txnRow, insertId, type ShopFixture } from "../helpers";

let f: ShopFixture;
beforeEach(async () => {
  f = await setupShop();
});

async function postService(args: Record<string, unknown>, client = f.staff): Promise<string> {
  return must(
    await client.rpc("post_service", { p_client_id: randomUUID(), p_branch_id: f.branch1, ...args }),
  ) as string;
}

describe("post_service money flows", () => {
  it("cash_out (AEPS ₹2000): drawer pays out amount minus fee, wallet gets amount plus commission", async () => {
    const id = await postService({
      p_service_id: f.services.aeps,
      p_amount: 200000,
      p_wallet_account_id: f.wallet1,
      p_payments: [{ account_id: f.cash1, amount: 198000 }],
    });
    expect(await balanceOf(f.staff, f.cash1)).toBe(-198000);
    expect(await balanceOf(f.staff, f.wallet1)).toBe(200500);
    const t = await txnRow(f.staff, id);
    expect([t.kind, t.fee, t.commission, t.earning]).toEqual(["service", 2000, 500, 2500]);
  });

  it("cash_in (transfer ₹5000): customer pays amount plus fee, wallet pays amount", async () => {
    const id = await postService({
      p_service_id: f.services.transfer,
      p_amount: 500000,
      p_wallet_account_id: f.wallet1,
      p_payments: [{ account_id: f.cash1, amount: 505000 }],
    });
    expect(await balanceOf(f.staff, f.cash1)).toBe(505000);
    expect(await balanceOf(f.staff, f.wallet1)).toBe(-499500);
    expect((await txnRow(f.staff, id)).earning).toBe(5500);
  });

  it("pay_through (recharge ₹299 by UPI): bank receives, wallet pays minus commission", async () => {
    const id = await postService({
      p_service_id: f.services.recharge,
      p_amount: 29900,
      p_wallet_account_id: f.wallet1,
      p_payments: [{ account_id: f.bank1, amount: 29900 }],
    });
    expect(await balanceOf(f.staff, f.bank1)).toBe(29900);
    expect(await balanceOf(f.staff, f.wallet1)).toBe(-29003);
    expect((await txnRow(f.staff, id)).earning).toBe(897);
  });

  it("application (PAN ₹250): customer pays charge, wallet pays portal cost", async () => {
    const id = await postService({
      p_service_id: f.services.pan,
      p_amount: 25000,
      p_wallet_account_id: f.wallet1,
      p_payments: [{ account_id: f.cash1, amount: 25000 }],
    });
    expect(await balanceOf(f.staff, f.cash1)).toBe(25000);
    expect(await balanceOf(f.staff, f.wallet1)).toBe(-10700);
    const t = await txnRow(f.staff, id);
    expect([t.portal_cost, t.earning]).toEqual([10700, 14300]);
  });

  it("counter_sale (xerox ₹20): all of it is earning", async () => {
    const id = await postService({
      p_service_id: f.services.xerox,
      p_amount: 2000,
      p_payments: [{ account_id: f.cash1, amount: 2000 }],
    });
    expect(await balanceOf(f.staff, f.cash1)).toBe(2000);
    expect((await txnRow(f.staff, id)).earning).toBe(2000);
  });

  it("split payment with udhaar puts the unpaid part on the customer", async () => {
    const customer = await insertId(f.staff, "customers", { shop_id: f.shopId, name: "Ramesh", phone: "9000000001" });
    await postService({
      p_service_id: f.services.transfer,
      p_amount: 100000,
      p_wallet_account_id: f.wallet1,
      p_customer_id: customer,
      p_payments: [
        { account_id: f.cash1, amount: 50000 },
        { udhaar: true, amount: 51000 },
      ],
    });
    expect(await balanceOf(f.staff, f.cash1)).toBe(50000);
    expect(await dueOf(f.staff, customer)).toBe(51000);
  });

  it("fee override replaces the computed fee", async () => {
    const id = await postService({
      p_service_id: f.services.aeps,
      p_amount: 200000,
      p_fee: 3000,
      p_wallet_account_id: f.wallet1,
      p_payments: [{ account_id: f.cash1, amount: 197000 }],
    });
    expect(await balanceOf(f.staff, f.cash1)).toBe(-197000);
    expect((await txnRow(f.staff, id)).earning).toBe(3500);
  });
});

describe("post_service validation", () => {
  it("rejects payments that do not add up", async () => {
    const { error } = await f.staff.rpc("post_service", {
      p_client_id: randomUUID(),
      p_branch_id: f.branch1,
      p_service_id: f.services.aeps,
      p_amount: 200000,
      p_wallet_account_id: f.wallet1,
      p_payments: [{ account_id: f.cash1, amount: 100 }],
    });
    expect(error?.message).toMatch(/does not match/);
  });

  it("rejects udhaar on a cash withdrawal", async () => {
    const customer = await insertId(f.staff, "customers", { shop_id: f.shopId, name: "Sita", phone: "9000000002" });
    const { error } = await f.staff.rpc("post_service", {
      p_client_id: randomUUID(),
      p_branch_id: f.branch1,
      p_service_id: f.services.aeps,
      p_amount: 200000,
      p_wallet_account_id: f.wallet1,
      p_customer_id: customer,
      p_payments: [{ udhaar: true, amount: 198000 }],
    });
    expect(error?.message).toMatch(/udhaar not allowed/);
  });

  it("is idempotent on client id", async () => {
    const clientId = randomUUID();
    const args = {
      p_client_id: clientId,
      p_branch_id: f.branch1,
      p_service_id: f.services.xerox,
      p_amount: 2000,
      p_payments: [{ account_id: f.cash1, amount: 2000 }],
    };
    const first = must(await f.staff.rpc("post_service", args));
    const second = must(await f.staff.rpc("post_service", args));
    expect(second).toBe(first);
    expect(await balanceOf(f.staff, f.cash1)).toBe(2000);
  });

  it("staff cannot post to another branch", async () => {
    const { error } = await f.staff.rpc("post_service", {
      p_client_id: randomUUID(),
      p_branch_id: f.branch2,
      p_service_id: f.services.xerox,
      p_amount: 2000,
      p_payments: [{ account_id: f.cash2, amount: 2000 }],
    });
    expect(error?.message).toMatch(/no access/);
  });

  it("rejects a wallet from another branch", async () => {
    const { error } = await f.owner.rpc("post_service", {
      p_client_id: randomUUID(),
      p_branch_id: f.branch1,
      p_service_id: f.services.recharge,
      p_amount: 29900,
      p_wallet_account_id: f.cash2,
      p_payments: [{ account_id: f.cash1, amount: 29900 }],
    });
    expect(error?.message).toMatch(/not in branch/);
  });

  it("requires a wallet for portal services", async () => {
    const { error } = await f.staff.rpc("post_service", {
      p_client_id: randomUUID(),
      p_branch_id: f.branch1,
      p_service_id: f.services.recharge,
      p_amount: 29900,
      p_payments: [{ account_id: f.cash1, amount: 29900 }],
    });
    expect(error?.message).toMatch(/wallet account required/);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:db -- tests/db/post-service.test.ts`
Expected: FAIL — `Could not find the function public.post_service`.

- [ ] **Step 3: Create `supabase/migrations/20261019000400_post_service.sql`**

```sql
create function private.today() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'Asia/Kolkata')::date
$$;

create function private.require_branch(p_branch_id uuid) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare
  v_shop uuid;
begin
  if not private.can_access_branch(p_branch_id) then
    raise exception 'no access to branch %', p_branch_id using errcode = '42501';
  end if;
  select shop_id into v_shop from public.branches where id = p_branch_id;
  return v_shop;
end $$;

create function private.require_account(p_account_id uuid, p_branch_id uuid) returns void
language plpgsql stable set search_path = '' as $$
begin
  if not exists (
    select 1 from public.accounts where id = p_account_id and branch_id = p_branch_id and active
  ) then
    raise exception 'account % not in branch %', p_account_id, p_branch_id;
  end if;
end $$;

create function private.require_customer(p_customer_id uuid, p_shop_id uuid) returns void
language plpgsql stable set search_path = '' as $$
begin
  if not exists (select 1 from public.customers where id = p_customer_id and shop_id = p_shop_id) then
    raise exception 'customer % not found', p_customer_id;
  end if;
end $$;

create function private.existing_txn(p_client_id uuid) returns uuid
language sql stable set search_path = '' as $$
  select id from public.transactions where client_id = p_client_id
$$;

create function private.insert_txn(
  p_client_id uuid,
  p_shop uuid,
  p_branch uuid,
  p_kind public.txn_kind,
  p_amount bigint,
  p_service uuid default null,
  p_customer uuid default null,
  p_fee bigint default 0,
  p_commission bigint default 0,
  p_portal_cost bigint default 0,
  p_earning bigint default 0,
  p_note text default null,
  p_reversal_of uuid default null
) returns uuid
language plpgsql set search_path = '' as $$
declare
  v_id uuid;
begin
  insert into public.transactions (
    client_id, shop_id, branch_id, kind, amount, service_id, customer_id,
    fee, commission, portal_cost, earning, note, reversal_of, created_by, business_date
  ) values (
    p_client_id, p_shop, p_branch, p_kind, p_amount, p_service, p_customer,
    p_fee, p_commission, p_portal_cost, p_earning, p_note, p_reversal_of, auth.uid(), private.today()
  ) returning id into v_id;
  return v_id;
end $$;

create function private.add_account_line(p_txn uuid, p_account uuid, p_amount bigint) returns void
language plpgsql set search_path = '' as $$
begin
  if p_amount = 0 then
    return;
  end if;
  insert into public.ledger_lines (transaction_id, shop_id, branch_id, account_id, amount)
  select p_txn, a.shop_id, a.branch_id, a.id, p_amount from public.accounts a where a.id = p_account;
end $$;

create function private.add_customer_line(p_txn uuid, p_customer uuid, p_branch uuid, p_amount bigint) returns void
language plpgsql set search_path = '' as $$
begin
  if p_amount = 0 then
    return;
  end if;
  insert into public.ledger_lines (transaction_id, shop_id, branch_id, customer_id, amount)
  select p_txn, c.shop_id, p_branch, c.id, p_amount from public.customers c where c.id = p_customer;
end $$;

-- Customer side of a service entry. p_sign = 1 when the customer pays the shop, -1 when the shop pays out.
create function private.apply_payments(
  p_txn uuid,
  p_branch uuid,
  p_customer uuid,
  p_payments jsonb,
  p_total bigint,
  p_sign int,
  p_allow_udhaar boolean
) returns void
language plpgsql set search_path = '' as $$
declare
  v_part jsonb;
  v_amt bigint;
  v_sum bigint := 0;
begin
  if jsonb_typeof(p_payments) is distinct from 'array' or jsonb_array_length(p_payments) = 0 then
    raise exception 'payments required';
  end if;
  for v_part in select value from jsonb_array_elements(p_payments) loop
    v_amt := (v_part->>'amount')::bigint;
    if v_amt is null or v_amt <= 0 then
      raise exception 'payment amount must be positive';
    end if;
    if v_part ? 'account_id' then
      perform private.require_account((v_part->>'account_id')::uuid, p_branch);
      perform private.add_account_line(p_txn, (v_part->>'account_id')::uuid, p_sign * v_amt);
    elsif (v_part->>'udhaar')::boolean is true then
      if not p_allow_udhaar then
        raise exception 'udhaar not allowed for this entry';
      end if;
      if p_customer is null then
        raise exception 'customer required for udhaar';
      end if;
      perform private.add_customer_line(p_txn, p_customer, p_branch, p_sign * v_amt);
    else
      raise exception 'payment part needs account_id or udhaar';
    end if;
    v_sum := v_sum + v_amt;
  end loop;
  if v_sum <> p_total then
    raise exception 'payments total % does not match %', v_sum, p_total;
  end if;
end $$;

-- Every entry except opening balances must satisfy: sum of ledger lines = earning.
create function private.assert_balanced(p_txn uuid) returns void
language plpgsql set search_path = '' as $$
declare
  v_sum bigint;
  v_earning bigint;
begin
  select coalesce(sum(amount), 0) into v_sum from public.ledger_lines where transaction_id = p_txn;
  select earning into v_earning from public.transactions where id = p_txn;
  if v_sum <> v_earning then
    raise exception 'ledger imbalance on %: lines % vs earning %', p_txn, v_sum, v_earning;
  end if;
end $$;

create function public.post_service(
  p_client_id uuid,
  p_branch_id uuid,
  p_service_id uuid,
  p_amount bigint,
  p_payments jsonb,
  p_wallet_account_id uuid default null,
  p_customer_id uuid default null,
  p_fee bigint default null,
  p_commission bigint default null,
  p_portal_cost bigint default null,
  p_note text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_existing uuid;
  v_shop uuid;
  v_svc public.services;
  v_fee bigint;
  v_comm bigint;
  v_cost bigint;
  v_total bigint;
  v_sign int;
  v_earning bigint;
  v_txn uuid;
begin
  v_existing := private.existing_txn(p_client_id);
  if v_existing is not null then
    return v_existing;
  end if;

  v_shop := private.require_branch(p_branch_id);

  select * into v_svc from public.services where id = p_service_id and shop_id = v_shop and active;
  if not found then
    raise exception 'service % not found', p_service_id;
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;
  if p_customer_id is not null then
    perform private.require_customer(p_customer_id, v_shop);
  end if;

  v_fee := coalesce(p_fee, public.calc_rule(v_svc.fee_rule, p_amount));
  v_comm := coalesce(p_commission, public.calc_rule(v_svc.commission_rule, p_amount));
  v_cost := coalesce(p_portal_cost, public.calc_rule(v_svc.portal_cost_rule, p_amount));
  if v_fee < 0 or v_comm < 0 or v_cost < 0 then
    raise exception 'fee, commission and portal cost cannot be negative';
  end if;

  if v_svc.flow = 'counter_sale' then
    if p_wallet_account_id is not null then
      raise exception 'counter sale takes no wallet account';
    end if;
  else
    if p_wallet_account_id is null then
      raise exception 'wallet account required';
    end if;
    perform private.require_account(p_wallet_account_id, p_branch_id);
  end if;

  case v_svc.flow
    when 'cash_out' then
      if v_fee >= p_amount then
        raise exception 'fee must be less than amount';
      end if;
      v_total := p_amount - v_fee; v_sign := -1; v_earning := v_fee + v_comm; v_cost := 0;
    when 'cash_in', 'pay_through' then
      v_total := p_amount + v_fee; v_sign := 1; v_earning := v_fee + v_comm; v_cost := 0;
    when 'application' then
      v_total := p_amount; v_sign := 1; v_earning := p_amount - v_cost; v_fee := 0; v_comm := 0;
    when 'counter_sale' then
      v_total := p_amount; v_sign := 1; v_earning := p_amount; v_fee := 0; v_comm := 0; v_cost := 0;
  end case;

  v_txn := private.insert_txn(
    p_client_id, v_shop, p_branch_id, 'service', p_amount,
    p_service => p_service_id, p_customer => p_customer_id,
    p_fee => v_fee, p_commission => v_comm, p_portal_cost => v_cost,
    p_earning => v_earning, p_note => p_note
  );

  perform private.apply_payments(
    v_txn, p_branch_id, p_customer_id, p_payments, v_total, v_sign, v_svc.flow <> 'cash_out'
  );

  case v_svc.flow
    when 'cash_out' then
      perform private.add_account_line(v_txn, p_wallet_account_id, p_amount + v_comm);
    when 'cash_in', 'pay_through' then
      perform private.add_account_line(v_txn, p_wallet_account_id, -p_amount + v_comm);
    when 'application' then
      perform private.add_account_line(v_txn, p_wallet_account_id, -v_cost);
    else
      null;
  end case;

  perform private.assert_balanced(v_txn);
  return v_txn;
end $$;

revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.my_shop_id(), private.is_owner(), private.can_access_branch(uuid)
  to authenticated, service_role;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
```

- [ ] **Step 4: Apply and run tests**

Run: `npm run db:reset && npm run test:db -- tests/db/post-service.test.ts`
Expected: all 13 tests PASS.

- [ ] **Step 5: Run the whole suite**

Run: `npm run test:db`
Expected: all tests in all files PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations tests
git commit -m "feat(db): post_service with all five money flows, split payments, udhaar"
```

---

### Task 5: Expense, transfer, udhaar payment, opening balance

**Files:**
- Create: `supabase/migrations/20261019000500_other_entries.sql`
- Test: `tests/db/other-entries.test.ts`

- [ ] **Step 1: Write the failing test `tests/db/other-entries.test.ts`**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { setupShop, must, balanceOf, dueOf, txnRow, insertId, type ShopFixture } from "../helpers";

let f: ShopFixture;
beforeEach(async () => {
  f = await setupShop();
});

const rpc = async (client: ShopFixture["owner"], fn: string, args: Record<string, unknown>) =>
  must(await client.rpc(fn, { p_client_id: randomUUID(), ...args })) as string;

describe("post_expense", () => {
  it("takes money out and counts as negative earning", async () => {
    const id = await rpc(f.staff, "post_expense", {
      p_branch_id: f.branch1, p_account_id: f.cash1, p_amount: 5000, p_note: "Paper",
    });
    expect(await balanceOf(f.staff, f.cash1)).toBe(-5000);
    expect((await txnRow(f.staff, id)).earning).toBe(-5000);
  });

  it("rejects non-positive amounts", async () => {
    const { error } = await f.staff.rpc("post_expense", {
      p_client_id: randomUUID(), p_branch_id: f.branch1, p_account_id: f.cash1, p_amount: 0,
    });
    expect(error?.message).toMatch(/must be positive/);
  });
});

describe("post_transfer", () => {
  it("moves money between own accounts without earning", async () => {
    const id = await rpc(f.staff, "post_transfer", {
      p_from_account_id: f.cash1, p_to_account_id: f.wallet1, p_amount: 100000,
    });
    expect(await balanceOf(f.staff, f.cash1)).toBe(-100000);
    expect(await balanceOf(f.staff, f.wallet1)).toBe(100000);
    expect((await txnRow(f.staff, id)).earning).toBe(0);
  });

  it("staff cannot move money to another branch", async () => {
    const { error } = await f.staff.rpc("post_transfer", {
      p_client_id: randomUUID(), p_from_account_id: f.cash1, p_to_account_id: f.cash2, p_amount: 1000,
    });
    expect(error?.message).toMatch(/no access/);
  });

  it("owner can move cash between branches", async () => {
    await rpc(f.owner, "post_transfer", {
      p_from_account_id: f.cash1, p_to_account_id: f.cash2, p_amount: 1000,
    });
    expect(await balanceOf(f.owner, f.cash1)).toBe(-1000);
    expect(await balanceOf(f.owner, f.cash2)).toBe(1000);
  });

  it("rejects transfer to the same account", async () => {
    const { error } = await f.staff.rpc("post_transfer", {
      p_client_id: randomUUID(), p_from_account_id: f.cash1, p_to_account_id: f.cash1, p_amount: 1000,
    });
    expect(error?.message).toMatch(/same account/);
  });
});

describe("post_udhaar_payment", () => {
  it("reduces the customer's due and adds the money to the account", async () => {
    const customer = await insertId(f.staff, "customers", { shop_id: f.shopId, name: "Ramesh", phone: "9000000001" });
    await rpc(f.staff, "post_service", {
      p_branch_id: f.branch1,
      p_service_id: f.services.xerox,
      p_amount: 2000,
      p_customer_id: customer,
      p_payments: [{ udhaar: true, amount: 2000 }],
    });
    expect(await dueOf(f.staff, customer)).toBe(2000);

    await rpc(f.staff, "post_udhaar_payment", {
      p_branch_id: f.branch1, p_customer_id: customer, p_account_id: f.cash1, p_amount: 1500,
    });
    expect(await dueOf(f.staff, customer)).toBe(500);
    expect(await balanceOf(f.staff, f.cash1)).toBe(1500);
  });
});

describe("post_opening_balance", () => {
  it("owner sets an opening balance", async () => {
    await rpc(f.owner, "post_opening_balance", { p_account_id: f.cash1, p_amount: 1000000 });
    expect(await balanceOf(f.owner, f.cash1)).toBe(1000000);
  });

  it("staff cannot set opening balances", async () => {
    const { error } = await f.staff.rpc("post_opening_balance", {
      p_client_id: randomUUID(), p_account_id: f.cash1, p_amount: 1000000,
    });
    expect(error?.message).toMatch(/owner only/);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:db -- tests/db/other-entries.test.ts`
Expected: FAIL — `Could not find the function public.post_expense`.

- [ ] **Step 3: Create `supabase/migrations/20261019000500_other_entries.sql`**

```sql
create function public.post_expense(
  p_client_id uuid,
  p_branch_id uuid,
  p_account_id uuid,
  p_amount bigint,
  p_note text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_existing uuid;
  v_shop uuid;
  v_txn uuid;
begin
  v_existing := private.existing_txn(p_client_id);
  if v_existing is not null then
    return v_existing;
  end if;
  v_shop := private.require_branch(p_branch_id);
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;
  perform private.require_account(p_account_id, p_branch_id);

  v_txn := private.insert_txn(
    p_client_id, v_shop, p_branch_id, 'expense', p_amount,
    p_earning => -p_amount, p_note => p_note
  );
  perform private.add_account_line(v_txn, p_account_id, -p_amount);
  perform private.assert_balanced(v_txn);
  return v_txn;
end $$;

create function public.post_transfer(
  p_client_id uuid,
  p_from_account_id uuid,
  p_to_account_id uuid,
  p_amount bigint,
  p_note text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_existing uuid;
  v_from public.accounts;
  v_to public.accounts;
  v_txn uuid;
begin
  v_existing := private.existing_txn(p_client_id);
  if v_existing is not null then
    return v_existing;
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;
  if p_from_account_id = p_to_account_id then
    raise exception 'cannot transfer to the same account';
  end if;
  select * into v_from from public.accounts where id = p_from_account_id and active;
  select * into v_to from public.accounts where id = p_to_account_id and active;
  if v_from.id is null or v_to.id is null then
    raise exception 'account not found';
  end if;
  perform private.require_branch(v_from.branch_id);
  perform private.require_branch(v_to.branch_id);

  v_txn := private.insert_txn(
    p_client_id, v_from.shop_id, v_from.branch_id, 'transfer', p_amount, p_note => p_note
  );
  perform private.add_account_line(v_txn, p_from_account_id, -p_amount);
  perform private.add_account_line(v_txn, p_to_account_id, p_amount);
  perform private.assert_balanced(v_txn);
  return v_txn;
end $$;

create function public.post_udhaar_payment(
  p_client_id uuid,
  p_branch_id uuid,
  p_customer_id uuid,
  p_account_id uuid,
  p_amount bigint,
  p_note text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_existing uuid;
  v_shop uuid;
  v_txn uuid;
begin
  v_existing := private.existing_txn(p_client_id);
  if v_existing is not null then
    return v_existing;
  end if;
  v_shop := private.require_branch(p_branch_id);
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;
  perform private.require_account(p_account_id, p_branch_id);
  perform private.require_customer(p_customer_id, v_shop);

  v_txn := private.insert_txn(
    p_client_id, v_shop, p_branch_id, 'udhaar_payment', p_amount,
    p_customer => p_customer_id, p_note => p_note
  );
  perform private.add_account_line(v_txn, p_account_id, p_amount);
  perform private.add_customer_line(v_txn, p_customer_id, p_branch_id, -p_amount);
  perform private.assert_balanced(v_txn);
  return v_txn;
end $$;

create function public.post_opening_balance(
  p_client_id uuid,
  p_account_id uuid,
  p_amount bigint,
  p_note text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_existing uuid;
  v_acct public.accounts;
  v_txn uuid;
begin
  v_existing := private.existing_txn(p_client_id);
  if v_existing is not null then
    return v_existing;
  end if;
  if not private.is_owner() then
    raise exception 'owner only' using errcode = '42501';
  end if;
  select * into v_acct from public.accounts where id = p_account_id;
  if v_acct.id is null then
    raise exception 'account not found';
  end if;
  perform private.require_branch(v_acct.branch_id);
  if p_amount is null or p_amount = 0 then
    raise exception 'amount must not be zero';
  end if;

  -- Opening balance is capital, not earning, so assert_balanced is not applied.
  v_txn := private.insert_txn(
    p_client_id, v_acct.shop_id, v_acct.branch_id, 'opening_balance', p_amount, p_note => p_note
  );
  perform private.add_account_line(v_txn, p_account_id, p_amount);
  return v_txn;
end $$;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
```

- [ ] **Step 4: Apply and run tests**

Run: `npm run db:reset && npm run test:db -- tests/db/other-entries.test.ts`
Expected: all 9 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations tests
git commit -m "feat(db): expense, transfer, udhaar payment and opening balance entries"
```

---

### Task 6: Reversals

**Files:**
- Create: `supabase/migrations/20261019000600_reversal.sql`
- Test: `tests/db/reversal.test.ts`

- [ ] **Step 1: Write the failing test `tests/db/reversal.test.ts`**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { setupShop, must, admin, balanceOf, txnRow, type ShopFixture } from "../helpers";

let f: ShopFixture;
let aepsId: string;

beforeEach(async () => {
  f = await setupShop();
  aepsId = must(
    await f.staff.rpc("post_service", {
      p_client_id: randomUUID(),
      p_branch_id: f.branch1,
      p_service_id: f.services.aeps,
      p_amount: 200000,
      p_wallet_account_id: f.wallet1,
      p_payments: [{ account_id: f.cash1, amount: 198000 }],
    }),
  ) as string;
});

const reverse = (client: ShopFixture["owner"], id: string, reason = "Wrong amount") =>
  client.rpc("reverse_transaction", { p_client_id: randomUUID(), p_transaction_id: id, p_reason: reason });

describe("reverse_transaction", () => {
  it("restores balances and cancels the earning", async () => {
    const revId = must(await reverse(f.staff, aepsId)) as string;
    expect(await balanceOf(f.staff, f.cash1)).toBe(0);
    expect(await balanceOf(f.staff, f.wallet1)).toBe(0);
    const rev = await txnRow(f.staff, revId);
    expect([rev.kind, rev.earning, rev.fee, rev.commission, rev.reversal_of, rev.note]).toEqual([
      "reversal", -2500, -2000, -500, aepsId, "Wrong amount",
    ]);
  });

  it("cannot reverse the same entry twice", async () => {
    must(await reverse(f.staff, aepsId));
    const { error } = await reverse(f.staff, aepsId);
    expect(error?.message).toMatch(/already reversed/);
  });

  it("cannot reverse a reversal", async () => {
    const revId = must(await reverse(f.staff, aepsId)) as string;
    const { error } = await reverse(f.owner, revId);
    expect(error?.message).toMatch(/cannot reverse a reversal/);
  });

  it("requires a reason", async () => {
    const { error } = await reverse(f.staff, aepsId, "  ");
    expect(error?.message).toMatch(/reason required/);
  });

  it("staff cannot reverse an older entry but the owner can", async () => {
    must(await admin.from("transactions").update({ business_date: "2020-01-01" }).eq("id", aepsId));
    const { error } = await reverse(f.staff, aepsId);
    expect(error?.message).toMatch(/today/);
    must(await reverse(f.owner, aepsId));
    expect(await balanceOf(f.owner, f.cash1)).toBe(0);
  });

  it("staff cannot reverse another branch's entry", async () => {
    const otherId = must(
      await f.owner.rpc("post_service", {
        p_client_id: randomUUID(),
        p_branch_id: f.branch2,
        p_service_id: f.services.xerox,
        p_amount: 2000,
        p_payments: [{ account_id: f.cash2, amount: 2000 }],
      }),
    ) as string;
    const { error } = await reverse(f.staff, otherId);
    expect(error?.message).toMatch(/not found|no access/);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:db -- tests/db/reversal.test.ts`
Expected: FAIL — `Could not find the function public.reverse_transaction`.

- [ ] **Step 3: Create `supabase/migrations/20261019000600_reversal.sql`**

```sql
create function public.reverse_transaction(
  p_client_id uuid,
  p_transaction_id uuid,
  p_reason text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_existing uuid;
  v_orig public.transactions;
  v_txn uuid;
begin
  v_existing := private.existing_txn(p_client_id);
  if v_existing is not null then
    return v_existing;
  end if;

  select * into v_orig from public.transactions where id = p_transaction_id;
  if v_orig.id is null then
    raise exception 'transaction not found';
  end if;
  perform private.require_branch(v_orig.branch_id);
  if exists (
    select 1 from public.ledger_lines l
    where l.transaction_id = p_transaction_id
      and l.account_id is not null
      and not private.can_access_branch(l.branch_id)
  ) then
    raise exception 'no access to all accounts in this entry' using errcode = '42501';
  end if;

  if v_orig.kind = 'reversal' then
    raise exception 'cannot reverse a reversal';
  end if;
  if exists (select 1 from public.transactions where reversal_of = p_transaction_id) then
    raise exception 'entry already reversed';
  end if;
  if not private.is_owner() and v_orig.business_date <> private.today() then
    raise exception 'staff can only reverse today''s entries';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'reason required';
  end if;

  v_txn := private.insert_txn(
    p_client_id, v_orig.shop_id, v_orig.branch_id, 'reversal', -v_orig.amount,
    p_service => v_orig.service_id, p_customer => v_orig.customer_id,
    p_fee => -v_orig.fee, p_commission => -v_orig.commission, p_portal_cost => -v_orig.portal_cost,
    p_earning => -v_orig.earning, p_note => trim(p_reason), p_reversal_of => p_transaction_id
  );

  insert into public.ledger_lines (transaction_id, shop_id, branch_id, account_id, customer_id, amount)
  select v_txn, shop_id, branch_id, account_id, customer_id, -amount
  from public.ledger_lines
  where transaction_id = p_transaction_id;

  return v_txn;
end $$;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
```

- [ ] **Step 4: Apply and run tests**

Run: `npm run db:reset && npm run test:db -- tests/db/reversal.test.ts`
Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations tests
git commit -m "feat(db): reverse_transaction with audit trail and same-day rule for staff"
```

---

### Task 7: Day close

**Files:**
- Create: `supabase/migrations/20261019000700_day_close.sql`
- Test: `tests/db/day-close.test.ts`

- [ ] **Step 1: Write the failing test `tests/db/day-close.test.ts`**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { setupShop, must, type ShopFixture } from "../helpers";

let f: ShopFixture;
beforeEach(async () => {
  f = await setupShop();
  must(await f.owner.rpc("post_opening_balance", { p_client_id: randomUUID(), p_account_id: f.cash1, p_amount: 1000000 }));
  // ₹20 xerox in cash, ₹299 recharge paid by UPI (bank must not count as drawer cash)
  must(await f.staff.rpc("post_service", {
    p_client_id: randomUUID(), p_branch_id: f.branch1, p_service_id: f.services.xerox,
    p_amount: 2000, p_payments: [{ account_id: f.cash1, amount: 2000 }],
  }));
  must(await f.staff.rpc("post_service", {
    p_client_id: randomUUID(), p_branch_id: f.branch1, p_service_id: f.services.recharge,
    p_amount: 29900, p_wallet_account_id: f.wallet1, p_payments: [{ account_id: f.bank1, amount: 29900 }],
  }));
});

describe("close_day", () => {
  it("records expected vs counted drawer cash and the difference", async () => {
    const id = must(
      await f.staff.rpc("close_day", { p_branch_id: f.branch1, p_counted_cash: 1001500, p_note: "Short 5" }),
    ) as string;
    const row = must(
      await f.staff.from("day_closes").select("expected_cash, counted_cash, difference, note").eq("id", id).single(),
    );
    expect(row).toEqual({ expected_cash: 1002000, counted_cash: 1001500, difference: -500, note: "Short 5" });
  });

  it("allows only one close per branch per day", async () => {
    must(await f.staff.rpc("close_day", { p_branch_id: f.branch1, p_counted_cash: 1002000 }));
    const { error } = await f.staff.rpc("close_day", { p_branch_id: f.branch1, p_counted_cash: 1002000 });
    expect(error?.message).toMatch(/already closed/);
  });

  it("staff cannot close another branch", async () => {
    const { error } = await f.staff.rpc("close_day", { p_branch_id: f.branch2, p_counted_cash: 0 });
    expect(error?.message).toMatch(/no access/);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:db -- tests/db/day-close.test.ts`
Expected: FAIL — `Could not find the function public.close_day`.

- [ ] **Step 3: Create `supabase/migrations/20261019000700_day_close.sql`**

```sql
create function public.close_day(
  p_branch_id uuid,
  p_counted_cash bigint,
  p_note text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_shop uuid;
  v_expected bigint;
  v_id uuid;
begin
  v_shop := private.require_branch(p_branch_id);
  if p_counted_cash is null or p_counted_cash < 0 then
    raise exception 'counted cash must be zero or more';
  end if;
  if exists (
    select 1 from public.day_closes where branch_id = p_branch_id and business_date = private.today()
  ) then
    raise exception 'day already closed for this branch';
  end if;

  select coalesce(sum(l.amount), 0) into v_expected
  from public.ledger_lines l
  join public.accounts a on a.id = l.account_id
  where a.branch_id = p_branch_id and a.type = 'cash';

  insert into public.day_closes (shop_id, branch_id, business_date, expected_cash, counted_cash, note, closed_by)
  values (v_shop, p_branch_id, private.today(), v_expected, p_counted_cash, p_note, auth.uid())
  returning id into v_id;
  return v_id;
end $$;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
```

- [ ] **Step 4: Apply and run tests**

Run: `npm run db:reset && npm run test:db -- tests/db/day-close.test.ts`
Expected: all 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations tests
git commit -m "feat(db): day close with expected vs counted drawer cash"
```

---

### Task 8: Full verification, generated types, push

**Files:**
- Create: `src/lib/database.types.ts` (generated)

- [ ] **Step 1: Fresh reset + full suite**

Run: `npm run db:reset && npm run test:db`
Expected: 7 test files, all tests PASS (1 + 15 + 6 + 13 + 9 + 6 + 3 = 53).

- [ ] **Step 2: Run Supabase security advisor**

Run: `npx supabase db lint --level warning`
Expected: no errors. A warning about `customer_dues` being a non-`security_invoker` view is expected and deliberate (see comment in migration 200). Any other warning: fix before continuing.

- [ ] **Step 3: Generate TypeScript types for plan 2**

Run:
```bash
mkdir -p src/lib
npm run db:types
```
Expected: `src/lib/database.types.ts` exists and contains `post_service`, `account_balances`, `customer_dues`.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Commit and push**

```bash
git add src/lib/database.types.ts
git commit -m "chore(db): generate TypeScript types from schema"
git push -u origin main
```
Expected: push succeeds; GitHub repo shows the spec, plan, migrations and tests.

---

## Execution notes (2026-10-20)

- **No Docker.** Tests run against the online `project-k-dev` Supabase project (org: warpirate's Org, region ap-south-1). Keys + DB password live in git-ignored `.env.test`. Migrations applied with `npm run db:push` (incremental, no reset).
- `supabase/config.toml` auth settings mirror the dev project; `sign_in_sign_ups` raised to 1000 for the test suite (dev only — never push this config to prod).
- TypeScript 7 removed `baseUrl`; `tsconfig.json` uses `"@/*": ["./src/*"]`.
- Added `20261019000310_rule_validation_nulls.sql`: rules with a missing key (e.g. `{"type":"percent"}`) were accepted because a NULL check passes.
- Added `20261019000800_customer_dues_invoker.sql`: replaced the security-definer `customer_dues` view (Supabase advisor ERROR) with a `security_invoker` view; customer ledger lines are readable shop-wide, account lines stay branch-only. New test: staff sees udhaar taken in another branch.
- Final: 7 files, 54 tests passing; `db lint` clean; advisors show only intended warnings (authenticated users may call posting functions) and "leaked password protection" (enable on prod).
