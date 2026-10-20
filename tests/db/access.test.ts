import { describe, it, expect, beforeAll } from "vitest";
import { randomUUID } from "node:crypto";
import { setupShop, newUserClient, must, type ShopFixture } from "../helpers";

let f: ShopFixture;
beforeAll(async () => {
  f = await setupShop();
});

describe("create_shop", () => {
  it("makes the caller owner of a new shop", async () => {
    const profile = must(
      await f.owner.from("profiles").select("role, shop_id, branch_id").eq("user_id", f.ownerId).single(),
    );
    expect(profile).toEqual({ role: "owner", shop_id: f.shopId, branch_id: null });
  });

  it("refuses a second shop for the same user", async () => {
    const { error } = await f.owner.rpc("create_shop", { p_shop_name: "Again", p_owner_name: "Owner" });
    expect(error?.message).toMatch(/already belongs/);
  });
});

describe("branch isolation", () => {
  it("staff sees only own branch accounts", async () => {
    const rows = must(await f.staff.from("accounts").select("id")) as { id: string }[];
    expect(rows.map((r) => r.id).sort()).toEqual([f.cash1, f.wallet1, f.bank1].sort());
  });

  it("owner sees accounts of all branches", async () => {
    const rows = must(await f.owner.from("accounts").select("id")) as { id: string }[];
    expect(rows).toHaveLength(4);
  });

  it("staff sees only own branch balances", async () => {
    const row = must(
      await f.staff.from("account_balances").select("balance").eq("account_id", f.cash2).maybeSingle(),
    );
    expect(row).toBeNull();
  });

  it("a user with no shop sees nothing", async () => {
    const { client } = await newUserClient();
    expect(must(await client.from("accounts").select("id"))).toHaveLength(0);
    expect(must(await client.from("branches").select("id"))).toHaveLength(0);
  });

  it("staff cannot create accounts", async () => {
    const { error } = await f.staff
      .from("accounts")
      .insert({ shop_id: f.shopId, branch_id: f.branch1, name: "Hack", type: "cash" });
    expect(error).not.toBeNull();
  });

  it("owner of another shop cannot add accounts to this shop", async () => {
    const other = await setupShop();
    const { error } = await other.owner
      .from("accounts")
      .insert({ shop_id: f.shopId, branch_id: f.branch1, name: "X", type: "cash" });
    expect(error).not.toBeNull();
  });

  it("staff can create a service, which starts unreviewed", async () => {
    const row = must(
      await f.staff
        .from("services")
        .insert({ shop_id: f.shopId, name: "Lamination", flow: "counter_sale" })
        .select("reviewed, created_by")
        .single(),
    );
    expect(row).toEqual({ reviewed: false, created_by: f.staffId });
  });

  it("owner-created services are reviewed", async () => {
    const row = must(await f.owner.from("services").select("reviewed").eq("id", f.services.xerox).single());
    expect(row).toEqual({ reviewed: true });
  });

  it("service names are unique ignoring case and spaces", async () => {
    const { error } = await f.staff
      .from("services")
      .insert({ shop_id: f.shopId, name: " xerox", flow: "counter_sale" });
    expect(error).not.toBeNull();
  });

  it("staff cannot edit services", async () => {
    const rows = must(
      await f.staff
        .from("services")
        .update({ fee_rule: { type: "fixed", value: 1 } })
        .eq("id", f.services.xerox)
        .select("id"),
    );
    expect(rows).toHaveLength(0);
  });

  it("staff can add customers to the shop", async () => {
    const { error } = await f.staff
      .from("customers")
      .insert({ shop_id: f.shopId, name: "Ramesh", phone: "9000000001" });
    expect(error).toBeNull();
  });
});

describe("ledger is append-only", () => {
  it("blocks direct inserts into transactions", async () => {
    const { error } = await f.owner.from("transactions").insert({
      shop_id: f.shopId,
      branch_id: f.branch1,
      kind: "expense",
      amount: 100,
      client_id: randomUUID(),
      created_by: f.ownerId,
      business_date: "2026-10-19",
    });
    expect(error).not.toBeNull();
  });

  it("blocks direct inserts into ledger_lines", async () => {
    const { error } = await f.owner.from("ledger_lines").insert({
      transaction_id: randomUUID(),
      shop_id: f.shopId,
      branch_id: f.branch1,
      account_id: f.cash1,
      amount: 100,
    });
    expect(error).not.toBeNull();
  });
});
