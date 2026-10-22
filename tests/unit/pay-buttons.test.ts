import { describe, it, expect } from "vitest";
import { branchPayButtons, defaultPayKey } from "@/lib/pay-buttons";

const accounts = [
  { id: "c1", name: "Cash drawer", type: "cash" as const },
  { id: "w1", name: "AEPS MITRA", type: "wallet" as const },
  { id: "b1", name: "SBI", type: "bank" as const },
  { id: "b2", name: "Paytm Business", type: "bank" as const },
];

describe("branchPayButtons", () => {
  it("defaults to Cash and every bank/UPI account, no Udhaar or Mixed", () => {
    expect(branchPayButtons(null, accounts).map((b) => b.label)).toEqual(["Cash", "SBI", "Paytm Business"]);
  });
  it("keeps the saved order and maps banks to UPI", () => {
    const b = branchPayButtons(["b2", "cash", "udhaar"], accounts);
    expect(b.map((x) => x.label)).toEqual(["Paytm Business", "Cash", "Udhaar"]);
    expect(b[0]).toMatchObject({ mode: "upi", accountId: "b2" });
  });
  it("skips accounts that no longer exist, falls back when nothing is left", () => {
    expect(branchPayButtons(["gone", "split"], accounts).map((b) => b.label)).toEqual(["Mixed"]);
    expect(branchPayButtons(["gone"], accounts).map((b) => b.label)).toEqual(["Cash", "SBI", "Paytm Business"]);
  });
});

describe("defaultPayKey", () => {
  const buttons = branchPayButtons(["cash", "b2"], accounts);
  it("uses the saved default when shown", () => expect(defaultPayKey("b2", buttons)).toBe("b2"));
  it("else the first button", () => expect(defaultPayKey("udhaar", buttons)).toBe("cash"));
});
