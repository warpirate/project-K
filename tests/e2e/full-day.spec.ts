import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

const save = (page: Page) => page.getByRole("button", { name: "Save", exact: true }).click();

async function signUpAndSetup(page: Page) {
  await page.goto("/signup");
  await page.getByLabel("Your name").fill("Day Owner");
  await page.getByLabel("Shop name").fill("Full Day Net");
  await page.getByLabel("Email").fill(`day-${randomUUID().slice(0, 8)}@test.local`);
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByLabel("Confirm password").fill("password123");
  await page.getByRole("button", { name: "Create shop account" }).click();
  await page.getByRole("button", { name: /CSC \/ Online centre/ }).click();
  await page.getByRole("button", { name: "Save & continue" }).click(); // Main branch
  await expect(page.getByRole("heading", { name: /Cash drawer, wallets/ })).toBeVisible();
  await page.getByLabel("Opening balance in rupees").nth(0).fill("5000"); // drawer
  await page.getByLabel("Account name").nth(1).fill("SBI UPI"); // the ready "QR" row, renamed
  await page.getByLabel("Account name").nth(2).fill("PayNearby");
  await page.getByLabel("Opening balance in rupees").nth(2).fill("10000");
  await page.getByRole("button", { name: "Save & continue" }).click();
  await expect(page.getByRole("heading", { name: "What do you sell?" })).toBeVisible();
  await page.getByRole("button", { name: "Next: prices" }).click();
  await page.getByRole("button", { name: "Save & continue" }).click();
  await expect(page.getByRole("heading", { name: "Staff logins" })).toBeVisible();
  await page.getByRole("button", { name: "Finish setup" }).click();
  await expect(page.getByRole("heading", { name: "New entry" })).toBeVisible();
}

test("a full day: udhaar, money, close, dashboard, settings, staff", async ({ page, browser }) => {
  await signUpAndSetup(page);

  // Payment buttons start as Cash + bank accounts; the owner turns on Udhaar for this branch
  await expect(page.getByRole("radio", { name: "Udhaar" })).toHaveCount(0);
  await page.goto("/settings?tab=accounts");
  await page.getByRole("checkbox", { name: /Udhaar/ }).check();
  await page.getByRole("button", { name: "Save buttons" }).click();
  await expect(page.getByText("Saved")).toBeVisible();
  await page.goto("/");

  // Xerox ₹50 on udhaar for a new customer
  await page.getByPlaceholder(/Search:/).fill("xerox");
  await page.getByRole("option", { name: "Xerox (1 page)" }).click();
  await page.getByLabel("Amount (₹)").fill("50");
  await page.getByRole("radio", { name: "Udhaar" }).click();
  await page.getByLabel("Customer", { exact: true }).fill("Ramesh");
  await page.getByRole("button", { name: /Add “Ramesh” as new customer/ }).click();
  await page.getByLabel("Phone").fill("9876543210");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("button", { name: "Remove customer" })).toBeVisible();
  await save(page);
  await expect(page.getByRole("status").filter({ hasText: "saved" })).toBeVisible();

  // Udhaar: Ramesh owes ₹50, pays back ₹20
  await page.goto("/udhaar");
  await page.getByRole("button", { name: /Ramesh/ }).click();
  await expect(page.getByText("Ramesh owes you")).toBeVisible();
  await page.getByRole("button", { name: "Other amount, or give more udhaar" }).click();
  await page.getByLabel("Amount received (₹)").fill("20");
  await expect(page.getByText("They will still owe ₹30.00")).toBeVisible();
  await page.getByRole("button", { name: "Save payment" }).click();
  await expect(page.getByText("₹20.00 received from Ramesh")).toBeVisible();
  await expect(page.getByText("₹30.00").filter({ visible: true }).first()).toBeVisible(); // panel balance (list hides on phones)

  // Ramesh also takes ₹200 cash as udhaar (no purchase) → owes ₹230
  await page.getByRole("button", { name: "Other amount, or give more udhaar" }).click();
  await page.getByRole("radio", { name: "Customer takes money" }).click();
  await page.getByLabel("Amount given (₹)").fill("200");
  await expect(page.getByText("They will owe you ₹230.00")).toBeVisible();
  await page.getByRole("button", { name: "Save udhaar given" }).click();
  await expect(page.getByText("₹200.00 given to Ramesh")).toBeVisible();
  await expect(page.getByText("Took money")).toBeVisible();

  // Money: udhaar shows next to balances; expense ₹10, move ₹100 cash → bank, fix PayNearby to ₹9,000
  await page.goto("/money");
  await expect(page.getByRole("link", { name: /People owe you.*₹230.00/ })).toBeVisible();
  await page.getByLabel("Amount (₹)").fill("10");
  await page.getByLabel("What for? (optional)").fill("tea");
  await page.getByRole("button", { name: "Save expense" }).click();
  await expect(page.getByText("Expense ₹10.00 saved")).toBeVisible();
  await page.getByRole("tab", { name: "Move money" }).click();
  await page.getByLabel("Amount (₹)").fill("100");
  await page.getByRole("button", { name: "Move money" }).click();
  await expect(page.getByText(/Moved ₹100.00 from Cash drawer to SBI UPI/)).toBeVisible();
  await page.getByRole("tab", { name: "Fix a balance" }).click();
  await page.getByLabel("Account").selectOption({ label: "PayNearby (now ₹10,000.00)" });
  await page.getByLabel("Real balance now (₹)").fill("9000");
  await expect(page.getByText("-₹1,000.00")).toBeVisible();
  await page.getByRole("button", { name: "Save correct balance" }).click();
  await expect(page.getByText("Balance set to ₹9,000.00")).toBeVisible();
  // drawer: 5000 + 20 (udhaar paid) − 200 (udhaar given) − 10 − 100 = 4710
  await expect(page.getByText("₹4,710.00").first()).toBeVisible();

  // Close day: count exactly what is expected
  await page.goto("/close");
  await expect(page.getByText("Should be in drawer")).toBeVisible();
  await page.getByLabel("Cash you counted (₹)").fill("4710");
  await expect(page.getByText("Matched ✓")).toBeVisible();
  await page.getByRole("button", { name: "Close the day" }).click();
  await expect(page.getByText("Today is closed.")).toBeVisible();

  // Dashboard: profit today = 50 (xerox) − 10 (tea) = 40
  await page.goto("/dashboard");
  const totals = page.getByRole("region", { name: "Totals" });
  await expect(totals.getByText("₹40.00").first()).toBeVisible();
  await expect(page.getByText(/Udhaar outstanding: ₹230.00/)).toBeVisible();
  const csv = await page.request.get("/dashboard/export?period=today&branch=all");
  expect(csv.status()).toBe(200);
  expect(await csv.text()).toContain("Xerox");

  // Settings: give AEPS a ₹10 charge, add a staff login
  await page.goto("/settings");
  await page.getByRole("button", { name: /AEPS cash withdrawal/ }).click();
  await page.getByRole("radiogroup", { name: "Charge type" }).getByRole("radio", { name: "₹" }).click(); // ready list had 1%
  await page.getByLabel("Charge", { exact: true }).fill("10");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: /AEPS cash withdrawal.*charge ₹10.00/ })).toBeVisible();
  // ...then make the charge grow with the amount
  await page.getByRole("button", { name: /AEPS cash withdrawal/ }).click();
  await page.getByRole("radiogroup", { name: "Charge type" }).getByRole("radio", { name: "By amount" }).click();
  await page.getByLabel("Charge up to amount 1").fill("1000");
  await page.getByLabel("Charge for amount 1").fill("10");
  await page.getByRole("radio", { name: "Row 2 percent" }).click();
  await page.getByLabel("Charge above").fill("1");
  await page.getByLabel(/Try an amount/).fill("90");
  await expect(page.getByText("→ Charge ₹10.00")).toBeVisible();
  await page.getByLabel(/Try an amount/).fill("5000");
  await expect(page.getByText("→ Charge ₹50.00")).toBeVisible();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: /AEPS cash withdrawal.*up to ₹1,000.00: ₹10.00, above: 1%/ })).toBeVisible();
  // On New entry the charge is already worked out, and can be changed for this one entry
  await page.goto("/");
  await page.getByPlaceholder(/Search:/).fill("aeps");
  await page.getByRole("option", { name: /AEPS cash withdrawal/ }).click();
  await page.getByLabel("Withdrawal amount (₹)").fill("5000");
  await expect(page.getByLabel("Your charge")).toHaveValue("50");
  await page.getByLabel("Your charge").fill("30");
  await expect(page.getByText("₹4,970.00")).toBeVisible();
  await page.getByRole("button", { name: "use usual ₹50.00" }).click();
  await expect(page.getByText("₹4,950.00")).toBeVisible();
  await page.goto("/settings");
  await page.getByRole("tab", { name: "Staff" }).click();
  const username = `st${randomUUID().slice(0, 6)}`;
  await page.getByLabel("Staff name").fill("Suresh");
  await page.getByLabel("Staff username").fill(username);
  await page.getByLabel("Staff password").fill("suresh123");
  await page.getByRole("button", { name: "Add staff" }).click();
  await expect(page.getByText(`login: ${username}`)).toBeVisible();

  // Staff logs in on another device: no Dashboard/Settings, creates a service the owner must check
  const staffCtx = await browser.newContext();
  const staff = await staffCtx.newPage();
  await staff.goto("/login");
  await staff.getByLabel("Email or username").fill(username);
  await staff.getByLabel("Password").fill("suresh123");
  await staff.getByRole("button", { name: "Log in" }).click();
  await expect(staff.getByRole("heading", { name: "New entry" })).toBeVisible();
  await expect(staff.getByRole("link", { name: "Dashboard" })).toHaveCount(0);
  await staff.goto("/dashboard");
  await expect(staff.getByRole("heading", { name: "New entry" })).toBeVisible();
  await staff.getByPlaceholder(/Search:/).fill("Gift wrap");
  await staff.getByRole("option", { name: /Create/ }).click();
  await staff.getByRole("button", { name: "Create & use" }).click();
  await staff.getByLabel("Amount (₹)").fill("40");
  await save(staff);
  await expect(staff.getByRole("status").filter({ hasText: "saved" })).toBeVisible();
  await staffCtx.close();

  await page.goto("/settings");
  await expect(page.getByRole("tab", { name: "Services (1 new)" })).toBeVisible();
  await expect(page.getByText("New · check")).toBeVisible();

  // Ramesh pays everything back: one tap clears the udhaar
  await page.goto("/udhaar");
  await page.getByRole("button", { name: /Ramesh/ }).click();
  await expect(page.getByText("Got all ₹230.00 back? Tap how:")).toBeVisible();
  await page.getByRole("button", { name: "Cash", exact: true }).click();
  await expect(page.getByText("₹230.00 received from Ramesh (Cash)")).toBeVisible();
  await expect(page.getByText("All clear. Nobody owes anything.")).toBeVisible();
});
