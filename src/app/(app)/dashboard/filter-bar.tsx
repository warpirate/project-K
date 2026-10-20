"use client";

import Link from "next/link";
import { useRef } from "react";
import { PERIODS, type PeriodKey } from "@/lib/periods";
import { cx } from "@/components/ui";

/** Period pills + branch picker in one row; everything is in the URL so the page can be shared/bookmarked. */
export function FilterBar({
  period,
  from,
  to,
  branch,
  branches,
}: {
  period: PeriodKey;
  from: string;
  to: string;
  branch: string;
  branches: { id: string; name: string }[];
}) {
  const form = useRef<HTMLFormElement>(null);
  const href = (p: PeriodKey) => `/dashboard?period=${p}&branch=${branch}${p === "custom" ? `&from=${from}&to=${to}` : ""}`;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <nav aria-label="Period" className="flex gap-1 overflow-x-auto rounded-full bg-raised p-1">
          {PERIODS.map((p) => (
            <Link
              key={p.key}
              href={href(p.key)}
              aria-current={period === p.key ? "true" : undefined}
              className={cx(
                "min-h-9 shrink-0 rounded-full px-3 py-1.5 text-sm font-medium",
                period === p.key ? "bg-ink text-paper" : "text-ink-soft hover:text-ink",
              )}
            >
              {p.label}
            </Link>
          ))}
        </nav>
        {branches.length > 1 ? (
          <form ref={form} method="get" action="/dashboard">
            <input type="hidden" name="period" value={period} />
            {period === "custom" ? (
              <>
                <input type="hidden" name="from" value={from} />
                <input type="hidden" name="to" value={to} />
              </>
            ) : null}
            <select
              name="branch"
              aria-label="Branch"
              defaultValue={branch}
              onChange={() => form.current?.requestSubmit()}
              className="min-h-10 rounded-full border border-rule-strong bg-raised px-3 text-sm font-medium"
            >
              <option value="all">All branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </form>
        ) : null}
      </div>
      {period === "custom" ? (
        <form method="get" action="/dashboard" className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="period" value="custom" />
          <input type="hidden" name="branch" value={branch} />
          <label className="flex flex-col text-xs text-ink-soft">
            From
            <input type="date" name="from" defaultValue={from} className="min-h-10 rounded-lg border border-rule-strong bg-raised px-2 text-sm text-ink" />
          </label>
          <label className="flex flex-col text-xs text-ink-soft">
            To
            <input type="date" name="to" defaultValue={to} className="min-h-10 rounded-lg border border-rule-strong bg-raised px-2 text-sm text-ink" />
          </label>
          <button type="submit" className="min-h-10 rounded-lg bg-accent px-4 text-sm font-medium text-accent-ink">
            Show
          </button>
        </form>
      ) : null}
    </div>
  );
}
