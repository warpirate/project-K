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
