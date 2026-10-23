"use client";

import { BUSINESS_PACKS } from "@/lib/business-packs";
import { PACK_LOOK } from "./icons";
import { cx } from "./ui";

/** Picture cards, one per kind of business. */
export function BusinessGrid({ onPick, hide = [], picked }: { onPick: (id: string) => void; hide?: string[]; picked?: string | null }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      {BUSINESS_PACKS.filter((p) => !hide.includes(p.id)).map((p) => {
        const look = PACK_LOOK[p.id] ?? PACK_LOOK.other;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onPick(p.id)}
            aria-pressed={picked === p.id}
            className={cx(
              "flex min-h-28 flex-col items-start justify-between gap-2 rounded-2xl border bg-raised p-3 text-left transition hover:border-accent",
              picked === p.id ? "border-accent ring-2 ring-accent" : "border-rule-strong",
            )}
          >
            <span aria-hidden className={cx("inline-flex size-10 items-center justify-center rounded-xl", look.hue)}>
              <look.icon size={21} strokeWidth={1.9} />
            </span>
            <span>
              <span className="block font-semibold leading-tight">{p.name}</span>
              <span className="block text-xs leading-snug text-ink-soft">{p.sub}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
