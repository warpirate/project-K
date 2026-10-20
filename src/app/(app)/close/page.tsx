import { getAppContext } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { loadBalances } from "@/lib/balances";
import { formatINR } from "@/lib/money";
import { Card, cx } from "@/components/ui";
import { CloseForm } from "./close-form";

const todayIST = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
const dayLabel = (d: string) =>
  new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));

export default async function ClosePage() {
  const ctx = await getAppContext();
  if (!ctx.branchId) return <p className="text-ink-soft">No branch selected.</p>;
  const supabase = await createClient();
  const today = todayIST();
  const [accounts, { data: closes }, { data: totals }] = await Promise.all([
    loadBalances(ctx.branchId),
    supabase
      .from("day_closes")
      .select("id, business_date, expected_cash, counted_cash, difference, note, closed_by")
      .eq("branch_id", ctx.branchId)
      .order("business_date", { ascending: false })
      .limit(14),
    supabase.rpc("report_totals", { p_from: today, p_to: today, p_branch: ctx.branchId }),
  ]);
  const expected = accounts.filter((a) => a.type === "cash").reduce((s, a) => s + a.balance, 0);
  const todayClose = (closes ?? []).find((c) => c.business_date === today);
  const t = totals?.[0];

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <Card>
        <h1 className="font-display text-2xl">Close the day</h1>
        <p className="mt-1 text-ink-soft">Count the cash in the drawer and type it. The app tells you if anything is short or extra.</p>
        {t ? (
          <dl className="mt-5 grid grid-cols-3 gap-3 rounded-xl bg-paper p-4 text-center">
            <div>
              <dt className="text-xs text-ink-soft">Entries</dt>
              <dd className="money text-lg font-semibold">{Number(t.entries)}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-soft">Earned</dt>
              <dd className="money text-lg font-semibold text-in">{formatINR(Number(t.profit))}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-soft">Expenses</dt>
              <dd className="money text-lg font-semibold">{formatINR(Number(t.expenses))}</dd>
            </div>
          </dl>
        ) : null}
        <div className="mt-5">
          {todayClose ? (
            <div className="rounded-xl border border-accent bg-accent-soft p-4">
              <p className="font-medium">Today is closed.</p>
              <p className="mt-1 text-sm">
                Expected <span className="money">{formatINR(Number(todayClose.expected_cash))}</span> · counted{" "}
                <span className="money">{formatINR(Number(todayClose.counted_cash))}</span> ·{" "}
                <DiffText diff={Number(todayClose.difference)} />
              </p>
            </div>
          ) : (
            <CloseForm branchId={ctx.branchId} expected={expected} />
          )}
        </div>
      </Card>
      <Card>
        <h2 className="font-display text-2xl">Last days</h2>
        {(closes ?? []).length === 0 ? (
          <p className="py-10 text-center text-ink-soft">No days closed yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-rule">
            {(closes ?? []).map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                <span>
                  <span className="block font-medium">{dayLabel(c.business_date)}</span>
                  {c.note ? <span className="text-sm text-ink-soft">{c.note}</span> : null}
                </span>
                <span className="text-right">
                  <span className="money block">{formatINR(Number(c.counted_cash))}</span>
                  <DiffText diff={Number(c.difference)} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function DiffText({ diff }: { diff: number }) {
  if (diff === 0) return <span className="text-sm text-in">matched ✓</span>;
  return (
    <span className={cx("money text-sm font-medium", diff < 0 ? "text-out" : "text-highlight")}>
      {diff < 0 ? `short ${formatINR(-diff)}` : `extra ${formatINR(diff)}`}
    </span>
  );
}
