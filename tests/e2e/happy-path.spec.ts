import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

test("owner signs up, sets up the shop, records and reverses entries", async ({ page }) => {
  const email = `owner-${randomUUID().slice(0, 8)}@test.local`;

  // Signup
  await page.goto("/signup");
  await page.getByLabel("Your name").fill("Test Owner");
  await page.getByLabel("Shop name").fill("E2E Net Center");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByLabel("Confirm password").fill("password123");
  await page.getByRole("button", { name: "Create shop account" }).click();

  // Wizard: branches (default "Main branch")
  await expect(page.getByRole("heading", { name: "Your branches" })).toBeVisible();
  await page.getByRole("button", { name: "Save & continue" }).click();

  // Accounts: cash drawer prefilled; name the wallet, give it an opening balance; drop the empty bank row
  await expect(page.getByRole("heading", { name: /Cash drawer, wallets/ })).toBeVisible();
  const names = page.getByLabel("Account name");
  await names.nth(1).fill("PayNearby");
  await page.getByLabel("Opening balance in rupees").nth(1).fill("10000");
  await names.nth(2).fill("SBI UPI");
  await page.getByRole("button", { name: "Save & continue" }).click();

  // Services: keep templates
  await expect(page.getByRole("heading", { name: "Services you offer" })).toBeVisible();
  await page.getByRole("button", { name: "Save & continue" }).click();

  // Staff: skip
  await expect(page.getByRole("heading", { name: "Staff logins" })).toBeVisible();
  await page.getByRole("button", { name: "Finish setup" }).click();

  // New entry: Xerox ₹20 cash
  await expect(page.getByRole("heading", { name: "New entry" })).toBeVisible();
  await page.getByPlaceholder(/Type a service/).fill("xer");
  await expect(page.getByRole("option", { name: /Xerox/ })).toBeVisible();
  await expect(page.getByRole("option", { name: /Create/ })).toHaveCount(0);
  await page.getByRole("option", { name: /Xerox/ }).click();
  await page.getByLabel("Amount (₹)").fill("20");
  await expect(page.getByText("Take from customer")).toBeVisible();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "saved" })).toBeVisible();
  const today = page.locator("section").filter({ has: page.getByRole("heading", { name: "Today" }) });
  await expect(today.getByText("Xerox")).toBeVisible();
  await expect(today.getByText("₹20.00").first()).toBeVisible();

  // Create a new service from the picker and use it
  await page.getByPlaceholder(/Type a service/).fill("Binding");
  await page.getByRole("option", { name: /Create/ }).click();
  await expect(page.getByRole("heading", { name: "New service" })).toBeVisible();
  await page.getByRole("button", { name: "Create & use" }).click();
  await page.getByLabel("Amount (₹)").fill("30");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(today.getByText("Binding")).toBeVisible();

  // AEPS withdrawal ₹500 (fee 0 by default) through the wallet
  await page.getByPlaceholder(/Type a service/).fill("aeps");
  await page.getByRole("option", { name: /AEPS withdrawal/ }).click();
  await page.getByLabel("Withdrawal amount (₹)").fill("500");
  await expect(page.getByText("Give customer")).toBeVisible();
  await expect(page.getByText("How do you give the money?")).toBeVisible();
  await expect(page.getByRole("radio", { name: "Udhaar" })).toHaveCount(0);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(today.getByText("AEPS withdrawal")).toBeVisible();

  // UPI to cash: customer sends ₹1000 by UPI, takes cash
  await page.getByPlaceholder(/Type a service/).fill("phonepe");
  await page.getByRole("option", { name: /UPI to cash/ }).click();
  await page.getByLabel("Withdrawal amount (₹)").fill("1000");
  await expect(page.getByLabel("Money comes into")).toHaveValue(/.+/);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(today.getByText("UPI to cash")).toBeVisible();

  // Recharge ₹299, customer sends ₹500 by UPI, gets ₹201 change
  await page.getByPlaceholder(/Type a service/).fill("recharge");
  await page.getByRole("option", { name: /Mobile recharge/ }).click();
  await page.getByLabel("Recharge / bill amount (₹)").fill("299");
  await page.getByRole("radio", { name: "SBI UPI" }).click(); // each bank/UPI account is its own button
  await page.getByRole("button", { name: "Customer sent extra?" }).click();
  await page.getByLabel("Customer sent by UPI (₹)").fill("500");
  await expect(page.getByText("Give back in cash")).toBeVisible();
  await expect(page.getByText("₹201.00")).toBeVisible();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "give back ₹201.00" })).toBeVisible();
  await expect(today.getByText(/change given/)).toBeVisible();

  // Reverse the xerox entry
  const xeroxRow = today.locator("li").filter({ hasText: "Xerox" }).first();
  await xeroxRow.getByRole("button", { name: /^Reverse Xerox/ }).click();
  await page.getByLabel("Reason").fill("test reversal");
  await page.getByRole("dialog").getByRole("button", { name: "Reverse", exact: true }).click();
  await expect(today.getByText("Reversed: test reversal")).toBeVisible();
  await expect(today.getByText("Reversal: Xerox")).toHaveCount(0); // shown once, as the struck-through original
});
