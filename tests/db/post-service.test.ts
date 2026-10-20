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

describe("change given back", () => {
  it("customer sends more by UPI and takes change in cash", async () => {
    await postService({
      p_service_id: f.services.recharge,
      p_amount: 29900,
      p_wallet_account_id: f.wallet1,
      p_payments: [
        { account_id: f.bank1, amount: 50000 },
        { account_id: f.cash1, amount: -20100 },
      ],
    });
    expect(await balanceOf(f.staff, f.bank1)).toBe(50000);
    expect(await balanceOf(f.staff, f.cash1)).toBe(-20100);
  });

  it("udhaar parts must still be positive", async () => {
    const customer = await insertId(f.staff, "customers", { shop_id: f.shopId, name: "Kiran", phone: "9000000009" });
    const { error } = await f.staff.rpc("post_service", {
      p_client_id: randomUUID(),
      p_branch_id: f.branch1,
      p_service_id: f.services.xerox,
      p_amount: 2000,
      p_customer_id: customer,
      p_payments: [
        { account_id: f.cash1, amount: 3000 },
        { udhaar: true, amount: -1000 },
      ],
    });
    expect(error?.message).toMatch(/udhaar amount must be positive/);
  });
});
