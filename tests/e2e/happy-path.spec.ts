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

  // Wizard: what business → CSC ready list
  await expect(page.getByRole("heading", { name: "What's your business?" })).toBeVisible();
  await page.getByRole("button", { name: /CSC \/ Online centre/ }).click();

  // Branches (default "Main branch")
  await expect(page.getByRole("heading", { name: "Your branches" })).toBeVisible();
  await page.getByRole("button", { name: "Save & continue" }).click();

  // Accounts: cash drawer and QR prefilled; rename QR to the bank, name the wallet and give it an opening balance
  await expect(page.getByRole("heading", { name: /Cash drawer, wallets/ })).toBeVisible();
  const names = page.getByLabel("Account name");
  await expect(names.nth(1)).toHaveValue("QR");
  await names.nth(1).fill("SBI UPI");
  await names.nth(2).fill("PayNearby");
  await page.getByLabel("Opening balance in rupees").nth(2).fill("10000");
  await page.getByRole("button", { name: "Save & continue" }).click();

  // Services: keep the CSC ready list as it is
  await expect(page.getByRole("heading", { name: "What do you sell?" })).toBeVisible();
  await page.getByRole("button", { name: "Next: prices" }).click();
  await expect(page.getByLabel("Price of Xerox (1 page)")).toHaveValue("2");
  await page.getByRole("button", { name: "Save & continue" }).click();

  // Staff: skip
  await expect(page.getByRole("heading", { name: "Staff logins" })).toBeVisible();
  await page.getByRole("button", { name: "Finish setup" }).click();

  // New entry: Xerox ₹20 cash (usual price ₹2 is filled in)
  await expect(page.getByRole("heading", { name: "New entry" })).toBeVisible();
  await page.getByPlaceholder(/Search:/).fill("xer");
  await expect(page.getByRole("option", { name: "Xerox (1 page)" })).toBeVisible();
  await expect(page.getByRole("option", { name: /Create/ })).toHaveCount(0);
  await page.getByRole("option", { name: "Xerox (1 page)" }).click();
  await expect(page.getByLabel("Amount (₹)")).toHaveValue("2");
  await page.getByLabel("Amount (₹)").fill("20");
  await expect(page.getByText("Take from customer")).toBeVisible();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "saved" })).toBeVisible();
  const today = page.locator("section").filter({ has: page.getByRole("heading", { name: "Today" }) });
  await expect(today.getByText("Xerox (1 page)")).toBeVisible();
  await expect(today.getByText("₹20.00").first()).toBeVisible();

  // Create a new service from the picker and use it
  await page.getByPlaceholder(/Search:/).fill("Binding");
  await page.getByRole("option", { name: /Create/ }).click();
  await expect(page.getByRole("heading", { name: "New service" })).toBeVisible();
  await page.getByRole("button", { name: "Create & use" }).click();
  await page.getByLabel("Amount (₹)").fill("30");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(today.getByText("Binding")).toBeVisible();

  // AEPS withdrawal ₹500 (ready list charge 1%) through the wallet
  await page.getByPlaceholder(/Search:/).fill("aeps");
  await page.getByRole("option", { name: /AEPS cash withdrawal/ }).click();
  await page.getByLabel("Withdrawal amount (₹)").fill("500");
  await expect(page.getByText("Give customer")).toBeVisible();
  await expect(page.getByText("How do you give the money?")).toBeVisible();
  await expect(page.getByRole("radio", { name: "Udhaar" })).toHaveCount(0);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(today.getByText("AEPS cash withdrawal")).toBeVisible();

  // UPI to cash: customer sends ₹1000 by UPI, takes cash
  await page.getByPlaceholder(/Search:/).fill("phonepe");
  await page.getByRole("option", { name: /UPI to cash/ }).click();
  await page.getByLabel("Withdrawal amount (₹)").fill("1000");
  await expect(page.getByLabel("Money comes into")).toHaveValue(/.+/);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(today.getByText("UPI to cash")).toBeVisible();

  // Recharge ₹299, customer sends ₹500 by UPI, gets ₹201 change
  await page.getByPlaceholder(/Search:/).fill("recharge");
  await page.getByRole("option", { name: "Mobile recharge", exact: true }).click();
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
  const xeroxRow = today.locator("li").filter({ hasText: "Xerox (1 page)" }).first();
  await xeroxRow.getByRole("button", { name: /^Reverse Xerox/ }).click();
  await page.getByLabel("Reason").fill("test reversal");
  await page.getByRole("dialog").getByRole("button", { name: "Reverse", exact: true }).click();
  await expect(today.getByText("Reversed: test reversal")).toBeVisible();
  await expect(today.getByText("Reversal: Xerox (1 page)")).toHaveCount(0); // shown once, as the struck-through original
});
