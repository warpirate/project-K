import type { Flow } from "@/lib/rules";

/** Plain-language names for money flows, shown wherever staff pick a service type. */
export const FLOWS: { value: Flow; label: string; help: string }[] = [
  { value: "cash_out", label: "Cash withdrawal", help: "Customer takes cash; portal wallet goes up" },
  { value: "cash_in", label: "Money transfer / deposit", help: "Customer gives cash; portal wallet goes down" },
  { value: "pay_through", label: "Recharge / bill payment", help: "Customer pays; wallet pays the bill" },
  { value: "application", label: "Online application", help: "You charge the customer; portal takes its fee" },
  { value: "counter_sale", label: "Counter sale", help: "Xerox, print, lamination: all of it is yours" },
];

export const flowLabel = (f: Flow) => FLOWS.find((x) => x.value === f)?.label ?? f;

/** Which rule inputs make sense for a flow. */
export const flowUses = (f: Flow) => ({
  wallet: f !== "counter_sale",
  fee: f === "cash_out" || f === "cash_in" || f === "pay_through",
  commission: f === "cash_out" || f === "cash_in" || f === "pay_through",
  portalCost: f === "application",
});
