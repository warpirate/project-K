import Link from "next/link";
import { BookUser, ChevronRight, PiggyBank } from "lucide-react";
import { getAppContext } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { loadBalances, TYPE_LABEL } from "@/lib/balances";
import { formatINR } from "@/lib/money";
import { Card, cx } from "@/components/ui";
import { ACCOUNT_ICON, IconTile } from "@/components/icons";
import { MoneyForms } from "./money-forms";

export default async function MoneyPage() {
  const ctx = await getAppContext();
  if (!ctx.branchId) return <p className="text-ink-soft">No branch selected.</p>;

  // Owner can move money to any branch, so load everything they can see.
  const supabase = await createClient();
  const [all, { data: dues }] = await Promise.all([
    loadBalances(ctx.isOwner ? undefined : ctx.branchId),
    supabase.from("customer_dues").select("due").neq("due", 0).limit(5000),
  ]);
  const here = all.filter((a) => a.branch_id === ctx.branchId);
  const total = here.reduce((s, a) => s + a.balance, 0);
  const branchName = (id: string) => ctx.branches.find((b) => b.id === id)?.name ?? "";
  // Udhaar is shop-wide: a customer may take it in one branch and pay back in another.
  const owed = (dues ?? []).filter((d) => Number(d.due) > 0);
  const advances = (dues ?? []).filter((d) => Number(d.due) < 0);
  const owedTotal = owed.reduce((s, d) => s + Number(d.due), 0);
  const advanceTotal = advances.reduce((s, d) => s - Number(d.due), 0);
  const manyBranches = ctx.branches.length > 1;

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
              <div className="flex min-w-0 items-center gap-3">
                <IconTile icon={ACCOUNT_ICON[a.type]} tone={a.type === "cash" ? "accent" : "plain"} />
                <div className="min-w-0">
                  <p className="truncate font-medium">{a.name}</p>
                  <p className="text-xs text-ink-soft">{TYPE_LABEL[a.type]}</p>
                </div>
              </div>
              <span className={cx("money text-lg font-semibold", a.balance < 0 && "text-out")}>{formatINR(a.balance)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex items-center justify-between border-t-2 border-ink pt-3">
          <span className="font-medium">Money in hand</span>
          <span className="money text-xl font-semibold">{formatINR(total)}</span>
        </div>

        <h2 className="mt-7 flex items-baseline justify-between gap-3">
          <span className="font-display text-xl">Udhaar</span>
          {manyBranches ? <span className="text-sm text-ink-soft">All branches</span> : null}
        </h2>
        <ul className="mt-2 divide-y divide-rule">
          <li>
            <Link href="/udhaar" className="flex items-center justify-between gap-3 rounded-lg py-3 hover:bg-paper">
              <div className="flex items-center gap-3">
                <IconTile icon={BookUser} tone="out" />
                <div>
                  <p className="font-medium">People owe you</p>
                  <p className="text-xs text-ink-soft">
                    {owed.length === 0 ? "Nobody" : `${owed.length} ${owed.length === 1 ? "person" : "people"}`} · comes back later
                  </p>
                </div>
              </div>
              <span className="flex items-center gap-1">
                <span className="money text-lg font-semibold text-out">{formatINR(owedTotal)}</span>
                <ChevronRight size={16} className="text-ink-soft" aria-hidden />
              </span>
            </Link>
          </li>
          {advanceTotal > 0 ? (
            <li>
              <Link href="/udhaar" className="flex items-center justify-between gap-3 rounded-lg py-3 hover:bg-paper">
                <div className="flex items-center gap-3">
                  <IconTile icon={PiggyBank} tone="in" />
                  <div>
                    <p className="font-medium">Advance you are keeping</p>
                    <p className="text-xs text-ink-soft">
                      {advances.length} {advances.length === 1 ? "person" : "people"} · not your money
                    </p>
                  </div>
                </div>
                <span className="flex items-center gap-1">
                  <span className="money text-lg font-semibold">−{formatINR(advanceTotal)}</span>
                  <ChevronRight size={16} className="text-ink-soft" aria-hidden />
                </span>
              </Link>
            </li>
          ) : null}
        </ul>
        <div className="mt-2 flex items-center justify-between rounded-xl bg-paper px-4 py-3">
          <span>
            <span className="block font-medium">Total with udhaar</span>
            <span className="text-xs text-ink-soft">Money in hand + owed to you{advanceTotal > 0 ? " − advances" : ""}</span>
          </span>
          <span className="money text-xl font-semibold">{formatINR(total + owedTotal - advanceTotal)}</span>
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
