"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleDot, Undo2 } from "lucide-react";
import { Banner, Button, Card, Input, cx } from "@/components/ui";
import { FLOW_ICON, IconTile, KIND_ICON } from "@/components/icons";
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
        <ul className="divide-y divide-rule">
          {rows.map((r) => {
            const struck = !!r.reversedBy;
            const icon = r.flow ? FLOW_ICON[r.flow] : (KIND_ICON[r.entryKind] ?? CircleDot);
            const tone =
              r.entryKind === "reversal" || struck
                ? "plain"
                : r.entryKind === "expense" || r.entryKind === "udhaar_given"
                  ? "out"
                  : r.entryKind === "service" || r.entryKind === "udhaar_payment"
                    ? "in"
                    : "plain";
            const showEarning = r.flow !== null || r.earning !== 0;
            return (
              <li key={r.id} className={cx("flex gap-3 px-5 py-3", r.reversalOf && "bg-danger-soft/40")}>
                <span className="flex w-12 shrink-0 flex-col items-center gap-1">
                  <IconTile icon={icon} tone={tone} size="sm" />
                  <span className="money text-xs text-ink-soft">{r.time}</span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cx("font-medium", struck && "text-ink-soft line-through")}>{r.title}</p>
                  <p className="truncate text-sm text-ink-soft">
                    {[r.payment, r.customer, r.by].filter(Boolean).join(" · ")}
                  </p>
                  {r.reversedBy ? <p className="text-sm text-out">Reversed: {r.reversedBy.reason}</p> : null}
                  {r.reversalOf && r.note ? <p className="text-sm text-out">Reason: {r.note}</p> : null}
                  {!r.reversalOf && r.note ? <p className="text-sm text-ink-soft">{r.note}</p> : null}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={cx("money font-semibold", struck && "text-ink-soft line-through")}>{formatINR(r.amount)}</span>
                  {showEarning ? (
                    <span className={cx("money text-xs", r.earning < 0 ? "text-out" : "text-in")}>
                      {r.earning >= 0 ? "+" : ""}
                      {formatINR(r.earning)}
                    </span>
                  ) : null}
                  {!r.reversalOf && !r.reversedBy ? (
                    <button
                      type="button"
                      onClick={() => open(r)}
                      aria-label={`Reverse ${r.title} ${formatINR(r.amount)}`}
                      className="mt-1 inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-ink-soft hover:bg-paper hover:text-out"
                    >
                      <Undo2 size={13} /> Reverse
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
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
