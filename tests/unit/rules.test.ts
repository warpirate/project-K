import { describe, it, expect } from "vitest";
import { calcRule, describeRule, previewEntry, ruleFromDraft, ruleFromInput, ruleToDraft, ruleToInput, slabsFromRows } from "@/lib/rules";

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
    expect(describeRule({ type: "slab", slabs: [{ upto: 100000, value: 1000 }, { upto: null, value: 2000 }] })).toBe("up to ₹1,000.00: ₹10.00, above: ₹20.00");
    expect(describeRule(null)).toBe("none");
  });
});

describe("charge by amount (slabs)", () => {
  it("turns rows into a slab rule; the last row has no limit", () => {
    expect(
      slabsFromRows([
        { upto: "1000", value: "10" },
        { upto: "10,000", value: "50" },
        { upto: "", value: "100" },
      ]),
    ).toEqual({
      type: "slab",
      slabs: [
        { upto: 100000, value: 1000 },
        { upto: 1000000, value: 5000 },
        { upto: null, value: 10000 },
      ],
    });
  });
  it("charges more for bigger amounts", () => {
    const rule = slabsFromRows([
      { upto: "1000", value: "10" },
      { upto: "", value: "20" },
    ]);
    expect(calcRule(rule, 100000)).toBe(1000);
    expect(calcRule(rule, 1000000)).toBe(2000);
  });
  it("no charges typed means no rule", () => {
    expect(slabsFromRows([{ upto: "1000", value: "" }, { upto: "", value: " " }])).toBeNull();
  });
  it("rejects missing or falling limits", () => {
    expect(() => slabsFromRows([{ upto: "", value: "10" }, { upto: "", value: "20" }])).toThrow(/up to/);
    expect(() => slabsFromRows([{ upto: "5000", value: "10" }, { upto: "1000", value: "20" }, { upto: "", value: "30" }])).toThrow(/go up/);
  });
  it("round-trips through drafts", () => {
    expect(ruleFromDraft(ruleToDraft(slab))).toEqual(slab);
    expect(ruleToDraft(slab)).toEqual({ mode: "slab", value: "", slabs: [{ upto: "1000", value: "10" }, { upto: "", value: "20" }] });
    expect(ruleFromDraft(ruleToDraft({ type: "percent", bps: 100 }))).toEqual({ type: "percent", bps: 100 });
  });
});
