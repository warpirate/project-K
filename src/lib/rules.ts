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

export type RuleMode = "none" | "fixed" | "percent" | "slab";

/** One "up to ₹X → ₹Y" row of a charge-by-amount rule, as typed. The last row means "above that". */
export interface SlabRow {
  upto: string;
  value: string;
}

/** What a rule box holds while being edited. `slabs` is used when mode is "slab". */
export interface RuleDraft {
  mode: RuleMode;
  value: string;
  slabs?: SlabRow[];
}

export const emptySlabs = (): SlabRow[] => [
  { upto: "1000", value: "" },
  { upto: "", value: "" },
];

/** Form input → stored rule. Fixed is rupees (→ paise), percent is % (→ basis points). Empty/zero → null. */
export function ruleFromInput(mode: RuleMode, value: string): Rule | null {
  if (mode === "none" || mode === "slab" || value.trim() === "") return null;
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

const rupeeNumber = (v: string) => Number(v.replace(/,/g, "").trim());

/**
 * Charge-by-amount rows → slab rule. Rows need rising "up to" amounts; the last row has no limit.
 * All charges empty → null (no charge).
 */
export function slabsFromRows(rows: SlabRow[]): Rule | null {
  if (rows.length === 0 || rows.every((r) => r.value.trim() === "")) return null;
  const slabs: { upto: number | null; value: number }[] = [];
  let prev = 0;
  rows.forEach((r, i) => {
    const last = i === rows.length - 1;
    const value = r.value.trim() === "" ? 0 : rupeeNumber(r.value);
    if (!Number.isFinite(value) || value < 0) throw new Error("Charges must be rupee amounts, like 10");
    let upto: number | null = null;
    if (!last) {
      const u = rupeeNumber(r.upto);
      if (!r.upto.trim() || !Number.isFinite(u) || u <= 0) throw new Error("Fill every “up to” amount");
      upto = Math.round(u * 100);
      if (upto <= prev) throw new Error("“Up to” amounts must go up, like 1000, then 5000, then 10000");
      prev = upto;
    }
    slabs.push({ upto, value: Math.round(value * 100) });
  });
  return { type: "slab", slabs };
}

/** Any draft (₹, % or by amount) → stored rule. */
export function ruleFromDraft(d: RuleDraft): Rule | null {
  return d.mode === "slab" ? slabsFromRows(d.slabs ?? []) : ruleFromInput(d.mode, d.value);
}

/** Stored rule → draft, including charge-by-amount rows. */
export function ruleToDraft(rule: Rule | null | undefined): RuleDraft {
  if (rule?.type !== "slab") return ruleToInput(rule);
  const trim = (n: number) => String(Number((n / 100).toFixed(2)));
  return {
    mode: "slab",
    value: "",
    slabs: rule.slabs.map((s) => ({ upto: s.upto === null ? "" : trim(s.upto), value: trim(s.value) })),
  };
}

/** Short plain-words description of a rule. */
export function describeRule(rule: Rule | null | undefined): string {
  if (!rule) return "none";
  if (rule.type === "fixed") return formatINR(rule.value);
  if (rule.type === "percent") return `${Number((rule.bps / 100).toFixed(2))}%`;
  return rule.slabs
    .map((s, i) => (s.upto === null ? `${i === 0 ? "" : "above: "}${formatINR(s.value)}` : `up to ${formatINR(s.upto)}: ${formatINR(s.value)}`))
    .join(", ");
}
