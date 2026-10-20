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
  /** Optional: what the customer actually handed over / sent (cash or UPI modes). Extra is given back in cash. */
  received?: number;
}

export type PaymentResult = { ok: true; payments: Payment[] } | { ok: false; error: string };

/** Cash to hand back when the customer gave more than needed. */
export const changeDue = (total: number, received: number | undefined) =>
  received !== undefined && received > total ? received - total : 0;

/** Turns the payment choice into the p_payments array post_service expects. */
export function buildPayments(input: PaymentInput): PaymentResult {
  const { mode, total, received } = input;

  if ((mode === "cash" || mode === "upi") && received !== undefined && received < total) {
    return { ok: false, error: `Customer gave ${formatINR(received)}, needs ${formatINR(total)}. Use Mixed or Udhaar for the rest.` };
  }

  const parts =
    mode === "split" ? (input.parts ?? []).filter((p) => p.amount > 0) : [{ kind: mode as PartKind, amount: total }];

  if (mode === "split") {
    const sum = parts.reduce((s, p) => s + p.amount, 0);
    if (sum !== total) return { ok: false, error: `Mixed adds up to ${formatINR(sum)}, needs ${formatINR(total)}` };
  }

  const payments: Payment[] = [];
  for (const p of parts) {
    if (p.kind === "udhaar") {
      if (input.flow === "cash_out") return { ok: false, error: "Udhaar is not possible when you give cash to the customer" };
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

  // UPI overpay: the bank got the full amount, the drawer paid out the difference.
  const change = changeDue(total, received);
  if (mode === "upi" && change > 0) {
    if (!input.cashId) return { ok: false, error: "This branch has no cash account to give change from." };
    payments[0] = { account_id: input.upiId!, amount: received! };
    payments.push({ account_id: input.cashId, amount: -change });
  }
  return { ok: true, payments };
}
