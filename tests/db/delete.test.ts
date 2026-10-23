import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { setupShop, must, insertId, type ShopFixture } from "../helpers";

let f: ShopFixture;
beforeEach(async () => {
  f = await setupShop();
});

const sellXerox = (client: ShopFixture["owner"]) =>
  client.rpc("post_service", {
    p_client_id: randomUUID(),
    p_branch_id: f.branch1,
    p_service_id: f.services.xerox,
    p_amount: 2000,
    p_payments: [{ account_id: f.cash1, amount: 2000 }],
  });

describe("delete_services", () => {
  it("removes unused services and hides used ones, keeping old entries", async () => {
    must(await sellXerox(f.staff));
    const n = must(await f.owner.rpc("delete_services", { p_ids: [f.services.xerox, f.services.pan] })) as number;
    expect(n).toBe(2);
    const { data: pan } = await f.owner.from("services").select("id").eq("id", f.services.pan);
    expect(pan).toEqual([]);
    const xerox = must(await f.owner.from("services").select("active, deleted_at").eq("id", f.services.xerox).single()) as {
      active: boolean;
      deleted_at: string | null;
    };
    expect(xerox.active).toBe(false);
    expect(xerox.deleted_at).not.toBeNull();
    // The name can be used again
    await insertId(f.owner, "services", { shop_id: f.shopId, name: "Xerox", flow: "counter_sale" });
  });

  it("staff cannot delete", async () => {
    const { error } = await f.staff.rpc("delete_services", { p_ids: [f.services.pan] });
    expect(error?.message).toMatch(/Only the owner/);
  });
});

describe("delete_account", () => {
  it("refuses while money is in it", async () => {
    must(await sellXerox(f.owner));
    const { error } = await f.owner.rpc("delete_account", { p_id: f.cash1 });
    expect(error?.message).toMatch(/₹20.00 is still in Cash drawer/);
  });

  it("refuses the last cash drawer of a branch", async () => {
    const { error } = await f.owner.rpc("delete_account", { p_id: f.cash2 });
    expect(error?.message).toMatch(/only cash drawer/);
  });

  it("deletes an empty account and drops its payment button", async () => {
    must(await f.owner.from("branches").update({ pay_buttons: ["cash", f.bank1], default_pay: f.bank1 }).eq("id", f.branch1));
    must(await f.owner.rpc("delete_account", { p_id: f.bank1 }));
    const { data } = await f.owner.from("accounts").select("id").eq("id", f.bank1);
    expect(data).toEqual([]);
    const b = must(await f.owner.from("branches").select("pay_buttons, default_pay").eq("id", f.branch1).single()) as {
      pay_buttons: string[];
      default_pay: string | null;
    };
    expect(b.pay_buttons).toEqual(["cash"]);
    expect(b.default_pay).toBeNull();
  });
});
