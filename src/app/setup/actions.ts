"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppContext } from "@/lib/session";
import { isValidUsername, usernameToEmail } from "@/lib/staff";
import type { Flow, Rule } from "@/lib/rules";
import type { Json } from "@/lib/database.types";

export type ActionResult = { ok: true } | { ok: false; error: string; rowErrors?: Record<number, string> };

async function ownerContext() {
  const ctx = await getAppContext();
  if (!ctx.isOwner) throw new Error("Only the owner can do this");
  return ctx;
}

export async function saveBranches(names: string[]): Promise<ActionResult> {
  const ctx = await ownerContext();
  const clean = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  const existing = new Set(ctx.branches.map((b) => b.name.trim().toLowerCase()));
  const toAdd = clean.filter((n) => !existing.has(n.toLowerCase()));
  if (ctx.branches.length === 0 && toAdd.length === 0) return { ok: false, error: "Add at least one branch." };
  if (toAdd.length) {
    const supabase = await createClient();
    const { error } = await supabase
      .from("branches")
      .insert(toAdd.map((name) => ({ shop_id: ctx.profile.shop_id, name })));
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/setup");
  return { ok: true };
}

export interface AccountRow {
  branchId: string;
  name: string;
  type: "cash" | "wallet" | "bank";
  openingPaise: number;
  clientId: string;
}

export async function saveAccounts(rows: AccountRow[]): Promise<ActionResult> {
  const ctx = await ownerContext();
  const supabase = await createClient();
  const rowErrors: Record<number, string> = {};
  for (const [i, row] of rows.entries()) {
    if (!row.name.trim()) continue;
    const { data, error } = await supabase
      .from("accounts")
      .insert({ shop_id: ctx.profile.shop_id, branch_id: row.branchId, name: row.name.trim(), type: row.type })
      .select("id")
      .single();
    if (error) {
      rowErrors[i] = /duplicate|unique/i.test(error.message) ? "This branch already has an account with this name" : error.message;
      continue;
    }
    if (row.openingPaise !== 0) {
      const ob = await supabase.rpc("post_opening_balance", {
        p_client_id: row.clientId,
        p_account_id: data.id,
        p_amount: row.openingPaise,
      });
      if (ob.error) rowErrors[i] = `Account saved, opening balance failed: ${ob.error.message}`;
    }
  }
  revalidatePath("/setup");
  return Object.keys(rowErrors).length ? { ok: false, error: "Some rows were not saved.", rowErrors } : { ok: true };
}

export interface ServiceRow {
  name: string;
  flow: Flow;
  category: string;
  aliases: string[];
  feeRule: Rule | null;
  commissionRule: Rule | null;
  portalCostRule: Rule | null;
}

export async function saveServices(rows: ServiceRow[]): Promise<ActionResult> {
  const ctx = await ownerContext();
  const supabase = await createClient();
  const rowErrors: Record<number, string> = {};
  for (const [i, row] of rows.entries()) {
    const { error } = await supabase.from("services").insert({
      shop_id: ctx.profile.shop_id,
      name: row.name.trim(),
      flow: row.flow,
      category: row.category,
      aliases: row.aliases,
      fee_rule: row.feeRule as Json,
      commission_rule: row.commissionRule as Json,
      portal_cost_rule: row.portalCostRule as Json,
    });
    if (error && !/duplicate|unique/i.test(error.message)) rowErrors[i] = error.message;
  }
  revalidatePath("/setup");
  return Object.keys(rowErrors).length ? { ok: false, error: "Some services were not saved.", rowErrors } : { ok: true };
}

export interface StaffRow {
  name: string;
  username: string;
  password: string;
  branchId: string;
}

/** Creates staff logins (username → internal email, no email is sent). */
export async function createStaff(rows: StaffRow[]): Promise<ActionResult> {
  const ctx = await ownerContext();
  const admin = createAdminClient();
  const rowErrors: Record<number, string> = {};
  for (const [i, row] of rows.entries()) {
    if (!row.name.trim() && !row.username.trim()) continue;
    if (!row.name.trim()) {
      rowErrors[i] = "Enter a name";
      continue;
    }
    if (!isValidUsername(row.username)) {
      rowErrors[i] = "Username: 3–30 letters, numbers or _";
      continue;
    }
    if (row.password.length < 6) {
      rowErrors[i] = "Password: at least 6 characters";
      continue;
    }
    if (!ctx.branches.some((b) => b.id === row.branchId)) {
      rowErrors[i] = "Pick a branch";
      continue;
    }
    const created = await admin.auth.admin.createUser({
      email: usernameToEmail(row.username),
      password: row.password,
      email_confirm: true,
      user_metadata: { name: row.name.trim() },
    });
    if (created.error) {
      rowErrors[i] = /already|registered|exists/i.test(created.error.message)
        ? "Username taken, try another"
        : created.error.message;
      continue;
    }
    const { error } = await admin.from("profiles").insert({
      user_id: created.data.user.id,
      shop_id: ctx.profile.shop_id,
      role: "staff",
      branch_id: row.branchId,
      name: row.name.trim(),
    });
    if (error) {
      await admin.auth.admin.deleteUser(created.data.user.id); // don't leave a login with no shop
      rowErrors[i] = error.message;
    }
  }
  revalidatePath("/setup");
  return Object.keys(rowErrors).length ? { ok: false, error: "Some staff were not added.", rowErrors } : { ok: true };
}
