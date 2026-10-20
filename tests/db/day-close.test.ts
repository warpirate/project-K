import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { setupShop, must, type ShopFixture } from "../helpers";

let f: ShopFixture;
beforeEach(async () => {
  f = await setupShop();
  must(await f.owner.rpc("post_opening_balance", { p_client_id: randomUUID(), p_account_id: f.cash1, p_amount: 1000000 }));
  // ₹20 xerox in cash, ₹299 recharge paid by UPI (bank must not count as drawer cash)
  must(await f.staff.rpc("post_service", {
    p_client_id: randomUUID(), p_branch_id: f.branch1, p_service_id: f.services.xerox,
    p_amount: 2000, p_payments: [{ account_id: f.cash1, amount: 2000 }],
  }));
  must(await f.staff.rpc("post_service", {
    p_client_id: randomUUID(), p_branch_id: f.branch1, p_service_id: f.services.recharge,
    p_amount: 29900, p_wallet_account_id: f.wallet1, p_payments: [{ account_id: f.bank1, amount: 29900 }],
  }));
});

describe("close_day", () => {
  it("records expected vs counted drawer cash and the difference", async () => {
    const id = must(
      await f.staff.rpc("close_day", { p_branch_id: f.branch1, p_counted_cash: 1001500, p_note: "Short 5" }),
    ) as string;
    const row = must(
      await f.staff.from("day_closes").select("expected_cash, counted_cash, difference, note").eq("id", id).single(),
    );
    expect(row).toEqual({ expected_cash: 1002000, counted_cash: 1001500, difference: -500, note: "Short 5" });
  });

  it("allows only one close per branch per day", async () => {
    must(await f.staff.rpc("close_day", { p_branch_id: f.branch1, p_counted_cash: 1002000 }));
    const { error } = await f.staff.rpc("close_day", { p_branch_id: f.branch1, p_counted_cash: 1002000 });
    expect(error?.message).toMatch(/already closed/);
  });

  it("staff cannot close another branch", async () => {
    const { error } = await f.staff.rpc("close_day", { p_branch_id: f.branch2, p_counted_cash: 0 });
    expect(error?.message).toMatch(/no access/);
  });
});
