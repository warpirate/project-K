import { describe, it, expect } from "vitest";
import { admin, must, setupShop } from "../helpers";

const calc = async (rule: unknown, amount: number) =>
  Number(must(await admin.rpc("calc_rule", { p_rule: rule, p_amount: amount })));

describe("calc_rule", () => {
  it("returns 0 for no rule", async () => {
    expect(await calc(null, 50000)).toBe(0);
  });

  it("fixed returns the value", async () => {
    expect(await calc({ type: "fixed", value: 500 }, 200000)).toBe(500);
  });

  it("percent uses basis points and rounds half up", async () => {
    expect(await calc({ type: "percent", bps: 300 }, 29900)).toBe(897);
    expect(await calc({ type: "percent", bps: 25 }, 199999)).toBe(500);
  });

  it("slab picks the first slab the amount fits", async () => {
    const rule = { type: "slab", slabs: [{ upto: 100000, value: 1000 }, { upto: null, value: 2000 }] };
    expect(await calc(rule, 100000)).toBe(1000);
    expect(await calc(rule, 100001)).toBe(2000);
  });

  it("slab rows can be a percent: up to ₹1,000 → ₹10, above → 1%", async () => {
    const rule = { type: "slab", slabs: [{ upto: 100000, value: 1000 }, { upto: null, bps: 100 }] };
    expect(await calc(rule, 9000)).toBe(1000);
    expect(await calc(rule, 100000)).toBe(1000);
    expect(await calc(rule, 500000)).toBe(5000);
  });

  it("rejects unknown rule types", async () => {
    const { error } = await admin.rpc("calc_rule", { p_rule: { type: "magic" }, p_amount: 100 });
    expect(error?.message).toMatch(/unknown rule type/);
  });
});

describe("service rule validation", () => {
  it("rejects a malformed fee rule", async () => {
    const f = await setupShop();
    const { error } = await f.owner
      .from("services")
      .insert({ shop_id: f.shopId, name: "Bad", flow: "cash_in", fee_rule: { type: "percent" } });
    expect(error).not.toBeNull();
  });
});
