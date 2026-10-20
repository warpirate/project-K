import { formatINR } from "@/lib/money";

export type Rule =
  | { type: "fixed"; value: number }
  | { type: "percent"; bps: number }
  | { type: "slab"; slabs: ReadonlyArray<{ upto: number | null; value: number }> };

export type Flow = "cash_out" | "cash_in" | "pay_through" | "application" | "counter_sale";

/** TS port of public.calc_rule — keep in sync with supabase/migrations/20261019000300_rules.sql. */
export function calcRule(rule: Rule | null | undefined, amount: number): number {
  if (!rule) return 0;
  switch (rule.type) {
    case "fixed":
      return rule.value;
    case "percent":
      return Math.round((amount * rule.bps) / 10000);
    case "slab": {
      const hit = rule.slabs.find((s) => s.upto === null || amount <= s.upto);
      if (!hit) throw new Error(`no slab matches amount ${amount}`);
      return hit.value;
    }
  }
}

export interface EntryPreview {
  customerTotal: number; // what the customer pays (or receives, when shopPays)
  shopPays: boolean; // true for cash_out: shop hands cash to the customer
  earning: number;
}

/** Mirrors the flow table in post_service. */
export function previewEntry(flow: Flow, amount: number, fee: number, commission: number, portalCost: number): EntryPreview {
  switch (flow) {
    case "cash_out":
      return { customerTotal: amount - fee, shopPays: true, earning: fee + commission };
    case "cash_in":
    case "pay_through":
      return { customerTotal: amount + fee, shopPays: false, earning: fee + commission };
    case "application":
      return { customerTotal: amount, shopPays: false, earning: amount - portalCost };
    case "counter_sale":
      return { customerTotal: amount, shopPays: false, earning: amount };
  }
}

export type RuleMode = "none" | "fixed" | "percent";

/** Form input → stored rule. Fixed is rupees (→ paise), percent is % (→ basis points). Empty/zero → null. */
export function ruleFromInput(mode: RuleMode, value: string): Rule | null {
  if (mode === "none" || value.trim() === "") return null;
  const n = Number(value.replace(/,/g, "").trim());
  if (!Number.isFinite(n) || n < 0) throw new Error("Enter a valid number");
  if (n === 0) return null;
  if (mode === "fixed") return { type: "fixed", value: Math.round(n * 100) };
  if (n > 100) throw new Error("Percent must be 100 or less");
  return { type: "percent", bps: Math.round(n * 100) };
}

/** Stored rule → form values (inverse of ruleFromInput). Slabs can't be edited in the simple form; they show as empty. */
export function ruleToInput(rule: Rule | null | undefined): { mode: "fixed" | "percent"; value: string } {
  if (!rule || rule.type === "slab") return { mode: "fixed", value: "" };
  const trim = (n: number) => String(Number(n.toFixed(2)));
  return rule.type === "fixed" ? { mode: "fixed", value: trim(rule.value / 100) } : { mode: "percent", value: trim(rule.bps / 100) };
}

/** Short plain-words description of a rule. */
export function describeRule(rule: Rule | null | undefined): string {
  if (!rule) return "none";
  if (rule.type === "fixed") return formatINR(rule.value);
  if (rule.type === "percent") return `${Number((rule.bps / 100).toFixed(2))}%`;
  return `by amount (${rule.slabs.length} slabs)`;
}
