// Withdrawal where the customer pays the charge separately (by QR) instead of it being cut from the cash.
import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const env: Record<string, string> = {};
for (const line of readFileSync(".env.test", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)="?(.*?)"?$/);
  if (m) env[m[1]] = m[2];
}
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, opts);

async function owner(shopName: string, businessType: string | null) {
  const email = `shots-${randomUUID().slice(0, 8)}@test.local`;
  const password = "password123";
  const made = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (made.error) throw made.error;
  const c = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, opts);
  await c.auth.signInWithPassword({ email, password });
  const { data: shopId, error } = await c.rpc("create_shop", { p_shop_name: shopName, p_owner_name: "Aamer" });
  if (error) throw error;
  await admin.from("shops").update({ business_type: businessType }).eq("id", shopId);
  return { c, shopId: shopId as string, email, password };
}

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}


test("charge paid separately", async ({ page }) => {
  test.setTimeout(300_000);
  const { c, shopId, email, password } = await owner("Kaaaz Demo Cafe", "csc");
  const branch = (await c.from("branches").insert({ shop_id: shopId, name: "Main branch" }).select("id").single()).data!.id;
  for (const [name, type, bal] of [["Cash drawer", "cash", 2000000], ["AEPS MITRA", "wallet", 500000], ["AXIS BANK", "bank", 300000], ["Paytm QR", "bank", 0]] as const) {
    const id = (await c.from("accounts").insert({ shop_id: shopId, branch_id: branch, name, type }).select("id").single()).data!.id;
    if (bal) await c.rpc("post_opening_balance", { p_client_id: randomUUID(), p_account_id: id, p_amount: bal });
  }
  await c.from("services").insert({ shop_id: shopId, name: "AEPS withdrawal", flow: "cash_out", fee_rule: { type: "fixed", value: 10000 } });
  await login(page, email, password);
  await page.goto("/");
  await page.getByRole("option", { name: /AEPS withdrawal/ }).click();
  await page.getByLabel("Withdrawal amount (₹)").fill("10000");
  await expect(page.getByText("₹9,900.00")).toBeVisible();
  await page.getByRole("radio", { name: "Paid separately" }).click();
  await page.getByRole("radiogroup", { name: "Charge paid by" }).getByRole("radio", { name: "Paytm QR" }).click();
  await expect(page.getByText("₹10,000.00").first()).toBeVisible();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "charge by Paytm QR" })).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Cash · charge by Paytm QR/)).toBeVisible();
  await page.getByRole("option", { name: /AEPS withdrawal/ }).click();
  await page.getByLabel("Withdrawal amount (₹)").fill("2000");
  await expect(page.getByRole("radio", { name: "Paid separately" })).toHaveAttribute("aria-checked", "true");
  await page.goto("/money");
  // Drawer gave the full ₹10,000; the ₹100 charge landed in Paytm QR
  await expect(page.getByText("₹10,000.00").first()).toBeVisible();
  await expect(page.getByText("₹100.00").first()).toBeVisible();
});
