import Link from "next/link";
import { Check } from "lucide-react";

export const STEPS = [
  { key: "branches", label: "Branches" },
  { key: "accounts", label: "Cash & wallets" },
  { key: "services", label: "Services" },
  { key: "staff", label: "Staff" },
] as const;

export type StepKey = (typeof STEPS)[number]["key"];

export function Progress({ current, reachable }: { current: StepKey; reachable: StepKey[] }) {
  const currentIdx = STEPS.findIndex((s) => s.key === current);
  return (
    <ol className="mt-8 grid grid-cols-4 gap-2" aria-label="Setup steps">
      {STEPS.map((s, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        const canGo = reachable.includes(s.key) && !active;
        const body = (
          <>
            <span
              className={`flex size-7 items-center justify-center rounded-full border text-sm font-semibold ${
                active ? "border-accent bg-accent text-accent-ink" : done ? "border-accent text-accent" : "border-rule-strong text-ink-soft"
              }`}
            >
              {done ? <Check size={15} /> : i + 1}
            </span>
            <span className={`text-xs sm:text-sm ${active ? "font-semibold text-ink" : "text-ink-soft"}`}>{s.label}</span>
          </>
        );
        return (
          <li key={s.key} aria-current={active ? "step" : undefined} className="border-t-2 pt-3" style={{ borderColor: i <= currentIdx ? "var(--accent)" : "var(--rule)" }}>
            {canGo ? (
              <Link href={`/setup?step=${s.key}`} className="flex flex-col items-start gap-1.5 hover:opacity-80">
                {body}
              </Link>
            ) : (
              <div className="flex flex-col items-start gap-1.5">{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
