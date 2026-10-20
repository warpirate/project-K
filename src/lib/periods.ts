/** Date ranges for reports. Dates are "YYYY-MM-DD" business dates (Asia/Kolkata), handled as plain calendar days. */

export type PeriodKey = "today" | "yesterday" | "7d" | "month" | "last_month" | "custom";

export interface Range {
  from: string;
  to: string;
}

export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "Last 7 days" },
  { key: "month", label: "This month" },
  { key: "last_month", label: "Last month" },
  { key: "custom", label: "Pick dates" },
];

const DAY = 86_400_000;
const toTime = (d: string) => Date.parse(`${d}T00:00:00Z`);
const fromTime = (t: number) => new Date(t).toISOString().slice(0, 10);
const isDate = (d: string | undefined): d is string => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(toTime(d));

export const addDays = (d: string, n: number) => fromTime(toTime(d) + n * DAY);
export const daysBetween = (from: string, to: string) => Math.round((toTime(to) - toTime(from)) / DAY) + 1;

export const todayIST = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

export function periodRange(key: string, today: string, from?: string, to?: string): Range & { key: PeriodKey; label: string } {
  const label = (k: PeriodKey) => PERIODS.find((p) => p.key === k)!.label;
  switch (key) {
    case "yesterday": {
      const y = addDays(today, -1);
      return { key, from: y, to: y, label: label(key) };
    }
    case "7d":
      return { key, from: addDays(today, -6), to: today, label: label(key) };
    case "month":
      return { key, from: `${today.slice(0, 8)}01`, to: today, label: label(key) };
    case "last_month": {
      const end = addDays(`${today.slice(0, 8)}01`, -1);
      return { key, from: `${end.slice(0, 8)}01`, to: end, label: label(key) };
    }
    case "custom":
      if (isDate(from) && isDate(to)) {
        const [a, b] = from <= to ? [from, to] : [to, from];
        return { key, from: a, to: b, label: a === b ? a : `${a} → ${b}` };
      }
      return { key: "today", from: today, to: today, label: label("today") };
    default:
      return { key: "today", from: today, to: today, label: label("today") };
  }
}

/** The equal-length range immediately before. */
export function previousRange(r: Range): Range {
  const n = daysBetween(r.from, r.to);
  return { from: addDays(r.from, -n), to: addDays(r.from, -1) };
}
