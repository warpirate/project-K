import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, Ref, SelectHTMLAttributes } from "react";

const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(" ");

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink hover:brightness-110 shadow-[0_1px_0_rgb(0_0_0/0.15)]",
  secondary: "bg-raised text-ink border border-rule-strong hover:border-ink-soft",
  ghost: "text-ink-soft hover:text-ink hover:bg-raised",
  danger: "bg-out text-paper hover:brightness-110",
};

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={cx(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-[15px] font-medium transition",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }) {
  return (
    <input
      className={cx(
        "min-h-11 w-full rounded-lg border border-rule-strong bg-raised px-3 text-[16px] text-ink",
        "placeholder:text-ink-soft/70 focus:border-accent focus:outline-none",
        "aria-[invalid=true]:border-out",
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cx(
        "min-h-11 w-full rounded-lg border border-rule-strong bg-raised px-3 text-[16px] text-ink focus:border-accent focus:outline-none",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium uppercase tracking-wide text-ink-soft">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-sm text-out" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-sm text-ink-soft">{hint}</p>
      ) : null}
    </div>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section className={cx("rounded-2xl border border-rule bg-raised p-5 shadow-[0_1px_0_var(--rule)] sm:p-6", className)}>
      {children}
    </section>
  );
}

export function Banner({ tone = "error", children }: { tone?: "error" | "info"; children: ReactNode }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cx(
        "rounded-lg border px-3 py-2 text-sm",
        tone === "error" ? "border-out/40 bg-danger-soft text-out" : "border-accent/30 bg-accent-soft text-ink",
      )}
    >
      {children}
    </div>
  );
}

export { cx };
