import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { setupShop, must, admin, balanceOf, txnRow, type ShopFixture } from "../helpers";

let f: ShopFixture;
let aepsId: string;

beforeEach(async () => {
  f = await setupShop();
  aepsId = must(
    await f.staff.rpc("post_service", {
      p_client_id: randomUUID(),
      p_branch_id: f.branch1,
      p_service_id: f.services.aeps,
      p_amount: 200000,
      p_wallet_account_id: f.wallet1,
      p_payments: [{ account_id: f.cash1, amount: 198000 }],
    }),
  ) as string;
});

const reverse = (client: ShopFixture["owner"], id: string, reason = "Wrong amount") =>
  client.rpc("reverse_transaction", { p_client_id: randomUUID(), p_transaction_id: id, p_reason: reason });

describe("reverse_transaction", () => {
  it("restores balances and cancels the earning", async () => {
    const revId = must(await reverse(f.staff, aepsId)) as string;
    expect(await balanceOf(f.staff, f.cash1)).toBe(0);
    expect(await balanceOf(f.staff, f.wallet1)).toBe(0);
    const rev = await txnRow(f.staff, revId);
    expect([rev.kind, rev.earning, rev.fee, rev.commission, rev.reversal_of, rev.note]).toEqual([
      "reversal", -2500, -2000, -500, aepsId, "Wrong amount",
    ]);
  });

  it("cannot reverse the same entry twice", async () => {
    must(await reverse(f.staff, aepsId));
    const { error } = await reverse(f.staff, aepsId);
    expect(error?.message).toMatch(/already reversed/);
  });

  it("cannot reverse a reversal", async () => {
    const revId = must(await reverse(f.staff, aepsId)) as string;
    const { error } = await reverse(f.owner, revId);
    expect(error?.message).toMatch(/cannot reverse a reversal/);
  });

  it("requires a reason", async () => {
    const { error } = await reverse(f.staff, aepsId, "  ");
    expect(error?.message).toMatch(/reason required/);
  });

  it("staff cannot reverse an older entry but the owner can", async () => {
    must(await admin.from("transactions").update({ business_date: "2020-01-01" }).eq("id", aepsId));
    const { error } = await reverse(f.staff, aepsId);
    expect(error?.message).toMatch(/today/);
    must(await reverse(f.owner, aepsId));
    expect(await balanceOf(f.owner, f.cash1)).toBe(0);
  });

  it("staff cannot reverse another branch's entry", async () => {
    const otherId = must(
      await f.owner.rpc("post_service", {
        p_client_id: randomUUID(),
        p_branch_id: f.branch2,
        p_service_id: f.services.xerox,
        p_amount: 2000,
        p_payments: [{ account_id: f.cash2, amount: 2000 }],
      }),
    ) as string;
    const { error } = await reverse(f.staff, otherId);
    expect(error?.message).toMatch(/not found|no access/);
  });
});
