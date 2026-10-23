import { describe, it, expect } from "vitest";
import { BUSINESS_PACKS, packById, packFlows } from "@/lib/business-packs";
import { flowOptions } from "@/lib/flows";
import { normalizeName } from "@/lib/services";
import { PACK_LOOK } from "@/components/icons";

const FLOWS = ["cash_out", "cash_in", "pay_through", "application", "counter_sale"];

describe("business packs", () => {
  it("have unique ids, a picture and a catch-all 'other'", () => {
    const ids = BUSINESS_PACKS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("other");
    for (const id of ids) expect(PACK_LOOK[id]).toBeDefined();
  });

  it.each(BUSINESS_PACKS.filter((p) => p.id !== "other").map((p) => [p.id, p] as const))("%s: items are valid and named once", (_id, pack) => {
    const items = [...pack.base, ...pack.questions.flatMap((q) => q.items)];
    expect(items.length).toBeGreaterThan(15);
    const names = items.map((i) => normalizeName(i.name));
    expect(new Set(names).size).toBe(names.length);
    for (const i of items) {
      expect(i.name.trim()).not.toBe("");
      expect(FLOWS).toContain(i.flow);
      if (i.price !== null) expect(Number.isInteger(i.price) && i.price >= 0).toBe(true);
      // Money services take a different amount every time.
      if (["cash_out", "cash_in", "pay_through"].includes(i.flow)) expect(i.price).toBeNull();
    }
    for (const q of pack.questions) expect(q.ask.trim()).not.toBe("");
  });

  it("a salon only offers shop-item services", () => {
    expect(packFlows(packById("salon"))).toEqual(["counter_sale"]);
    expect(flowOptions("salon").map((f) => f.value)).toEqual(["counter_sale"]);
    expect(flowOptions("salon", "cash_out").map((f) => f.value)).toEqual(["cash_out", "counter_sale"]);
  });

  it("CSC and an unknown business get every service type", () => {
    expect(packFlows(packById("csc"))).toHaveLength(5);
    expect(packFlows(packById(null))).toHaveLength(5);
  });
});
