import { describe, it, expect } from "vitest";
import { rupeesToPaise, formatINR } from "@/lib/money";

describe("rupeesToPaise", () => {
  it("parses whole and decimal rupees", () => {
    expect(rupeesToPaise("20")).toBe(2000);
    expect(rupeesToPaise("20.5")).toBe(2050);
    expect(rupeesToPaise("1,23,456.78")).toBe(12345678);
    expect(rupeesToPaise(" 0.05 ")).toBe(5);
  });
  it("rejects bad input", () => {
    expect(rupeesToPaise("")).toBeNull();
    expect(rupeesToPaise("abc")).toBeNull();
    expect(rupeesToPaise("1.234")).toBeNull();
    expect(rupeesToPaise("-5")).toBeNull();
  });
});

describe("formatINR", () => {
  it("uses Indian grouping and 2 decimals", () => {
    expect(formatINR(12345678)).toBe("₹1,23,456.78");
    expect(formatINR(2000)).toBe("₹20.00");
    expect(formatINR(-19800)).toBe("-₹198.00");
  });
});
