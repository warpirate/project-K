import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, BookUser, Download, Sparkles, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { getAppContext } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { loadBalances } from "@/lib/balances";
import { formatINR } from "@/lib/money";
import { addDays, daysBetween, periodRange, previousRange, todayIST } from "@/lib/periods";
import { Card, cx } from "@/components/ui";
import { BarList, TrendBars } from "./charts";
import { FilterBar } from "./filter-bar";

type Totals = { profit: number; charges: number; commission: number; expenses: number; entries: number };
type Group = { key: string; label: string; profit: number; entries: number };

const ZERO: Totals = { profit: 0, charges: 0, commission: 0, expenses: 0, entries: 0 };
const num = (t: Record<string, unknown> | undefined): Totals =>
  t ? { profit: Number(t.profit), charges: Number(t.charges), commission: Number(t.commission), expenses: Number(t.expenses), entries: Number(t.entries) } : ZERO;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string; branch?: string }>;
}) {
  const ctx = await getAppContext();
  if (!ctx.isOwner) redirect("/");
  const sp = await searchParams;
  const today = todayIST();
  const range = periodRange(sp.period ?? "today", today, sp.from, sp.to);
  const prev = previousRange(range);
  const branch = sp.branch && ctx.branches.some((b) => b.id === sp.branch) ? sp.branch : "all";
  const p_branch = branch === "all" ? undefined : branch;
  const trendFrom = daysBetween(range.from, range.to) >= 14 ? range.from : addDays(range.to, -29);

  const supabase = await createClient();
  const g = (by: string, from = range.from, to = range.to) => supabase.rpc("report_groups", { p_from: from, p_to: to, p_group: by, p_branch });
  const [cur, before, byService, byBranch, byStaff, byDay, balances, dues, closes, toReview] = await Promise.all([
    supabase.rpc("report_totals", { p_from: range.from, p_to: range.to, p_branch }),
    supabase.rpc("report_totals", { p_from: prev.from, p_to: prev.to, p_branch }),
    g("service"),
    g("branch"),
    g("staff"),
    g("day", trendFrom, range.to),
    loadBalances(),
    supabase.from("customer_dues").select("due"),
    supabase.from("day_closes").select("business_date, difference, branch_id, note").neq("difference", 0).gte("business_date", addDays(today, -6)).order("business_date", { ascending: false }),
    supabase.from("services").select("id", { count: "exact", head: true }).eq("reviewed", false),
  ]);

  const t = num(cur.data?.[0]);
  const p = num(before.data?.[0]);
  const groups = (r: { data: unknown }) => ((r.data ?? []) as Group[]).map((x) => ({ ...x, profit: Number(x.profit), entries: Number(x.entries) }));
  const dayMap = new Map(groups(byDay).map((d) => [d.key, d.profit]));
  const trend = Array.from({ length: daysBetween(trendFrom, range.to) }, (_, i) => {
    const date = addDays(trendFrom, i);
    return { date, value: dayMap.get(date) ?? 0 };
  });
  const branchName = (id: string) => ctx.branches.find((b) => b.id === id)?.name ?? "";
  const shownBalances = balances.filter((b) => branch === "all" || b.branch_id === branch);
  const negative = shownBalances.filter((b) => b.balance < 0);
  const udhaar = (dues.data ?? []).reduce((s, d) => s + Math.max(Number(d.due), 0), 0);
  const exportHref = `/dashboard/export?period=${range.key}&from=${range.from}&to=${range.to}&branch=${branch}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Dashboard</h1>
          <p className="text-ink-soft">
            {range.label} · {branch === "all" ? "All branches" : branchName(branch)}
          </p>
        </div>
        <a href={exportHref} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-rule-strong bg-raised px-4 text-sm font-medium hover:border-ink-soft">
          <Download size={16} /> Download entries (Excel)
        </a>
      </div>

      <FilterBar period={range.key} from={range.from} to={range.to} branch={branch} branches={ctx.branches} />

      <section aria-label="Totals" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Tile big label="Profit" value={t.profit} prev={p.profit} />
        <Tile label="Your charges" value={t.charges} prev={p.charges} />
        <Tile label="Commission" value={t.commission} prev={p.commission} />
        <Tile label="Expenses" value={t.expenses} prev={p.expenses} lowerIsBetter />
        <Tile label="Entries" value={t.entries} prev={p.entries} count />
      </section>

      <Alerts
        items={[
          ...(closes.data ?? []).map((c) => ({
            icon: "warn" as const,
            text: `${branchName(c.branch_id)}: cash ${Number(c.difference) < 0 ? "short" : "extra"} ${formatINR(Math.abs(Number(c.difference)))} on ${c.business_date}${c.note ? ` (${c.note})` : ""}`,
            href: "/close",
          })),
          ...negative.map((b) => ({ icon: "warn" as const, text: `${b.name} (${branchName(b.branch_id)}) is below zero: ${formatINR(b.balance)}`, href: "/money" })),
          ...(udhaar > 0 ? [{ icon: "udhaar" as const, text: `Udhaar outstanding: ${formatINR(udhaar)}`, href: "/udhaar" }] : []),
          ...((toReview.count ?? 0) > 0 ? [{ icon: "new" as const, text: `${toReview.count} new service(s) added by staff: check their charges`, href: "/settings" }] : []),
        ]}
      />

      <Card>
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl">Profit per day</h2>
          <span className="text-sm text-ink-soft">{trend.length} days</span>
        </div>
        <div className="mt-6">
          <TrendBars days={trend} />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="font-display text-xl">Profit by service</h2>
          <div className="mt-4">
            <BarList rows={groups(byService).map((s) => ({ label: s.label, value: s.profit, sub: s.entries ? `${s.entries}×` : undefined }))} />
          </div>
        </Card>
        <div className="flex flex-col gap-6">
          {branch === "all" && ctx.branches.length > 1 ? (
            <Card>
              <h2 className="font-display text-xl">Profit by branch</h2>
              <div className="mt-4">
                <BarList rows={groups(byBranch).map((s) => ({ label: s.label, value: s.profit, sub: `${s.entries}×` }))} />
              </div>
            </Card>
          ) : null}
          <Card>
            <h2 className="font-display text-xl">Profit by person</h2>
            <div className="mt-4">
              <BarList rows={groups(byStaff).map((s) => ({ label: s.label, value: s.profit, sub: `${s.entries}×` }))} />
            </div>
          </Card>
        </div>
      </div>

      <Card>
        <div className="flex items-center gap-2">
          <Wallet size={18} className="text-ink-soft" />
          <h2 className="font-display text-xl">Money now</h2>
        </div>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          {ctx.branches
            .filter((b) => branch === "all" || b.id === branch)
            .map((b) => {
              const list = balances.filter((a) => a.branch_id === b.id);
              return (
                <div key={b.id}>
                  <h3 className="border-b border-rule pb-1 text-sm font-medium text-ink-soft">{b.name}</h3>
                  <ul>
                    {list.map((a) => (
                      <li key={a.account_id} className="flex justify-between gap-3 py-1.5">
                        <span>{a.name}</span>
                        <span className={cx("money", a.balance < 0 && "text-out")}>{formatINR(a.balance)}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="flex justify-between border-t border-ink pt-1.5 font-medium">
                    <span>Total</span>
                    <span className="money">{formatINR(list.reduce((s, a) => s + a.balance, 0))}</span>
                  </p>
                </div>
              );
            })}
        </div>
      </Card>
    </div>
  );
}

function Tile({
  label,
  value,
  prev,
  big,
  count,
  lowerIsBetter,
}: {
  label: string;
  value: number;
  prev: number;
  big?: boolean;
  count?: boolean;
  lowerIsBetter?: boolean;
}) {
  const change = prev === 0 ? null : Math.round(((value - prev) / Math.abs(prev)) * 100);
  const up = value > prev;
  const good = value === prev ? null : lowerIsBetter ? !up : up;
  return (
    <div className={cx("rounded-2xl border border-rule bg-raised p-4", big && "col-span-2 border-accent/40 lg:col-span-1")}>
      <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">{label}</p>
      <p className={cx("money mt-1 font-semibold", big ? "text-3xl" : "text-xl sm:text-2xl", !count && value < 0 && "text-out")}>
        {count ? value : formatINR(value)}
      </p>
      <p className="mt-1 flex items-center gap-1 text-xs text-ink-soft">
        {value === prev ? (
          "same as before"
        ) : (
          <>
            {up ? <TrendingUp size={14} className={good ? "text-in" : "text-out"} /> : <TrendingDown size={14} className={good ? "text-in" : "text-out"} />}
            {change === null ? "new" : `${up ? "+" : ""}${change}%`} vs previous
          </>
        )}
      </p>
    </div>
  );
}

function Alerts({ items }: { items: { icon: "warn" | "udhaar" | "new"; text: string; href: string }[] }) {
  if (items.length === 0) return null;
  const Icon = { warn: AlertTriangle, udhaar: BookUser, new: Sparkles };
  return (
    <section aria-label="Needs attention" className="rounded-2xl border border-highlight/50 bg-highlight/10 p-4">
      <h2 className="text-sm font-semibold">Needs attention</h2>
      <ul className="mt-2 flex flex-col gap-1.5">
        {items.map((a, i) => {
          const I = Icon[a.icon];
          return (
            <li key={i}>
              <Link href={a.href} className="flex items-start gap-2 text-sm hover:underline">
                <I size={16} className={cx("mt-0.5 shrink-0", a.icon === "warn" ? "text-out" : "text-ink-soft")} aria-hidden />
                {a.text}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
