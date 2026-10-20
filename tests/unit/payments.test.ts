import { describe, it, expect } from "vitest";
import { buildPayments, changeDue } from "@/lib/payments";

const accts = { cashId: "cash", upiId: "bank" };

describe("buildPayments", () => {
  it("cash puts the whole total on the drawer", () => {
    expect(buildPayments({ mode: "cash", total: 5050, ...accts, flow: "cash_in", hasCustomer: false })).toEqual({
      ok: true,
      payments: [{ account_id: "cash", amount: 5050 }],
    });
  });
  it("upi uses the bank account", () => {
    expect(buildPayments({ mode: "upi", total: 299, ...accts, flow: "pay_through", hasCustomer: false })).toEqual({
      ok: true,
      payments: [{ account_id: "bank", amount: 299 }],
    });
  });
  it("udhaar needs a customer and is not allowed on withdrawals", () => {
    expect(buildPayments({ mode: "udhaar", total: 2000, ...accts, flow: "counter_sale", hasCustomer: false })).toEqual({
      ok: false,
      error: "Pick the customer for udhaar",
    });
    expect(buildPayments({ mode: "udhaar", total: 2000, ...accts, flow: "cash_out", hasCustomer: true }).ok).toBe(false);
    expect(buildPayments({ mode: "udhaar", total: 2000, ...accts, flow: "counter_sale", hasCustomer: true })).toEqual({
      ok: true,
      payments: [{ udhaar: true, amount: 2000 }],
    });
  });
  it("split must add up to the total and merges zero parts away", () => {
    const parts = [
      { kind: "cash" as const, amount: 3000 },
      { kind: "udhaar" as const, amount: 2050 },
      { kind: "upi" as const, amount: 0 },
    ];
    expect(buildPayments({ mode: "split", total: 5050, parts, ...accts, flow: "cash_in", hasCustomer: true })).toEqual({
      ok: true,
      payments: [
        { account_id: "cash", amount: 3000 },
        { udhaar: true, amount: 2050 },
      ],
    });
    expect(buildPayments({ mode: "split", total: 5000, parts, ...accts, flow: "cash_in", hasCustomer: true })).toEqual({
      ok: false,
      error: "Mixed adds up to ₹50.50, needs ₹50.00",
    });
  });
  it("needs the account to exist", () => {
    expect(buildPayments({ mode: "upi", total: 100, cashId: "cash", upiId: undefined, flow: "cash_in", hasCustomer: false })).toEqual({
      ok: false,
      error: "This branch has no bank/UPI account. Add one in setup.",
    });
  });
});

describe("customer gave more (change)", () => {
  it("UPI overpay records the UPI amount and the cash given back", () => {
    expect(
      buildPayments({ mode: "upi", total: 29900, received: 50000, ...accts, flow: "pay_through", hasCustomer: false }),
    ).toEqual({
      ok: true,
      payments: [
        { account_id: "bank", amount: 50000 },
        { account_id: "cash", amount: -20100 },
      ],
    });
  });
  it("cash overpay only needs the net amount (change comes from the same drawer)", () => {
    expect(buildPayments({ mode: "cash", total: 29900, received: 50000, ...accts, flow: "pay_through", hasCustomer: false })).toEqual({
      ok: true,
      payments: [{ account_id: "cash", amount: 29900 }],
    });
  });
  it("received equal or empty behaves as before", () => {
    expect(buildPayments({ mode: "upi", total: 100, received: 100, ...accts, flow: "cash_in", hasCustomer: false })).toEqual({
      ok: true,
      payments: [{ account_id: "bank", amount: 100 }],
    });
  });
  it("received less than needed is an error with a hint", () => {
    expect(buildPayments({ mode: "cash", total: 29900, received: 20000, ...accts, flow: "pay_through", hasCustomer: false })).toEqual({
      ok: false,
      error: "Customer gave ₹200.00, needs ₹299.00. Use Mixed or Udhaar for the rest.",
    });
  });
});

describe("changeDue", () => {
  it("is the extra the customer gave, never negative", () => {
    expect(changeDue(29900, 50000)).toBe(20100);
    expect(changeDue(29900, 20000)).toBe(0);
    expect(changeDue(29900, undefined)).toBe(0);
  });
});
