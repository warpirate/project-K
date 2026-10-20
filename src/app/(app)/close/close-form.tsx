"use client";

import { useState } from "react";
import { Banner, Button, Field, Input, cx } from "@/components/ui";
import { formatINR, rupeesToPaise } from "@/lib/money";
import { createClient } from "@/lib/supabase/client";
import { useSubmit } from "@/lib/use-submit";

export function CloseForm({ branchId, expected }: { branchId: string; expected: number }) {
  const { busy, error, run, setError } = useSubmit();
  const [counted, setCounted] = useState("");
  const [note, setNote] = useState("");
  const countedPaise = rupeesToPaise(counted);
  const diff = countedPaise === null ? null : countedPaise - expected;

  const submit = async () => {
    if (countedPaise === null) return setError("Type the cash you counted, like 15400");
    await run(
      () => createClient().rpc("close_day", { p_branch_id: branchId, p_counted_cash: countedPaise, p_note: note.trim() || undefined }),
      "Day closed",
    );
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="flex items-baseline justify-between rounded-xl border border-rule px-4 py-3">
        <span className="text-ink-soft">Should be in drawer</span>
        <span className="money text-xl font-semibold">{formatINR(expected)}</span>
      </div>
      <Field label="Cash you counted (₹)" htmlFor="counted">
        <Input id="counted" inputMode="decimal" className="money min-h-13 text-2xl" placeholder="0" value={counted} onChange={(e) => setCounted(e.target.value)} autoFocus />
      </Field>
      {diff !== null ? (
        <div
          className={cx(
            "rise rounded-xl px-4 py-3 text-center text-lg font-semibold",
            diff === 0 ? "bg-accent-soft text-in" : diff < 0 ? "bg-danger-soft text-out" : "bg-highlight/15",
          )}
        >
          {diff === 0 ? "Matched ✓" : diff < 0 ? `Short by ${formatINR(-diff)}` : `Extra ${formatINR(diff)}`}
        </div>
      ) : null}
      {diff !== null && diff !== 0 ? (
        <Field label="Reason (optional)" htmlFor="close-note">
          <Input id="close-note" placeholder="e.g. gave change from pocket" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      ) : null}
      {error ? <Banner>{error}</Banner> : null}
      <Button type="submit" disabled={busy} className="min-h-12">
        {busy ? "Closing…" : "Close the day"}
      </Button>
    </form>
  );
}
