import { getAppContext } from "@/lib/session";
import { loadBalances, TYPE_LABEL } from "@/lib/balances";
import { formatINR } from "@/lib/money";
import { Card, cx } from "@/components/ui";
import { MoneyForms } from "./money-forms";

export default async function MoneyPage() {
  const ctx = await getAppContext();
  if (!ctx.branchId) return <p className="text-ink-soft">No branch selected.</p>;

  // Owner can move money to any branch, so load everything they can see.
  const all = await loadBalances(ctx.isOwner ? undefined : ctx.branchId);
  const here = all.filter((a) => a.branch_id === ctx.branchId);
  const total = here.reduce((s, a) => s + a.balance, 0);
  const branchName = (id: string) => ctx.branches.find((b) => b.id === id)?.name ?? "";

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <Card>
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="font-display text-2xl">Money now</h1>
          <span className="text-sm text-ink-soft">{branchName(ctx.branchId)}</span>
        </div>
        <ul className="mt-4 divide-y divide-rule">
          {here.map((a) => (
            <li key={a.account_id} className="flex items-center justify-between gap-3 py-3">
              <div>
                <p className="font-medium">{a.name}</p>
                <p className="text-xs text-ink-soft">{TYPE_LABEL[a.type]}</p>
              </div>
              <span className={cx("money text-lg font-semibold", a.balance < 0 && "text-out")}>{formatINR(a.balance)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex items-center justify-between border-t-2 border-ink pt-3">
          <span className="font-medium">Total</span>
          <span className="money text-xl font-semibold">{formatINR(total)}</span>
        </div>
        {here.some((a) => a.balance < 0) ? (
          <p className="mt-3 text-sm text-out">
            A balance below zero usually means a missing entry or a wrong opening balance.
            {ctx.isOwner ? " Use “Fix a balance” to correct it." : " Tell the owner."}
          </p>
        ) : null}
      </Card>
      <MoneyForms
        branchId={ctx.branchId}
        isOwner={ctx.isOwner}
        here={here}
        all={all.map((a) => ({ ...a, branchName: branchName(a.branch_id) }))}
      />
    </div>
  );
}
