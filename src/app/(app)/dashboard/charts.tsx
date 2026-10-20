import { formatINR } from "@/lib/money";
import { cx } from "@/components/ui";

/**
 * Horizontal bars for "profit by X". Single series → one colour, value written next to every bar
 * (text in ink, never in the bar colour), so no legend is needed.
 */
export function BarList({ rows, empty = "Nothing in this period." }: { rows: { label: string; value: number; sub?: string }[]; empty?: string }) {
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-ink-soft">{empty}</p>;
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 1);
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => (
        <li key={r.label} className="group">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate">
              {r.label}
              {r.sub ? <span className="ml-2 text-xs text-ink-soft">{r.sub}</span> : null}
            </span>
            <span className={cx("money shrink-0 font-semibold", r.value < 0 && "text-out")}>{formatINR(r.value)}</span>
          </div>
          <div className="mt-1 h-2.5 rounded-full bg-paper">
            <div
              className={cx("h-full rounded-full transition-[width] duration-500", r.value < 0 ? "bg-out" : "bg-accent")}
              style={{ width: `${Math.max((Math.abs(r.value) / max) * 100, r.value === 0 ? 0 : 2)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Daily profit columns. Positive days rise from the baseline, loss days drop below it.
 * Each column has a hover/focus tooltip with the exact date and amount.
 */
export function TrendBars({ days }: { days: { date: string; value: number }[] }) {
  const max = Math.max(...days.map((d) => Math.abs(d.value)), 1);
  const hasNeg = days.some((d) => d.value < 0);
  const fmt = (d: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
  const H = 140;
  const pos = hasNeg ? H * 0.7 : H;
  return (
    <figure>
      <div className="relative flex items-stretch gap-[2px]" style={{ height: H }} role="list" aria-label="Profit per day">
        {days.map((d) => {
          const h = (Math.abs(d.value) / max) * (hasNeg ? pos : H);
          return (
            <div key={d.date} role="listitem" tabIndex={0} aria-label={`${fmt(d.date)}: ${formatINR(d.value)}`} className="group relative flex-1 outline-none">
              <div className="absolute inset-x-0" style={{ top: 0, height: pos }}>
                {d.value > 0 ? <div className="absolute inset-x-0 bottom-0 rounded-t-[4px] bg-accent group-hover:brightness-125 group-focus:brightness-125" style={{ height: Math.max(h, 2) }} /> : null}
              </div>
              {d.value < 0 ? (
                <div className="absolute inset-x-0 rounded-b-[4px] bg-out" style={{ top: pos, height: Math.max(h, 2) }} />
              ) : null}
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs text-paper group-hover:block group-focus:block">
                {fmt(d.date)} · <span className="money">{formatINR(d.value)}</span>
              </div>
            </div>
          );
        })}
        <div className="pointer-events-none absolute inset-x-0 border-t border-rule-strong" style={{ top: pos }} aria-hidden />
      </div>
      <figcaption className="mt-2 flex justify-between text-xs text-ink-soft">
        <span>{days[0] ? fmt(days[0].date) : ""}</span>
        <span>{days.at(-1) ? fmt(days.at(-1)!.date) : ""}</span>
      </figcaption>
    </figure>
  );
}
