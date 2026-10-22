"use client";

import { Plus, X } from "lucide-react";
import { emptySlabs, type RuleDraft, type SlabRow } from "@/lib/rules";
import { Input } from "@/components/ui";

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
  label,
}: {
  id: string;
  value: RuleDraft;
  onChange: (v: RuleDraft) => void;
  allowPercent?: boolean;
  allowSlab?: boolean;
  label: string;
}) {
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
                <span className="text-ink-soft">→ ₹</span>
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
    </div>
  );
}
