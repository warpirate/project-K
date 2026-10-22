"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, CircleDot, Undo2 } from "lucide-react";
import { Banner, Button, Card, Input, cx } from "@/components/ui";
import { IconTile, KIND_ICON, ServiceGlyph } from "@/components/icons";
import type { Flow } from "@/lib/rules";
import { formatINR } from "@/lib/money";
import { createClient } from "@/lib/supabase/client";

export interface TodayRow {
  id: string;
  time: string;
  title: string;
  kind: string;
  /** Service type for service entries, else null. */
  flow: Flow | null;
  /** transactions.kind, or "reversal" for reversals. */
  entryKind: string;
  amount: number;
  earning: number;
  payment: string;
  customer: string | null;
  by: string | null;
  note: string | null;
  reversalOf: string | null;
  reversedBy: { reason: string } | null;
}

type Filter = "all" | "service" | "udhaar" | "money";
const LIMIT = 10;

/** Which chip an entry belongs to; balance fixes are folded away on their own. */
function groupOf(r: TodayRow): Filter | "fix" {
  if (r.entryKind === "opening_balance") return "fix";
  if (r.entryKind === "udhaar_payment" || r.entryKind === "udhaar_given" || /Udhaar/.test(r.payment)) return "udhaar";
  if (r.entryKind === "expense" || r.entryKind === "transfer") return "money";
  return "service";
}

export function TodayList({ rows, totalEarning }: { rows: TodayRow[]; totalEarning: number }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [target, setTarget] = useState<TodayRow | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [clientId, setClientId] = useState(() => crypto.randomUUID());

  const open = (r: TodayRow) => {
    setTarget(r);
    setReason("");
    setError(undefined);
    setClientId(crypto.randomUUID());
    dialog.current?.showModal();
  };

  const reverse = async () => {
    if (!target) return;
    if (!reason.trim()) return setError("Write why you are reversing it");
    setBusy(true);
    const { error: err } = await createClient().rpc("reverse_transaction", {
      p_client_id: clientId,
      p_transaction_id: target.id,
      p_reason: reason.trim(),
    });
    setBusy(false);
    if (err) return setError(err.message);
    dialog.current?.close();
    router.refresh();
  };

  const [filter, setFilter] = useState<Filter>("all");
  const [showAll, setShowAll] = useState(false);
  const [showFixes, setShowFixes] = useState(false);
  // Only name who made the entry when more than one person is entering today.
  const manyPeople = new Set(rows.map((r) => r.by)).size > 1;

  const fixes = rows.filter((r) => groupOf(r) === "fix");
  const main = rows.filter((r) => groupOf(r) !== "fix");
  const filtered = filter === "all" ? main : rows.filter((r) => groupOf(r) === filter);
  const shown = showAll ? filtered : filtered.slice(0, LIMIT);
  const groups = (
    [
      { value: "all", label: "All", count: main.length },
      { value: "service", label: "Services", count: rows.filter((r) => groupOf(r) === "service").length },
      { value: "udhaar", label: "Udhaar", count: rows.filter((r) => groupOf(r) === "udhaar").length },
      { value: "money", label: "Expenses & moves", count: rows.filter((r) => groupOf(r) === "money").length },
    ] as const
  ).filter((g) => g.value === "all" || g.count > 0);

  const renderRow = (r: TodayRow) => {
    const struck = !!r.reversedBy;
    const icon = KIND_ICON[r.entryKind] ?? CircleDot;
    const tone =
      r.entryKind === "reversal" || struck
        ? "plain"
        : r.entryKind === "expense" || r.entryKind === "udhaar_given"
          ? "out"
          : r.entryKind === "service" || r.entryKind === "udhaar_payment"
            ? "in"
            : "plain";
    const showEarning = r.flow !== null || r.earning !== 0;
    const sub = [r.time, r.payment, r.customer, manyPeople ? r.by : null, !r.reversalOf ? r.note : null].filter(Boolean).join(" · ");
    return (
      <li key={r.id} className={cx("flex items-center gap-3 px-4 py-2.5", r.reversalOf && "bg-danger-soft/40")}>
        {r.flow && !r.reversalOf ? <ServiceGlyph name={r.title} flow={r.flow} size="sm" /> : <IconTile icon={icon} tone={tone} size="sm" />}
        <div className="min-w-0 flex-1">
          <p className={cx("truncate font-medium", struck && "text-ink-soft line-through")}>{r.title}</p>
          <p className="truncate text-sm text-ink-soft">{sub}</p>
          {r.reversedBy ? <p className="truncate text-sm text-out">Reversed: {r.reversedBy.reason}</p> : null}
          {r.reversalOf && r.note ? <p className="truncate text-sm text-out">Reason: {r.note}</p> : null}
        </div>
        <div className="flex shrink-0 flex-col items-end">
          <span className={cx("money font-semibold", struck && "text-ink-soft line-through")}>{formatINR(r.amount)}</span>
          {showEarning ? (
            <span className={cx("money text-xs", r.earning < 0 ? "text-out" : "text-in")}>
              {r.earning >= 0 ? "+" : ""}
              {formatINR(r.earning)}
            </span>
          ) : null}
        </div>
        {!r.reversalOf && !r.reversedBy ? (
          <button
            type="button"
            onClick={() => open(r)}
            aria-label={`Reverse ${r.title} ${formatINR(r.amount)}`}
            title="Reverse"
            className="-mr-1 inline-flex size-9 shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-paper hover:text-out"
          >
            <Undo2 size={16} />
          </button>
        ) : (
          <span className="w-8 shrink-0" />
        )}
      </li>
    );
  };

  return (
    <Card className="p-0 sm:p-0">
      <div className="flex items-baseline justify-between border-b border-rule px-5 py-4">
        <h2 className="font-display text-2xl">Today</h2>
        <p className="text-sm text-ink-soft">
          Earned <span className="money text-base font-semibold text-ink">{formatINR(totalEarning)}</span>
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-10 text-center text-ink-soft">No entries yet today. Your first one will show up here.</p>
      ) : (
        <>
          {groups.length > 1 ? (
            <div className="flex gap-1.5 overflow-x-auto border-b border-rule px-4 py-2.5">
              {groups.map((g) => (
                <button
                  key={g.value}
                  type="button"
                  aria-pressed={filter === g.value}
                  onClick={() => {
                    setFilter(g.value);
                    setShowAll(false);
                  }}
                  className={cx(
                    "min-h-8 shrink-0 rounded-full border px-3 text-sm transition",
                    filter === g.value ? "border-accent bg-accent text-accent-ink" : "border-rule-strong text-ink-soft hover:text-ink",
                  )}
                >
                  {g.label} <span className="opacity-70">{g.count}</span>
                </button>
              ))}
            </div>
          ) : null}
          <ul className="divide-y divide-rule">{shown.map(renderRow)}</ul>
          {filtered.length > LIMIT ? (
            <button type="button" onClick={() => setShowAll(!showAll)} className="w-full border-t border-rule px-5 py-3 text-sm font-medium text-accent hover:bg-paper">
              {showAll ? "Show less" : `Show all ${filtered.length}`}
            </button>
          ) : null}
          {filter === "all" && fixes.length ? (
            <div className="border-t border-rule">
              <button
                type="button"
                aria-expanded={showFixes}
                onClick={() => setShowFixes(!showFixes)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-ink-soft hover:bg-paper"
              >
                <IconTile icon={KIND_ICON.opening_balance} size="sm" />
                <span className="flex-1">
                  {fixes.length} balance {fixes.length === 1 ? "fix" : "fixes"}
                </span>
                <ChevronDown size={16} className={cx("transition", showFixes && "rotate-180")} aria-hidden />
              </button>
              {showFixes ? <ul className="divide-y divide-rule border-t border-rule">{fixes.map(renderRow)}</ul> : null}
            </div>
          ) : null}
        </>
      )}

      <dialog ref={dialog} className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-rule bg-raised p-0 text-ink shadow-2xl">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void reverse();
          }}
          className="flex flex-col gap-4 p-6"
        >
          <h2 className="font-display text-2xl">Reverse entry?</h2>
          {target ? (
            <p className="text-ink-soft">
              {target.title} · <span className="money">{formatINR(target.amount)}</span>. Balances go back to how they were; the
              entry stays visible, marked reversed.
            </p>
          ) : null}
          {error ? <Banner>{error}</Banner> : null}
          <Input autoFocus placeholder="Reason, e.g. wrong amount" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason" />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => dialog.current?.close()}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" disabled={busy}>
              {busy ? "Reversing…" : "Reverse"}
            </Button>
          </div>
        </form>
      </dialog>
    </Card>
  );
}
