import type { Flow } from "@/lib/rules";

/** Plain-language names for money flows, shown wherever someone picks a service type. */
export const FLOWS: { value: Flow; label: string; help: string }[] = [
  {
    value: "cash_out",
    label: "Cash withdrawal",
    help: "AEPS, micro-ATM, UPI-to-cash: you give cash, the money comes into your wallet or bank",
  },
  { value: "cash_in", label: "Money transfer / deposit", help: "Customer gives you cash, you send it from your wallet" },
  { value: "pay_through", label: "Recharge / bill payment", help: "Customer pays you, you pay the bill from your wallet" },
  {
    value: "application",
    label: "Online application",
    help: "PAN, Aadhaar, certificates: you charge the customer, the portal may cut a fee from your wallet",
  },
  { value: "counter_sale", label: "Shop item / counter sale", help: "Xerox, print, lamination, photos: all the money is yours" },
];

export const flowLabel = (f: Flow) => FLOWS.find((x) => x.value === f)?.label ?? f;

/** Which inputs make sense for a flow. */
export const flowUses = (f: Flow) => ({
  wallet: f !== "counter_sale",
  fee: f === "cash_out" || f === "cash_in" || f === "pay_through",
  commission: f === "cash_out" || f === "cash_in" || f === "pay_through",
  portalCost: f === "application",
});

/** Words used on the entry screen for each flow. */
export function flowCopy(f: Flow) {
  switch (f) {
    case "cash_out":
      return {
        amount: "Withdrawal amount (₹)",
        account: "Money comes into",
        money: "Give customer",
        pay: "How do you give the money?",
        charge: "Your charge (cut from the cash you give)",
      };
    case "cash_in":
      return {
        amount: "Amount to send (₹)",
        account: "Send from",
        money: "Take from customer",
        pay: "How did the customer pay?",
        charge: "Your charge (added to what customer pays)",
      };
    case "pay_through":
      return {
        amount: "Recharge / bill amount (₹)",
        account: "Pay from",
        money: "Take from customer",
        pay: "How did the customer pay?",
        charge: "Your extra charge (if any)",
      };
    case "application":
      return {
        amount: "Charge to customer (₹)",
        account: "Portal fee paid from",
        money: "Take from customer",
        pay: "How did the customer pay?",
        charge: "",
      };
    case "counter_sale":
      return { amount: "Amount (₹)", account: "", money: "Take from customer", pay: "How did the customer pay?", charge: "" };
  }
}
