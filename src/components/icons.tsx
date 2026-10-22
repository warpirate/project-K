import type { LucideIcon } from "lucide-react";
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  Banknote,
  FileText,
  HandCoins,
  Landmark,
  Printer,
  Receipt,
  Scale,
  Send,
  Undo2,
  Wallet,
  Zap,
} from "lucide-react";
import type { Flow } from "@/lib/rules";
import { cx } from "./ui";

/** One picture per kind of money place, so cash / wallet / bank are told apart at a glance. */
export const ACCOUNT_ICON: Record<"cash" | "wallet" | "bank", LucideIcon> = {
  cash: Banknote,
  wallet: Wallet,
  bank: Landmark,
};

/** One picture per service type. */
export const FLOW_ICON: Record<Flow, LucideIcon> = {
  cash_out: HandCoins,
  cash_in: Send,
  pay_through: Zap,
  application: FileText,
  counter_sale: Printer,
};

/** One picture per non-service entry. */
export const KIND_ICON: Record<string, LucideIcon> = {
  expense: Receipt,
  transfer: ArrowLeftRight,
  udhaar_payment: ArrowDownToLine,
  udhaar_given: ArrowUpFromLine,
  opening_balance: Scale,
  reversal: Undo2,
};

type Tone = "in" | "out" | "plain" | "accent";

const tones: Record<Tone, string> = {
  in: "bg-accent-soft text-in",
  out: "bg-danger-soft text-out",
  plain: "bg-paper text-ink-soft",
  accent: "bg-accent-soft text-accent",
};

/** Small rounded tile holding an icon, used at the start of list rows. */
export function IconTile({ icon: Icon, tone = "plain", size = "md" }: { icon: LucideIcon; tone?: Tone; size?: "sm" | "md" }) {
  return (
    <span
      aria-hidden
      className={cx("inline-flex shrink-0 items-center justify-center rounded-xl", size === "sm" ? "size-8" : "size-10", tones[tone])}
    >
      <Icon size={size === "sm" ? 16 : 19} strokeWidth={1.9} />
    </span>
  );
}
