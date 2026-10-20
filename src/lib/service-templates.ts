import type { Flow } from "@/lib/rules";

export interface ServiceTemplate {
  name: string;
  flow: Flow;
  category: string;
  aliases: string[];
}

export const SERVICE_TEMPLATES: ServiceTemplate[] = [
  { name: "AEPS withdrawal", flow: "cash_out", category: "banking", aliases: ["aeps", "withdraw", "cash withdrawal"] },
  { name: "Money transfer", flow: "cash_in", category: "banking", aliases: ["dmt", "transfer", "send money"] },
  { name: "Cash deposit", flow: "cash_in", category: "banking", aliases: ["deposit"] },
  { name: "Mobile recharge", flow: "pay_through", category: "recharge", aliases: ["recharge", "jio", "airtel", "vi", "bsnl"] },
  { name: "DTH recharge", flow: "pay_through", category: "recharge", aliases: ["dth", "tata play", "dish"] },
  { name: "Electricity bill", flow: "pay_through", category: "bill", aliases: ["current bill", "power bill"] },
  { name: "PAN card application", flow: "application", category: "application", aliases: ["pan"] },
  { name: "Aadhaar update", flow: "application", category: "application", aliases: ["aadhar", "aadhaar"] },
  { name: "Xerox", flow: "counter_sale", category: "counter", aliases: ["zerox", "photocopy", "copy"] },
  { name: "Print", flow: "counter_sale", category: "counter", aliases: ["printout", "colour print"] },
  { name: "Lamination", flow: "counter_sale", category: "counter", aliases: ["laminate"] },
  { name: "Passport photo", flow: "counter_sale", category: "counter", aliases: ["photo"] },
];
