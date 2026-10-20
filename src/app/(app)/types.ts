import type { Flow, Rule } from "@/lib/rules";

export interface ServiceOption {
  id: string;
  name: string;
  flow: Flow;
  category: string;
  aliases: string[];
  fee_rule: Rule | null;
  commission_rule: Rule | null;
  portal_cost_rule: Rule | null;
}

export interface AccountOption {
  id: string;
  name: string;
  type: "cash" | "wallet" | "bank";
}

export interface CustomerOption {
  id: string;
  name: string;
  phone: string | null;
}
