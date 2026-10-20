import { describe, it, expect, beforeAll } from "vitest";
import { randomUUID } from "node:crypto";
import { setupShop, must, type ShopFixture } from "../helpers";

const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
let f: ShopFixture;

beforeAll(async () => {
  f = await setupShop();
  const post = (args: Record<string, unknown>) =>
    f.staff.rpc("post_service", { p_client_id: randomUUID(), p_branch_id: f.branch1, ...args });
  must(await post({ p_service_id: f.services.aeps, p_amount: 200000, p_wallet_account_id: f.wallet1, p_payments: [{ account_id: f.cash1, amount: 198000 }] }));
  const xerox = must(await post({ p_service_id: f.services.xerox, p_amount: 2000, p_payments: [{ account_id: f.cash1, amount: 2000 }] })) as string;
  must(await f.staff.rpc("post_expense", { p_client_id: randomUUID(), p_branch_id: f.branch1, p_account_id: f.cash1, p_amount: 500, p_note: "tea" }));
  must(await f.staff.rpc("reverse_transaction", { p_client_id: randomUUID(), p_transaction_id: xerox, p_reason: "wrong" }));
  // Branch 2: owner sells a ₹30 xerox there
  must(await f.owner.rpc("post_service", { p_client_id: randomUUID(), p_branch_id: f.branch2, p_service_id: f.services.xerox, p_amount: 3000, p_payments: [{ account_id: f.cash2, amount: 3000 }] }));
});

describe("report_totals", () => {
  it("adds up one branch; reversals cancel out", async () => {
    const [row] = must(await f.owner.rpc("report_totals", { p_from: today, p_to: today, p_branch: f.branch1 })) as Record<string, number>[];
    expect(row).toEqual({ profit: 2000, charges: 2000, commission: 500, expenses: 500, entries: 1 });
  });

  it("covers all branches when branch is null", async () => {
    const [row] = must(await f.owner.rpc("report_totals", { p_from: today, p_to: today })) as Record<string, number>[];
    expect(row.profit).toBe(5000);
    expect(row.entries).toBe(2);
  });

  it("is empty outside the period", async () => {
    const [row] = must(await f.owner.rpc("report_totals", { p_from: "2020-01-01", p_to: "2020-01-31" })) as Record<string, number>[];
    expect(row).toEqual({ profit: 0, charges: 0, commission: 0, expenses: 0, entries: 0 });
  });

  it("staff only see their own branch", async () => {
    const [row] = must(await f.staff.rpc("report_totals", { p_from: today, p_to: today })) as Record<string, number>[];
    expect(row.profit).toBe(2000);
  });
});

describe("report_groups", () => {
  const groups = async (by: string, branch?: string) =>
    (must(await f.owner.rpc("report_groups", { p_from: today, p_to: today, p_group: by, p_branch: branch })) as {
      key: string;
      label: string;
      profit: number;
      entries: number;
    }[]).map((g) => ({ label: g.label, profit: g.profit, entries: g.entries }));

  it("by service, with expenses as their own line", async () => {
    expect(await groups("service", f.branch1)).toEqual(
      expect.arrayContaining([
        { label: "AEPS withdrawal", profit: 2500, entries: 1 },
        { label: "Xerox", profit: 0, entries: 0 },
        { label: "Expenses", profit: -500, entries: 0 },
      ]),
    );
  });

  it("by branch", async () => {
    expect(await groups("branch")).toEqual(
      expect.arrayContaining([
        { label: "Branch 1", profit: 2000, entries: 1 },
        { label: "Branch 2", profit: 3000, entries: 1 },
      ]),
    );
  });

  it("by staff credits the person who made the entry", async () => {
    expect(await groups("staff")).toEqual(
      expect.arrayContaining([
        { label: "Staff 1", profit: 2000, entries: 1 },
        { label: "Owner", profit: 3000, entries: 1 },
      ]),
    );
  });

  it("by day", async () => {
    expect(await groups("day")).toEqual([{ label: today, profit: 5000, entries: 2 }]);
  });
});
