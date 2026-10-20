import { describe, it, expect } from "vitest";
import { calcRule, describeRule, previewEntry, ruleFromInput, ruleToInput } from "@/lib/rules";

const slab = { type: "slab", slabs: [{ upto: 100000, value: 1000 }, { upto: null, value: 2000 }] } as const;

describe("calcRule", () => {
  it("matches the database", () => {
    expect(calcRule(null, 50000)).toBe(0);
    expect(calcRule({ type: "fixed", value: 500 }, 200000)).toBe(500);
    expect(calcRule({ type: "percent", bps: 300 }, 29900)).toBe(897);
    expect(calcRule({ type: "percent", bps: 25 }, 199999)).toBe(500);
    expect(calcRule(slab, 100000)).toBe(1000);
    expect(calcRule(slab, 100001)).toBe(2000);
  });
});

describe("previewEntry", () => {
  it("cash_out: customer receives amount minus fee", () => {
    expect(previewEntry("cash_out", 200000, 2000, 500, 0)).toEqual({ customerTotal: 198000, shopPays: true, earning: 2500 });
  });
  it("cash_in: customer pays amount plus fee", () => {
    expect(previewEntry("cash_in", 500000, 5000, 500, 0)).toEqual({ customerTotal: 505000, shopPays: false, earning: 5500 });
  });
  it("pay_through", () => {
    expect(previewEntry("pay_through", 29900, 0, 897, 0)).toEqual({ customerTotal: 29900, shopPays: false, earning: 897 });
  });
  it("application: earning is charge minus portal cost", () => {
    expect(previewEntry("application", 25000, 0, 0, 10700)).toEqual({ customerTotal: 25000, shopPays: false, earning: 14300 });
  });
  it("counter_sale", () => {
    expect(previewEntry("counter_sale", 2000, 0, 0, 0)).toEqual({ customerTotal: 2000, shopPays: false, earning: 2000 });
  });
});

describe("ruleFromInput", () => {
  it("converts rupees and percent into stored rules", () => {
    expect(ruleFromInput("fixed", "20")).toEqual({ type: "fixed", value: 2000 });
    expect(ruleFromInput("percent", "0.25")).toEqual({ type: "percent", bps: 25 });
    expect(ruleFromInput("percent", "1")).toEqual({ type: "percent", bps: 100 });
  });
  it("treats empty or zero as no rule", () => {
    expect(ruleFromInput("fixed", "")).toBeNull();
    expect(ruleFromInput("fixed", "0")).toBeNull();
    expect(ruleFromInput("none", "5")).toBeNull();
  });
  it("rejects invalid numbers", () => {
    expect(() => ruleFromInput("fixed", "abc")).toThrow();
    expect(() => ruleFromInput("percent", "101")).toThrow();
  });
});

describe("ruleToInput", () => {
  it("turns stored rules back into form values", () => {
    expect(ruleToInput({ type: "fixed", value: 2000 })).toEqual({ mode: "fixed", value: "20" });
    expect(ruleToInput({ type: "fixed", value: 2050 })).toEqual({ mode: "fixed", value: "20.5" });
    expect(ruleToInput({ type: "percent", bps: 25 })).toEqual({ mode: "percent", value: "0.25" });
    expect(ruleToInput(null)).toEqual({ mode: "fixed", value: "" });
  });
  it("round-trips through ruleFromInput", () => {
    for (const r of [{ type: "fixed", value: 1550 }, { type: "percent", bps: 150 }] as const) {
      const d = ruleToInput(r);
      expect(ruleFromInput(d.mode, d.value)).toEqual(r);
    }
  });
});

describe("describeRule", () => {
  it("says the rule in plain words", () => {
    expect(describeRule({ type: "fixed", value: 2000 })).toBe("₹20.00");
    expect(describeRule({ type: "percent", bps: 25 })).toBe("0.25%");
    expect(describeRule({ type: "slab", slabs: [{ upto: 100000, value: 1000 }, { upto: null, value: 2000 }] })).toBe("by amount (2 slabs)");
    expect(describeRule(null)).toBe("none");
  });
});
