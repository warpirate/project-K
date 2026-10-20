import { describe, it, expect } from "vitest";
import { calcRule, previewEntry } from "@/lib/rules";

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
