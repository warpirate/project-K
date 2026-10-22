import { describe, it, expect } from "vitest";
import { cleanPhone } from "@/lib/phone";

describe("cleanPhone", () => {
  it("keeps 10-digit mobile numbers, dropping +91, 0 and spaces", () => {
    expect(cleanPhone("9876543210")).toBe("9876543210");
    expect(cleanPhone("+91 98765 43210")).toBe("9876543210");
    expect(cleanPhone("09876543210")).toBe("9876543210");
    expect(cleanPhone("98765-43210")).toBe("9876543210");
  });
  it("empty means no phone", () => {
    expect(cleanPhone("  ")).toBe("");
  });
  it("rejects wrong numbers", () => {
    expect(cleanPhone("9999999999999999")).toBeNull();
    expect(cleanPhone("12345")).toBeNull();
    expect(cleanPhone("1234567890")).toBeNull();
    expect(cleanPhone("98765abcde")).toBeNull();
  });
});
