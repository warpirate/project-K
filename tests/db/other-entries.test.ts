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

describe("customer dues across branches", () => {
  it("staff sees udhaar a customer took in another branch", async () => {
    const customer = await insertId(f.owner, "customers", { shop_id: f.shopId, name: "Gopal", phone: "9000000003" });
    await rpc(f.owner, "post_service", {
      p_branch_id: f.branch2,
      p_service_id: f.services.xerox,
      p_amount: 3000,
      p_customer_id: customer,
      p_payments: [{ udhaar: true, amount: 3000 }],
    });
    expect(await dueOf(f.staff, customer)).toBe(3000);
  });
});

describe("post_udhaar_given", () => {
  it("customer takes cash: due goes up, cash goes down, no earning", async () => {
    const customer = await insertId(f.staff, "customers", { shop_id: f.shopId, name: "Salim", phone: "9000000004" });
    const id = await rpc(f.staff, "post_udhaar_given", {
      p_branch_id: f.branch1, p_customer_id: customer, p_account_id: f.cash1, p_amount: 50000,
    });
    expect(await dueOf(f.staff, customer)).toBe(50000);
    expect(await balanceOf(f.staff, f.cash1)).toBe(-50000);
    const row = await txnRow(f.staff, id);
    expect(row.earning).toBe(0);
    expect(row.kind).toBe("udhaar_given");
  });

  it("hands back an advance", async () => {
    const customer = await insertId(f.staff, "customers", { shop_id: f.shopId, name: "Imran", phone: "9000000005" });
    await rpc(f.staff, "post_udhaar_payment", {
      p_branch_id: f.branch1, p_customer_id: customer, p_account_id: f.cash1, p_amount: 2000,
    });
    expect(await dueOf(f.staff, customer)).toBe(-2000);
    await rpc(f.staff, "post_udhaar_given", {
      p_branch_id: f.branch1, p_customer_id: customer, p_account_id: f.cash1, p_amount: 2000,
    });
    expect(await dueOf(f.staff, customer)).toBe(0);
    expect(await balanceOf(f.staff, f.cash1)).toBe(0);
  });

  it("can be reversed", async () => {
    const customer = await insertId(f.staff, "customers", { shop_id: f.shopId, name: "Raju", phone: "9000000006" });
    const id = await rpc(f.staff, "post_udhaar_given", {
      p_branch_id: f.branch1, p_customer_id: customer, p_account_id: f.cash1, p_amount: 1000,
    });
    await rpc(f.staff, "reverse_transaction", { p_transaction_id: id, p_reason: "wrong person" });
    expect(await dueOf(f.staff, customer)).toBe(0);
    expect(await balanceOf(f.staff, f.cash1)).toBe(0);
  });

  it("staff cannot give from another branch's account", async () => {
    const customer = await insertId(f.staff, "customers", { shop_id: f.shopId, name: "Babu", phone: "9000000007" });
    const { error } = await f.staff.rpc("post_udhaar_given", {
      p_client_id: randomUUID(), p_branch_id: f.branch2, p_customer_id: customer, p_account_id: f.cash2, p_amount: 1000,
    });
    expect(error?.message).toMatch(/no access/);
  });
});
