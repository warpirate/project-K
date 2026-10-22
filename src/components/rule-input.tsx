"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { formatINR, rupeesToPaise } from "@/lib/money";
import { calcRule, emptySlabs, ruleFromDraft, type RuleDraft, type SlabRow } from "@/lib/rules";
import { Input, cx } from "@/components/ui";

export type { RuleDraft };

export const emptyRule: RuleDraft = { mode: "fixed", value: "" };

/**
 * "₹ / % / By amount" toggle plus a number box. "By amount" shows rows like
 * "up to ₹1,000 → ₹10", "up to ₹10,000 → ₹50", "above → ₹100".
 */
export function RuleInput({
  id,
  value,
  onChange,
  allowPercent = true,
  allowSlab = false,
  tryIt = false,
  label,
}: {
  id: string;
  value: RuleDraft;
  onChange: (v: RuleDraft) => void;
  allowPercent?: boolean;
  allowSlab?: boolean;
  /** Show a "Try an amount" box that works out the charge as you type. */
  tryIt?: boolean;
  label: string;
}) {
  const [tryAmount, setTryAmount] = useState("");
  const modes = (["fixed", "percent", "slab"] as const).filter((m) => (m === "percent" ? allowPercent : m === "slab" ? allowSlab : true));
  const modeLabel = { fixed: "₹", percent: "%", slab: "By amount" } as const;
  const slab = value.mode === "slab";
  const rows = value.slabs?.length ? value.slabs : emptySlabs();
  const setRows = (next: SlabRow[]) => onChange({ ...value, slabs: next });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-stretch overflow-hidden rounded-lg border border-rule-strong bg-raised focus-within:border-accent">
        {modes.length > 1 ? (
          <div role="radiogroup" aria-label={`${label} type`} className={slab ? "flex w-full" : "flex border-r border-rule-strong"}>
            {modes.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={value.mode === m}
                onClick={() => onChange({ ...value, mode: m, slabs: m === "slab" ? rows : value.slabs })}
                className={`min-h-10 min-w-10 px-2 text-sm font-medium ${slab ? "flex-1" : ""} ${
                  value.mode === m ? "bg-accent text-accent-ink" : "text-ink-soft hover:text-ink"
                }`}
              >
                {modeLabel[m]}
              </button>
            ))}
          </div>
        ) : (
          <span className="flex min-w-10 items-center justify-center border-r border-rule-strong text-sm text-ink-soft">₹</span>
        )}
        {slab ? null : (
          <Input
            id={id}
            aria-label={label}
            inputMode="decimal"
            placeholder="0"
            value={value.value}
            onChange={(e) => onChange({ ...value, value: e.target.value })}
            className="money min-h-10 rounded-none border-0 focus:border-0"
          />
        )}
      </div>

      {slab ? (
        <div className="flex flex-col gap-2 rounded-lg border border-dashed border-rule-strong p-3">
          {rows.map((r, i) => {
            const last = i === rows.length - 1;
            const update = (patch: Partial<SlabRow>) => setRows(rows.map((x, j) => (j === i ? { ...x, ...patch } : x)));
            return (
              <div key={i} className="flex items-center gap-2 text-sm">
                {last ? (
                  <span className="w-32 shrink-0 text-ink-soft">{rows.length === 1 ? "Any amount" : "Above that"}</span>
                ) : (
                  <label className="flex w-32 shrink-0 items-center gap-1 text-ink-soft">
                    Up to ₹
                    <Input
                      aria-label={`${label} up to amount ${i + 1}`}
                      inputMode="decimal"
                      value={r.upto}
                      onChange={(e) => update({ upto: e.target.value })}
                      className="money min-h-9 px-2"
                    />
                  </label>
                )}
                <span className="text-ink-soft">→</span>
                <div role="radiogroup" aria-label={`${label} row ${i + 1} type`} className="flex shrink-0 overflow-hidden rounded-md border border-rule-strong">
                  {(["fixed", "percent"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={(r.mode ?? "fixed") === m}
                      aria-label={m === "fixed" ? `Row ${i + 1} rupees` : `Row ${i + 1} percent`}
                      onClick={() => update({ mode: m })}
                      className={cx("min-h-9 w-8 text-sm font-medium", (r.mode ?? "fixed") === m ? "bg-accent text-accent-ink" : "text-ink-soft")}
                    >
                      {m === "fixed" ? "₹" : "%"}
                    </button>
                  ))}
                </div>
                <Input
                  aria-label={last ? `${label} above` : `${label} for amount ${i + 1}`}
                  inputMode="decimal"
                  placeholder="0"
                  value={r.value}
                  onChange={(e) => update({ value: e.target.value })}
                  className="money min-h-9 px-2"
                />
                {rows.length > 2 && !last ? (
                  <button type="button" aria-label="Remove row" onClick={() => setRows(rows.filter((_, j) => j !== i))} className="p-1 text-ink-soft hover:text-out">
                    <X size={16} />
                  </button>
                ) : (
                  <span className="w-6 shrink-0" />
                )}
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => setRows([...rows.slice(0, -1), { upto: "", value: "" }, rows[rows.length - 1]])}
            className="inline-flex items-center gap-1 self-start text-sm text-accent"
          >
            <Plus size={14} /> Add a row
          </button>
        </div>
      ) : null}

      {tryIt ? <TryAmount draft={value} amount={tryAmount} onAmount={setTryAmount} /> : null}
    </div>
  );
}

/** "Try ₹5000 → charge ₹50": checks the rule while it is being typed. */
function TryAmount({ draft, amount, onAmount }: { draft: RuleDraft; amount: string; onAmount: (v: string) => void }) {
  const paise = rupeesToPaise(amount);
  let result: string | null = null;
  if (paise) {
    try {
      result = `Charge ${formatINR(calcRule(ruleFromDraft(draft), paise))}`;
    } catch (e) {
      result = (e as Error).message;
    }
  }
  return (
    <label className="flex items-center gap-2 rounded-lg bg-paper px-3 py-2 text-sm">
      <span className="shrink-0 text-ink-soft">Try an amount ₹</span>
      <Input inputMode="decimal" placeholder="5000" value={amount} onChange={(e) => onAmount(e.target.value)} className="money min-h-9 max-w-28 px-2" />
      {result ? <span className="font-medium">→ {result}</span> : null}
    </label>
  );
}
