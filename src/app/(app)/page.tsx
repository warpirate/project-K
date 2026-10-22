import { getAppContext } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { flowLabel } from "@/lib/flows";
import type { Flow } from "@/lib/rules";
import { EntryForm } from "./entry-form";
import { TodayList, type TodayRow } from "./today-list";
import type { AccountOption, CustomerOption, ServiceOption } from "./types";

const KIND_TITLE: Record<string, string> = {
  expense: "Expense",
  transfer: "Move money",
  udhaar_payment: "Udhaar paid back",
  udhaar_given: "Udhaar given",
  opening_balance: "Balance set",
};

const todayIST = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
const timeIST = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));

type Line = { amount: number; customer_id: string | null; accounts: { name: string; type: string } | null };

/**
 * How the customer side was settled: "Cash", "SBI UPI", "Udhaar", "Cash + Udhaar".
 * Customer-side lines are money out for withdrawals (shop gives) and money in otherwise;
 * the portal/bank line moves the other way, and a negative cash line on a payment is change given back.
 */
function paymentSummary(lines: Line[], flow: Flow): string {
  const customerSide = lines.filter((l) => (flow === "cash_out" ? l.amount < 0 : l.amount > 0 || l.customer_id));
  const labels = customerSide.map((l) => (l.customer_id ? "Udhaar" : l.accounts!.type === "cash" ? "Cash" : l.accounts!.name));
  const hasChange = flow !== "cash_out" && lines.some((l) => !l.customer_id && l.amount < 0 && l.accounts?.type === "cash");
  const unique = labels.filter((v, i, a) => a.indexOf(v) === i).join(" + ");
  return hasChange ? `${unique} (change given)` : unique;
}

/** Which account an expense, transfer or udhaar entry used: "Cash", "SBI", "Cash → SBI". */
function accountSummary(lines: Line[], kind: string): string {
  const name = (l: Line) => (l.accounts!.type === "cash" ? "Cash" : l.accounts!.name);
  const acct = lines.filter((l) => l.accounts);
  if (kind === "transfer") {
    const from = acct.find((l) => l.amount < 0);
    const to = acct.find((l) => l.amount > 0);
    return from && to ? `${name(from)} → ${name(to)}` : "";
  }
  return acct.map(name).filter((v, i, a) => a.indexOf(v) === i).join(" + ");
}

export default async function HomePage() {
  const ctx = await getAppContext();
  if (!ctx.branchId) {
    return <p className="text-ink-soft">Your account has no branch yet. Ask the owner to assign you to one.</p>;
  }
  const supabase = await createClient();

  const [services, accounts, customers, txns] = await Promise.all([
    supabase.from("services").select("id, name, flow, category, aliases, fee_rule, commission_rule, portal_cost_rule").eq("active", true).order("name"),
    supabase.from("accounts").select("id, name, type").eq("branch_id", ctx.branchId).eq("active", true).order("created_at"),
    supabase.from("customers").select("id, name, phone").order("name").limit(2000),
    supabase
      .from("transactions")
      .select(
        "id, kind, amount, earning, note, created_at, created_by, reversal_of, services(name, flow), customers(name), ledger_lines(amount, customer_id, accounts(name, type))",
      )
      .eq("branch_id", ctx.branchId)
      .eq("business_date", todayIST())
      .order("created_at", { ascending: false }),
  ]);

  const { data: people } = await supabase.from("profiles").select("user_id, name");
  const nameOf = new Map((people ?? []).map((p) => [p.user_id, p.name]));

  const all = txns.data ?? [];
  const reversals = new Map(all.filter((t) => t.reversal_of).map((t) => [t.reversal_of!, t.note ?? ""]));
  const titleOf = new Map(all.map((t) => [t.id, t.services?.name ?? KIND_TITLE[t.kind] ?? t.kind]));

  const rows: TodayRow[] = all.map((t) => {
    const lines = (t.ledger_lines ?? []) as Line[];
    const flow = t.services?.flow as Flow | undefined;
    return {
      id: t.id,
      time: timeIST(t.created_at),
      title: t.reversal_of ? `Reversal: ${titleOf.get(t.reversal_of) ?? ""}` : titleOf.get(t.id)!,
      kind: flow ? flowLabel(flow) : t.kind,
      flow: flow ?? null,
      entryKind: t.reversal_of ? "reversal" : t.kind,
      amount: Number(t.amount),
      earning: Number(t.earning),
      payment: t.kind === "service" && flow ? paymentSummary(lines, flow) : t.reversal_of ? "" : accountSummary(lines, t.kind),
      customer: t.customers?.name ?? null,
      by: nameOf.get(t.created_by) ?? null,
      note: t.note,
      reversalOf: t.reversal_of,
      reversedBy: reversals.has(t.id) ? { reason: reversals.get(t.id)! } : null,
    };
  });
  const totalEarning = rows.reduce((s, r) => s + r.earning, 0);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <EntryForm
        shopId={ctx.profile.shop_id}
        branchId={ctx.branchId}
        isOwner={ctx.isOwner}
        services={(services.data ?? []) as unknown as ServiceOption[]}
        accounts={(accounts.data ?? []) as AccountOption[]}
        customers={(customers.data ?? []) as CustomerOption[]}
      />
      <TodayList rows={rows} totalEarning={totalEarning} />
    </div>
  );
}
