import { describe, it, expect } from "vitest";
import { normalizeName, searchServices, findExact, shouldOfferCreate } from "@/lib/services";

const list = [
  { id: "1", name: "Xerox", aliases: ["zerox", "photocopy"] },
  { id: "2", name: "AEPS withdrawal", aliases: [] },
  { id: "3", name: "Mobile recharge", aliases: ["jio", "airtel"] },
];

describe("services search", () => {
  it("normalizes case and spaces", () => {
    expect(normalizeName("  XeRoX  copy ")).toBe("xerox copy");
  });
  it("matches by name substring and alias", () => {
    expect(searchServices(list, "xer").map((s) => s.id)).toEqual(["1"]);
    expect(searchServices(list, "zerox").map((s) => s.id)).toEqual(["1"]);
    expect(searchServices(list, "JIO").map((s) => s.id)).toEqual(["3"]);
  });
  it("ranks prefix matches first", () => {
    const l = [{ id: "a", name: "Colour print", aliases: [] }, { id: "b", name: "Print", aliases: [] }];
    expect(searchServices(l, "print").map((s) => s.id)).toEqual(["b", "a"]);
  });
  it("returns all for empty query", () => {
    expect(searchServices(list, " ")).toHaveLength(3);
  });
  it("finds exact name ignoring case/spaces", () => {
    expect(findExact(list, " xerox ")?.id).toBe("1");
    expect(findExact(list, "xer")).toBeUndefined();
  });
});

describe("shouldOfferCreate", () => {
  it("hides create while the query is the start of an existing name", () => {
    expect(shouldOfferCreate(list, "xer")).toBe(false);
    expect(shouldOfferCreate(list, "Xerox")).toBe(false);
  });
  it("offers create for new names, even if they appear inside other names", () => {
    expect(shouldOfferCreate(list, "Binding")).toBe(true);
    expect(shouldOfferCreate([{ id: "a", name: "Colour print", aliases: [] }], "print")).toBe(true);
  });
  it("never offers create for an empty query", () => {
    expect(shouldOfferCreate(list, "  ")).toBe(false);
  });
});
