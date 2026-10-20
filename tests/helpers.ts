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
