import type { PayMode } from "@/lib/payments";

/** One "How did the customer pay?" button on New entry. */
export interface PayButton {
  /** 'cash', 'udhaar', 'split' or a bank/UPI account id — what the branch stores. */
  key: string;
  label: string;
  mode: PayMode;
  /** Bank/UPI account the money goes to (mode "upi"). */
  accountId?: string;
}

interface Acct {
  id: string;
  name: string;
  type: "cash" | "wallet" | "bank";
}

export const SPECIAL_BUTTONS = [
  { key: "cash", label: "Cash", mode: "cash" },
  { key: "udhaar", label: "Udhaar", mode: "udhaar" },
  { key: "split", label: "Mixed", mode: "split" },
] as const satisfies readonly PayButton[];

/** Every button a branch could show: Cash, each bank/UPI account, Udhaar, Mixed. */
export function allPayButtons(accounts: Acct[]): PayButton[] {
  const banks = accounts.filter((a) => a.type === "bank").map((a) => ({ key: a.id, label: a.name, mode: "upi" as const, accountId: a.id }));
  return [SPECIAL_BUTTONS[0], ...banks, SPECIAL_BUTTONS[1], SPECIAL_BUTTONS[2]];
}

/** Default when the owner hasn't chosen: Cash + every bank/UPI account. */
export const defaultPayKeys = (accounts: Acct[]) => ["cash", ...accounts.filter((a) => a.type === "bank").map((a) => a.id)];

/**
 * The branch's buttons, in its saved order. Unknown keys (account turned off or deleted) are skipped;
 * nothing saved, or nothing left, falls back to the default.
 */
export function branchPayButtons(saved: string[] | null | undefined, accounts: Acct[]): PayButton[] {
  const all = new Map(allPayButtons(accounts).map((b) => [b.key, b]));
  const picked = (saved ?? []).map((k) => all.get(k)).filter((b): b is PayButton => !!b);
  return picked.length ? picked : defaultPayKeys(accounts).map((k) => all.get(k)!).filter(Boolean);
}

/** Which button is selected first: the saved default if it is shown, else the first one. */
export const defaultPayKey = (saved: string | null | undefined, buttons: PayButton[]) =>
  buttons.find((b) => b.key === saved)?.key ?? buttons[0]?.key ?? "cash";
