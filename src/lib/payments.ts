import { formatINR } from "@/lib/money";
import type { Flow } from "@/lib/rules";

export type PayMode = "cash" | "upi" | "udhaar" | "split";
export type PartKind = "cash" | "upi" | "udhaar";
export type Payment = { account_id: string; amount: number } | { udhaar: true; amount: number };

export interface PaymentInput {
  mode: PayMode;
  total: number; // paise the customer pays (or receives on withdrawals)
  flow: Flow;
  cashId?: string;
  upiId?: string;
  hasCustomer: boolean;
  parts?: { kind: PartKind; amount: number }[];
}

export type PaymentResult = { ok: true; payments: Payment[] } | { ok: false; error: string };

/** Turns the payment choice into the p_payments array post_service expects. */
export function buildPayments(input: PaymentInput): PaymentResult {
  const parts = input.mode === "split" ? (input.parts ?? []).filter((p) => p.amount > 0) : [{ kind: input.mode, amount: input.total }];

  if (input.mode === "split") {
    const sum = parts.reduce((s, p) => s + p.amount, 0);
    if (sum !== input.total) return { ok: false, error: `Split adds up to ${formatINR(sum)}, needs ${formatINR(input.total)}` };
  }

  const payments: Payment[] = [];
  for (const p of parts as { kind: PartKind; amount: number }[]) {
    if (p.kind === "udhaar") {
      if (input.flow === "cash_out") return { ok: false, error: "Udhaar is not possible on a cash withdrawal" };
      if (!input.hasCustomer) return { ok: false, error: "Pick the customer for udhaar" };
      payments.push({ udhaar: true, amount: p.amount });
    } else {
      const id = p.kind === "cash" ? input.cashId : input.upiId;
      if (!id) {
        return {
          ok: false,
          error: p.kind === "cash" ? "This branch has no cash account. Add one in setup." : "This branch has no bank/UPI account. Add one in setup.",
        };
      }
      payments.push({ account_id: id, amount: p.amount });
    }
  }
  return { ok: true, payments };
}
