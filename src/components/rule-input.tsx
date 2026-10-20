"use client";

import type { RuleMode } from "@/lib/rules";
import { Input } from "@/components/ui";

export interface RuleDraft {
  mode: RuleMode;
  value: string;
}

export const emptyRule: RuleDraft = { mode: "fixed", value: "" };

/** "₹ / %" toggle plus a number box. */
export function RuleInput({
  id,
  value,
  onChange,
  allowPercent = true,
  label,
}: {
  id: string;
  value: RuleDraft;
  onChange: (v: RuleDraft) => void;
  allowPercent?: boolean;
  label: string;
}) {
  return (
    <div className="flex items-stretch overflow-hidden rounded-lg border border-rule-strong bg-raised focus-within:border-accent">
      {allowPercent ? (
        <div role="radiogroup" aria-label={`${label} type`} className="flex border-r border-rule-strong">
          {(["fixed", "percent"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={value.mode === m}
              onClick={() => onChange({ ...value, mode: m })}
              className={`min-w-10 px-2 text-sm font-medium ${
                value.mode === m ? "bg-accent text-accent-ink" : "text-ink-soft hover:text-ink"
              }`}
            >
              {m === "fixed" ? "₹" : "%"}
            </button>
          ))}
        </div>
      ) : (
        <span className="flex min-w-10 items-center justify-center border-r border-rule-strong text-sm text-ink-soft">₹</span>
      )}
      <Input
        id={id}
        aria-label={label}
        inputMode="decimal"
        placeholder="0"
        value={value.value}
        onChange={(e) => onChange({ ...value, value: e.target.value })}
        className="money min-h-10 rounded-none border-0 focus:border-0"
      />
    </div>
  );
}
