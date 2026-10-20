# Plan 2a — First Usable Web App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Load the `frontend-design` skill before building screens (Tasks 5–8).

**Goal:** A website the owner and staff can use for real: owner signup, login (owner by email, staff by username), first-time setup wizard, the New Entry form with the service picker (select or create), today's entries with reverse — live on Vercel.

**Architecture:** Next.js 16 App Router + Tailwind 4 at the repo root, talking to Supabase through `@supabase/ssr`. All money writes go through the plan-1 RPCs (`post_service`, `reverse_transaction`, `post_opening_balance`) using the signed-in user's session, so database RLS stays the only gatekeeper. The service-role key is used only in two server actions (create owner account, create staff account) inside a `server-only` module. Pure logic (money parsing, rule preview, service search) lives in `src/lib/*` with unit tests that mirror the SQL behaviour.

**Tech Stack:** Next.js 16.4, React 19, Tailwind CSS 4, @supabase/ssr 0.12, @supabase/supabase-js, cmdk (service picker), lucide-react (icons), Vitest (unit + db), Playwright (one end-to-end happy path), Vercel.

**Spec:** `docs/superpowers/specs/2026-10-19-shop-transaction-manager-design.md` · **Builds on:** plan 1 (database, merged to `main`).

**Not in 2a (→ 2b):** expense / transfer / udhaar-payment forms, balances page, customers & udhaar page, day close, settings pages. **→ 3:** owner dashboard + reports.

---

## Decisions

- **Login identities.** Owner: real email + password. Staff: **username** + password; stored in Supabase Auth as `<username>@staff.projectk.local` (never emailed). The login box accepts either: no `@` → treated as staff username.
- **Account creation without email.** Supabase email confirmation is on and its built-in mailer allows 2 emails/hour, so both owner signup and staff creation use the admin API with `email_confirm: true` from a server action. Owner signup then signs in normally.
- **Current branch.** Staff: their branch. Owner: chosen with a branch switcher, stored in cookie `pk_branch` (defaults to first branch).
- **Money input** in rupees with up to 2 decimals; converted to paise in `src/lib/money.ts`. Display uses `en-IN` grouping (₹1,23,456.00).
- **Fee preview** computed client-side by `src/lib/rules.ts` (TS port of `calc_rule`); the database recomputes on save, and staff overrides are sent as `p_fee`.
- **Wallet memory.** Last wallet used per (branch, service) remembered in `localStorage` (convenience only; wrapped in try/catch).
- **Idempotency.** Each form open generates a `crypto.randomUUID()` client id; a retry after a network error resends the same id.

## File Structure

```
next.config.ts, postcss.config.mjs, tsconfig.json (Next-style), vitest.config.ts (unit + db projects)
playwright.config.ts
.env.local                         # git-ignored: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY
src/proxy.ts                       # session refresh + redirect to /login
src/lib/supabase/client.ts         # browser client
src/lib/supabase/server.ts         # server client (cookies)
src/lib/supabase/proxy.ts          # updateSession
src/lib/supabase/admin.ts          # server-only service-role client
src/lib/money.ts                   # rupees↔paise, formatINR
src/lib/rules.ts                   # calcRule, previewEntry
src/lib/services.ts                # normalizeName, searchServices, findExact
src/lib/staff.ts                   # usernameToEmail, isValidUsername
src/lib/session.ts                 # getAppContext(): user, profile, branches, current branch
src/lib/service-templates.ts       # default services offered in setup wizard
src/app/layout.tsx, globals.css
src/app/login/page.tsx + actions.ts
src/app/signup/page.tsx + actions.ts
src/app/(app)/layout.tsx           # header, branch switcher, sign out
src/app/(app)/page.tsx             # New entry + today's entries
src/app/(app)/entry-form.tsx       # client: the New Entry form
src/app/(app)/service-picker.tsx   # client: cmdk combobox with "+ Create"
src/app/(app)/create-service-dialog.tsx
src/app/(app)/customer-picker.tsx
src/app/(app)/today-list.tsx       # client: today's entries + reverse
src/app/(app)/branch-actions.ts    # server action: set pk_branch cookie
src/app/setup/page.tsx + wizard.tsx + actions.ts
tests/unit/money.test.ts, rules.test.ts, services.test.ts, staff.test.ts
tests/e2e/happy-path.spec.ts
```

---

### Task 1: Next.js + Tailwind scaffold

**Files:** Modify `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`; Create `next.config.ts`, `postcss.config.mjs`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/login/page.tsx` (placeholder), `.env.local`

- [ ] **Step 1: Install**

```bash
npm install next@16.4.2 react@19.3.1 react-dom@19.3.1 @supabase/ssr@0.12.7 cmdk@1.1.1 lucide-react@1.59.0 server-only
npm install -D tailwindcss@4.3.3 @tailwindcss/postcss@4.3.3 @types/react @types/react-dom @playwright/test@1.64.1
```

- [ ] **Step 2: Scripts** — set `package.json` scripts to:

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "db:push": "node scripts/with-db-env.mjs supabase db push --linked --yes",
  "db:types": "supabase gen types typescript --linked > src/lib/database.types.ts",
  "test:unit": "vitest run --project unit",
  "test:db": "vitest run --project db",
  "test:e2e": "playwright test",
  "typecheck": "tsc --noEmit"
}
```

- [ ] **Step 3: `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "src/**/*", "tests/**/*", "*.ts", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```
(If `next dev` rewrites fields on first run, keep its changes.)

- [ ] **Step 4: `vitest.config.ts`** — two projects; the db project keeps reading `.env.test`.

```ts
import { defineConfig } from "vitest/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Reads KEY=value lines from .env.test (git-ignored). Points db tests at the project-k-dev Supabase project. */
function testEnv(): Record<string, string> {
  let text = "";
  try {
    text = readFileSync(".env.test", "utf8");
  } catch {
    return {};
  }
  const env: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)="?(.*?)"?$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)) };

export default defineConfig({
  test: {
    projects: [
      { resolve: { alias }, test: { name: "unit", include: ["tests/unit/**/*.test.ts"] } },
      {
        resolve: { alias },
        test: {
          name: "db",
          include: ["tests/db/**/*.test.ts"],
          env: testEnv(),
          testTimeout: 30000,
          hookTimeout: 60000,
          fileParallelism: false,
        },
      },
    ],
  },
});
```

- [ ] **Step 5: Config files**

`next.config.ts`:
```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

`postcss.config.mjs`:
```js
export default { plugins: { "@tailwindcss/postcss": {} } };
```

`.gitignore` — append:
```gitignore
next-env.d.ts
*.tsbuildinfo
/test-results/
/playwright-report/
.vercel
```

- [ ] **Step 6: `.env.local`** — generated from `.env.test`, never printed:

```bash
node -e '
const fs=require("fs");const e={};
for (const l of fs.readFileSync(".env.test","utf8").split(/\r?\n/)){const m=l.match(/^([A-Z_]+)="?(.*?)"?$/);if(m)e[m[1]]=m[2];}
fs.writeFileSync(".env.local",
`NEXT_PUBLIC_SUPABASE_URL="${e.SUPABASE_URL}"\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="${e.SUPABASE_ANON_KEY}"\nSUPABASE_SERVICE_ROLE_KEY="${e.SUPABASE_SERVICE_ROLE_KEY}"\n`);'
git check-ignore .env.local
```
Expected: prints `.env.local`.

- [ ] **Step 7: Minimal app** — `src/app/globals.css` with `@import "tailwindcss";` plus design tokens (defined in Task 5), `src/app/layout.tsx` (html lang="en", body), `src/app/login/page.tsx` returning a heading "Log in".

- [ ] **Step 8: Verify**

Run: `npm run build && npm run test:unit -- --passWithNoTests && npm run typecheck`
Expected: build succeeds; no type errors.

- [ ] **Step 9: Commit** — `chore(web): scaffold Next.js 16 + Tailwind 4`

---

### Task 2: Pure logic libraries (TDD)

**Files:** Create `src/lib/money.ts`, `src/lib/rules.ts`, `src/lib/services.ts`, `src/lib/staff.ts`; Test `tests/unit/*.test.ts`

- [ ] **Step 1: Write failing tests**

`tests/unit/money.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { rupeesToPaise, formatINR } from "@/lib/money";

describe("rupeesToPaise", () => {
  it("parses whole and decimal rupees", () => {
    expect(rupeesToPaise("20")).toBe(2000);
    expect(rupeesToPaise("20.5")).toBe(2050);
    expect(rupeesToPaise("1,23,456.78")).toBe(12345678);
    expect(rupeesToPaise(" 0.05 ")).toBe(5);
  });
  it("rejects bad input", () => {
    expect(rupeesToPaise("")).toBeNull();
    expect(rupeesToPaise("abc")).toBeNull();
    expect(rupeesToPaise("1.234")).toBeNull();
    expect(rupeesToPaise("-5")).toBeNull();
  });
});

describe("formatINR", () => {
  it("uses Indian grouping and 2 decimals", () => {
    expect(formatINR(12345678)).toBe("₹1,23,456.78");
    expect(formatINR(2000)).toBe("₹20.00");
    expect(formatINR(-19800)).toBe("-₹198.00");
  });
});
```

`tests/unit/rules.test.ts` (mirrors `tests/db/rules.test.ts` + post_service flows):
```ts
import { describe, it, expect } from "vitest";
import { calcRule, previewEntry } from "@/lib/rules";

const slab = { type: "slab", slabs: [{ upto: 100000, value: 1000 }, { upto: null, value: 2000 }] } as const;

describe("calcRule", () => {
  it("matches the database", () => {
    expect(calcRule(null, 50000)).toBe(0);
    expect(calcRule({ type: "fixed", value: 500 }, 200000)).toBe(500);
    expect(calcRule({ type: "percent", bps: 300 }, 29900)).toBe(897);
    expect(calcRule({ type: "percent", bps: 25 }, 199999)).toBe(500);
    expect(calcRule(slab, 100000)).toBe(1000);
    expect(calcRule(slab, 100001)).toBe(2000);
  });
});

describe("previewEntry", () => {
  it("cash_out: customer receives amount minus fee", () => {
    expect(previewEntry("cash_out", 200000, 2000, 500, 0)).toEqual({ customerTotal: 198000, shopPays: true, earning: 2500 });
  });
  it("cash_in: customer pays amount plus fee", () => {
    expect(previewEntry("cash_in", 500000, 5000, 500, 0)).toEqual({ customerTotal: 505000, shopPays: false, earning: 5500 });
  });
  it("pay_through", () => {
    expect(previewEntry("pay_through", 29900, 0, 897, 0)).toEqual({ customerTotal: 29900, shopPays: false, earning: 897 });
  });
  it("application: earning is charge minus portal cost", () => {
    expect(previewEntry("application", 25000, 0, 0, 10700)).toEqual({ customerTotal: 25000, shopPays: false, earning: 14300 });
  });
  it("counter_sale", () => {
    expect(previewEntry("counter_sale", 2000, 0, 0, 0)).toEqual({ customerTotal: 2000, shopPays: false, earning: 2000 });
  });
});
```

`tests/unit/services.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { normalizeName, searchServices, findExact } from "@/lib/services";

const list = [
  { id: "1", name: "Xerox", aliases: ["zerox", "photocopy"] },
  { id: "2", name: "AEPS withdrawal", aliases: [] },
  { id: "3", name: "Mobile recharge", aliases: ["jio", "airtel"] },
];

describe("services search", () => {
  it("normalizes case and spaces", () => {
    expect(normalizeName("  XeRoX  copy ")).toBe("xerox copy");
  });
  it("matches by name substring and alias", () => {
    expect(searchServices(list, "xer").map((s) => s.id)).toEqual(["1"]);
    expect(searchServices(list, "zerox").map((s) => s.id)).toEqual(["1"]);
    expect(searchServices(list, "JIO").map((s) => s.id)).toEqual(["3"]);
  });
  it("ranks prefix matches first", () => {
    const l = [{ id: "a", name: "Colour print", aliases: [] }, { id: "b", name: "Print", aliases: [] }];
    expect(searchServices(l, "print").map((s) => s.id)).toEqual(["b", "a"]);
  });
  it("returns all for empty query", () => {
    expect(searchServices(list, " ")).toHaveLength(3);
  });
  it("finds exact name ignoring case/spaces", () => {
    expect(findExact(list, " xerox ")?.id).toBe("1");
    expect(findExact(list, "xer")).toBeUndefined();
  });
});
```

`tests/unit/staff.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { usernameToEmail, loginIdToEmail, isValidUsername } from "@/lib/staff";

describe("staff identities", () => {
  it("maps usernames to internal emails", () => {
    expect(usernameToEmail("Ravi_1")).toBe("ravi_1@staff.projectk.local");
  });
  it("login id: email passes through, username is mapped", () => {
    expect(loginIdToEmail(" Owner@Gmail.com ")).toBe("owner@gmail.com");
    expect(loginIdToEmail("ravi")).toBe("ravi@staff.projectk.local");
  });
  it("validates usernames", () => {
    expect(isValidUsername("ravi_1")).toBe(true);
    expect(isValidUsername("ab")).toBe(false);
    expect(isValidUsername("has space")).toBe(false);
  });
});
```

- [ ] **Step 2: Run** `npm run test:unit` — Expected: FAIL (modules missing).

- [ ] **Step 3: Implement**

`src/lib/money.ts`:
```ts
/** "1,23,456.78" → 12345678 paise. Returns null for empty, negative, non-numeric or >2 decimals. */
export function rupeesToPaise(input: string): number | null {
  const s = input.replace(/,/g, "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

const fmt = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 12345678 → "₹1,23,456.78"; negatives as "-₹198.00". */
export function formatINR(paise: number): string {
  const sign = paise < 0 ? "-" : "";
  return `${sign}₹${fmt.format(Math.abs(paise) / 100)}`;
}
```

`src/lib/rules.ts`:
```ts
export type Rule =
  | { type: "fixed"; value: number }
  | { type: "percent"; bps: number }
  | { type: "slab"; slabs: ReadonlyArray<{ upto: number | null; value: number }> };

export type Flow = "cash_out" | "cash_in" | "pay_through" | "application" | "counter_sale";

/** TS port of public.calc_rule — keep in sync with supabase/migrations/20261019000300_rules.sql. */
export function calcRule(rule: Rule | null | undefined, amount: number): number {
  if (!rule) return 0;
  switch (rule.type) {
    case "fixed":
      return rule.value;
    case "percent":
      return Math.round((amount * rule.bps) / 10000);
    case "slab": {
      const hit = rule.slabs.find((s) => s.upto === null || amount <= s.upto);
      if (!hit) throw new Error(`no slab matches amount ${amount}`);
      return hit.value;
    }
  }
}

export interface EntryPreview {
  customerTotal: number; // what the customer pays (or receives, when shopPays)
  shopPays: boolean; // true for cash_out: shop hands cash to the customer
  earning: number;
}

/** Mirrors the flow table in post_service. */
export function previewEntry(flow: Flow, amount: number, fee: number, commission: number, portalCost: number): EntryPreview {
  switch (flow) {
    case "cash_out":
      return { customerTotal: amount - fee, shopPays: true, earning: fee + commission };
    case "cash_in":
    case "pay_through":
      return { customerTotal: amount + fee, shopPays: false, earning: fee + commission };
    case "application":
      return { customerTotal: amount, shopPays: false, earning: amount - portalCost };
    case "counter_sale":
      return { customerTotal: amount, shopPays: false, earning: amount };
  }
}
```
Note: `Math.round` rounds .5 up for positives, matching Postgres `round()` on numeric for non-negative amounts.

`src/lib/services.ts`:
```ts
export interface Searchable {
  id: string;
  name: string;
  aliases: string[];
}

export const normalizeName = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Name/alias substring match; names starting with the query rank first, then alphabetical. */
export function searchServices<T extends Searchable>(list: T[], query: string): T[] {
  const q = normalizeName(query);
  if (!q) return [...list].sort((a, b) => a.name.localeCompare(b.name));
  const scored = list
    .map((s) => {
      const name = normalizeName(s.name);
      const aliases = s.aliases.map(normalizeName);
      const score = name.startsWith(q) ? 0 : name.includes(q) ? 1 : aliases.some((a) => a.includes(q)) ? 2 : -1;
      return { s, score };
    })
    .filter((x) => x.score >= 0);
  scored.sort((a, b) => a.score - b.score || a.s.name.localeCompare(b.s.name));
  return scored.map((x) => x.s);
}

export function findExact<T extends Searchable>(list: T[], name: string): T | undefined {
  const n = normalizeName(name);
  return list.find((s) => normalizeName(s.name) === n);
}
```
(Database uniqueness is `lower(trim(name))`; `normalizeName` additionally collapses inner spaces, so the UI is stricter — fine.)

`src/lib/staff.ts`:
```ts
const STAFF_DOMAIN = "staff.projectk.local";

export const isValidUsername = (u: string) => /^[a-z0-9_]{3,30}$/i.test(u);

export const usernameToEmail = (u: string) => `${u.trim().toLowerCase()}@${STAFF_DOMAIN}`;

/** Owner logs in with email, staff with username. */
export function loginIdToEmail(id: string): string {
  const v = id.trim().toLowerCase();
  return v.includes("@") ? v : usernameToEmail(v);
}
```

- [ ] **Step 4: Run** `npm run test:unit` — Expected: all PASS.
- [ ] **Step 5: Commit** — `feat(web): money, rule preview, service search and staff id helpers`

---

### Task 3: Supabase clients, proxy, app context

**Files:** Create `src/lib/supabase/{client,server,proxy,admin}.ts`, `src/proxy.ts`, `src/lib/session.ts`

- [ ] **Step 1:** `client.ts`, `server.ts`, `proxy.ts`, `src/proxy.ts` exactly as the Supabase Next.js SSR guide (Context7 `/supabase/supabase`, "Create Supabase client utility functions" + "Configure proxy.ts"), typed with `Database` from `@/lib/database.types`. In `updateSession`, allow unauthenticated paths `/login` and `/signup`.

- [ ] **Step 2:** `admin.ts`

```ts
import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/** Service-role client. Server actions only; never import from client components. */
export function createAdminClient() {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
```

- [ ] **Step 3:** `session.ts` — `getAppContext()` (server, cached per request with React `cache`):
  - `supabase.auth.getUser()`; no user → `redirect("/login")`.
  - Load own `profiles` row; none → `redirect("/signup?step=shop")` (account exists without shop).
  - Load `branches` (RLS-scoped) ordered by name.
  - Current branch: staff → `profile.branch_id`; owner → cookie `pk_branch` if it is one of the branches, else first branch, else `null`.
  - Returns `{ userId, profile, isOwner, branches, branchId }`.

- [ ] **Step 4:** `npm run typecheck && npm run build` — Expected: pass.
- [ ] **Step 5: Commit** — `feat(web): Supabase SSR clients, session proxy, app context`

---

### Task 4: Signup and login

**Files:** `src/app/signup/{page.tsx,actions.ts}`, `src/app/login/{page.tsx,actions.ts}`

- [ ] **Signup** form: your name, shop name, email, password (min 8), confirm password. Server action `signUpOwner`:
  1. Validate fields (return field errors, keep inputs).
  2. `admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name } })`; "already registered" → error "This email already has an account — log in instead".
  3. Server client `signInWithPassword`.
  4. `rpc("create_shop", { p_shop_name, p_owner_name })`.
  5. `redirect("/setup")`.
- [ ] **Login** form: "Email or username", password. Action: `signInWithPassword({ email: loginIdToEmail(id), password })`; error → "Wrong login or password". Success → `redirect("/")`. Link to signup.
- [ ] **Sign out** action (used in app header): `auth.signOut()` → `/login`.
- [ ] **Verify** manually: `npm run dev`, sign up a test owner, land on `/setup` (placeholder ok), sign out, log back in.
- [ ] **Commit** — `feat(web): owner signup and email/username login`

---

### Task 5: Visual foundation + app shell

Load `frontend-design` skill first.

**Files:** `src/app/globals.css`, `src/app/layout.tsx`, `src/app/(app)/layout.tsx`, `src/app/(app)/branch-actions.ts`, small shared UI in `src/components/ui/*` (button, input, select, dialog, field)

- [ ] Design tokens on `:root` (colors, radius, spacing) with dark mode; Indian-rupee friendly tabular numerals for money (`font-variant-numeric: tabular-nums`).
- [ ] Layouts work at 360px phone width and on a 1366×768 shop PC; big touch targets (≥44px).
- [ ] `(app)/layout.tsx`: calls `getAppContext()`; owner with zero branches → `redirect("/setup")`. Header: shop name, branch (staff: label; owner: switcher posting to `setBranch` action that sets `pk_branch` cookie for 1 year and revalidates), user name, Sign out.
- [ ] **Commit** — `feat(web): design tokens and app shell with branch switcher`

---

### Task 6: Setup wizard

**Files:** `src/app/setup/{page.tsx,wizard.tsx,actions.ts}`, `src/lib/service-templates.ts`

Owner only (staff → redirect `/`). Steps, each saved on "Next" so a refresh resumes at the first incomplete step:

1. **Branches** — list of names (default "Main branch"); add/remove rows. Insert into `branches`.
2. **Accounts per branch** — each branch pre-filled with "Cash drawer" (cash). Add wallets (name e.g. PayNearby, Spice Money) and bank/UPI accounts. Each row has an optional **opening balance** (₹) → `post_opening_balance` (with a stable client id per row so re-submits don't double post).
3. **Services** — checklist from `service-templates.ts`, all pre-ticked, each row editable: name, flow (plain words: "Cash withdrawal", "Money transfer / deposit", "Recharge / bill payment", "Online application", "Counter sale"), fee (₹ fixed or %), commission (₹ fixed or %), portal cost (applications). Plus "Add another". Insert ticked ones into `services`.
4. **Staff** — rows: name, username, password, branch. Server action `createStaff` (owner check via `getAppContext().isOwner`, then admin `createUser` with `usernameToEmail`, then admin insert `profiles` with role staff). Username taken → row error. Step can be skipped.
5. **Done** → `/`.

`src/lib/service-templates.ts` (fees default 0; owner edits):
```ts
import type { Flow } from "@/lib/rules";

export interface ServiceTemplate {
  name: string;
  flow: Flow;
  category: string;
  aliases: string[];
}

export const SERVICE_TEMPLATES: ServiceTemplate[] = [
  { name: "AEPS withdrawal", flow: "cash_out", category: "banking", aliases: ["aeps", "withdraw", "cash withdrawal"] },
  { name: "Money transfer", flow: "cash_in", category: "banking", aliases: ["dmt", "transfer", "send money"] },
  { name: "Cash deposit", flow: "cash_in", category: "banking", aliases: ["deposit"] },
  { name: "Mobile recharge", flow: "pay_through", category: "recharge", aliases: ["recharge", "jio", "airtel", "vi", "bsnl"] },
  { name: "DTH recharge", flow: "pay_through", category: "recharge", aliases: ["dth", "tata play", "dish"] },
  { name: "Electricity bill", flow: "pay_through", category: "bill", aliases: ["current bill", "power bill"] },
  { name: "PAN card application", flow: "application", category: "application", aliases: ["pan"] },
  { name: "Aadhaar update", flow: "application", category: "application", aliases: ["aadhar", "aadhaar"] },
  { name: "Xerox", flow: "counter_sale", category: "counter", aliases: ["zerox", "photocopy", "copy"] },
  { name: "Print", flow: "counter_sale", category: "counter", aliases: ["printout", "colour print"] },
  { name: "Lamination", flow: "counter_sale", category: "counter", aliases: ["laminate"] },
  { name: "Passport photo", flow: "counter_sale", category: "counter", aliases: ["photo"] },
];
```

- [ ] **Verify** manually: complete wizard for a test shop with 2 branches; staff user can log in with username.
- [ ] **Commit** — `feat(web): first-time setup wizard`

---

### Task 7: New Entry form with service picker

**Files:** `src/app/(app)/{page.tsx,entry-form.tsx,service-picker.tsx,create-service-dialog.tsx,customer-picker.tsx}`

`page.tsx` (server): `getAppContext()`; loads active services (`id,name,flow,aliases,fee_rule,commission_rule,portal_cost_rule`), the branch's active accounts (`id,name,type`), renders `<EntryForm>` and `<TodayList>`. Owner without a branch selected → prompt to pick one.

**Service picker** (`cmdk`):
- Input autofocused on page load; typing filters with `searchServices`.
- If `findExact(list, query)` is undefined and query is non-empty, last option is **+ Create "<query>"** → opens `CreateServiceDialog` pre-filled with the name (fields: name, flow in plain words, fee, commission, portal cost). Insert into `services` via browser client; on unique-violation show "Already exists" and select the existing one. New service is added to the list and selected.
- Keyboard: ↑/↓, Enter selects; works with mouse/touch.

**Form fields after a service is chosen:**
- Amount (₹, numeric keypad on phone: `inputMode="decimal"`).
- Wallet (only for non-counter flows): select of the branch's wallet/bank accounts; default = remembered last wallet for this service, else first wallet.
- Fee / commission / portal cost: shown pre-calculated from rules (`calcRule`), editable; edited value sent as override.
- Summary line from `previewEntry`: e.g. "Give customer ₹1,980.00 · Shop earns ₹25.00" or "Collect ₹5,050.00 · Shop earns ₹55.00".
- Payment: buttons **Cash** (default) · **UPI** · **Udhaar** · **Split**. Cash → branch cash account; UPI → choose bank account (default first bank); Udhaar → requires customer; Split → rows of (Cash/UPI/Udhaar, amount) that must total `customerTotal` (live remaining shown). Cash withdrawal (`cash_out`) hides Udhaar/Split-with-udhaar.
- Customer (optional; required for udhaar): `CustomerPicker` searching `customers` by name/phone; "+ Add customer" inline (name, phone).
- Note (optional).
- **Save** (Enter key submits): calls `rpc("post_service", …)` with the form's client id. On success: toast "Saved", form resets (keeps service list, new client id), today's list refreshes (`router.refresh()`). On network error: "Not saved — check internet" banner, inputs kept, Retry uses the same client id. On database error: show its message in plain words.

- [ ] **Verify** manually: post one of each flow; balances in Supabase match the plan-1 tests; create a new service from the picker; typing "xerox" when Xerox exists shows it and no Create option.
- [ ] **Commit** — `feat(web): New Entry form with service picker and inline create`

---

### Task 8: Today's entries with reverse

**Files:** `src/app/(app)/today-list.tsx`, update `page.tsx`

- [ ] Server loads today's (`business_date` = today in Asia/Kolkata) transactions for the current branch, newest first, joined with service name and customer name; shows time, service, amount, payment summary, earning, who entered it. Reversed entries shown struck-through with the reversal reason; reversal rows themselves shown as "Reversal of …".
- [ ] Row action **Reverse** → dialog asking reason (required) → `rpc("reverse_transaction")` → refresh.
- [ ] Footer: today's total earning for the branch.
- [ ] **Commit** — `feat(web): today's entries list with reverse`

---

### Task 9: End-to-end happy path

**Files:** `playwright.config.ts`, `tests/e2e/happy-path.spec.ts`

- [ ] `playwright.config.ts`: `webServer: { command: "npm run dev", url: "http://localhost:3000", reuseExistingServer: true }`, Chromium only, baseURL `http://localhost:3000`.
- [ ] Spec: sign up owner with random email → wizard: 1 branch, cash + one wallet with opening balance ₹10,000, keep templates with Xerox, skip staff → New Entry: type "xer", pick Xerox, amount 20, Cash, Save → today's list shows "Xerox" "₹20.00" → Reverse with reason "test" → row shows reversed; also type "Binding" → "+ Create" → create as counter sale → save ₹30 entry → listed.
- [ ] Run: `npx playwright install chromium && npm run test:e2e` — Expected: PASS.
- [ ] **Commit** — `test(web): end-to-end happy path`

---

### Task 10: Production Supabase + Vercel deploy

- [ ] **Prod database:** create `project-k-prod` (warpirate's Org, ap-south-1) with a generated DB password saved to git-ignored `.env.prod`. Link, `supabase db push` all migrations, re-link dev afterwards. Do **not** push `config.toml` to prod. In prod dashboard settings: enable leaked-password protection if available on the plan; site URL = Vercel URL.
- [ ] **Vercel:** user runs `npx vercel login` once. Then `npx vercel link` (new project `project-k`), add env vars for Production: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (prod values, via `vercel env add` reading from `.env.prod`, never echoed). Preview env → dev values.
- [ ] `npx vercel --prod` → open the URL, sign up the real shop, run the wizard.
- [ ] Connect the GitHub repo in Vercel so every push to `main` deploys.
- [ ] **Commit** any config; push `main` to GitHub (with user's OK).
