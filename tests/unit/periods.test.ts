import { describe, it, expect } from "vitest";
import { periodRange, previousRange, daysBetween, addDays } from "@/lib/periods";

const today = "2026-10-20";

describe("periodRange", () => {
  it("today / yesterday", () => {
    expect(periodRange("today", today)).toEqual({ key: "today", from: "2026-10-20", to: "2026-10-20", label: "Today" });
    expect(periodRange("yesterday", today)).toMatchObject({ from: "2026-10-19", to: "2026-10-19" });
  });
  it("last 7 days includes today", () => {
    expect(periodRange("7d", today)).toMatchObject({ from: "2026-10-14", to: "2026-10-20" });
  });
  it("this month and last month", () => {
    expect(periodRange("month", today)).toMatchObject({ from: "2026-10-01", to: "2026-10-20" });
    expect(periodRange("last_month", today)).toMatchObject({ from: "2026-09-01", to: "2026-09-30" });
    expect(periodRange("last_month", "2026-03-05")).toMatchObject({ from: "2026-02-01", to: "2026-02-28" });
  });
  it("custom, swapped if reversed, falls back to today when invalid", () => {
    expect(periodRange("custom", today, "2026-10-10", "2026-10-01")).toMatchObject({ from: "2026-10-01", to: "2026-10-10" });
    expect(periodRange("custom", today, "nope", "")).toMatchObject({ from: today, to: today });
  });
});

describe("previousRange", () => {
  it("is the same length just before", () => {
    expect(previousRange({ from: "2026-10-14", to: "2026-10-20" })).toEqual({ from: "2026-10-07", to: "2026-10-13" });
    expect(previousRange({ from: "2026-10-20", to: "2026-10-20" })).toEqual({ from: "2026-10-19", to: "2026-10-19" });
  });
});

describe("date helpers", () => {
  it("adds days across months and counts inclusive days", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(daysBetween("2026-10-01", "2026-10-20")).toBe(20);
  });
});
