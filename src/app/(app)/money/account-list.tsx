"use client";

import { useEffect, useState } from "react";
import { ArrowDownWideNarrow, ArrowUpDown, ArrowUpWideNarrow } from "lucide-react";
import { formatINR } from "@/lib/money";
import { cx } from "@/components/ui";
import { ACCOUNT_ICON, IconTile } from "@/components/icons";

type Sort = "usual" | "high" | "low";
const SORT_KEY = "pk_money_sort";
const NEXT: Record<Sort, Sort> = { usual: "high", high: "low", low: "usual" };
const LABEL: Record<Sort, string> = { usual: "Usual order", high: "Most money first", low: "Least money first" };
const ICON = { usual: ArrowUpDown, high: ArrowDownWideNarrow, low: ArrowUpWideNarrow };

export interface MoneyRow {
  account_id: string;
  name: string;
  type: "cash" | "wallet" | "bank";
  typeLabel: string;
  balance: number;
}

/** Balances of the branch's accounts, with a sort button (remembered on this phone). */
export function AccountList({ rows }: { rows: MoneyRow[] }) {
  const [sort, setSort] = useState<Sort>("usual");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SORT_KEY) as Sort | null;
      if (saved && saved in NEXT) setSort(saved);
    } catch {}
  }, []);
  const change = () => {
    const next = NEXT[sort];
    setSort(next);
    try {
      localStorage.setItem(SORT_KEY, next);
    } catch {}
  };
  const shown = sort === "usual" ? rows : [...rows].sort((a, b) => (sort === "high" ? b.balance - a.balance : a.balance - b.balance));
  const Icon = ICON[sort];

  return (
    <>
      {rows.length > 1 ? (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={change}
            aria-label={`Sort: ${LABEL[sort]}. Tap to change.`}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-rule-strong bg-raised px-3 text-sm font-medium text-ink hover:border-ink-soft"
          >
            <Icon size={16} aria-hidden /> {LABEL[sort]}
          </button>
        </div>
      ) : null}
      <ul className="mt-2 divide-y divide-rule">
        {shown.map((a) => (
          <li key={a.account_id} className="flex items-center justify-between gap-3 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <IconTile icon={ACCOUNT_ICON[a.type]} tone={a.type === "cash" ? "accent" : "plain"} />
              <div className="min-w-0">
                <p className="truncate font-medium">{a.name}</p>
                <p className="text-xs text-ink-soft">{a.typeLabel}</p>
              </div>
            </div>
            <span className={cx("money text-lg font-semibold", a.balance < 0 && "text-out")}>{formatINR(a.balance)}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
