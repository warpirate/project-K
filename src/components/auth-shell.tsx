import type { ReactNode } from "react";

/** Two-column frame for login/signup: a ledger-page brand panel and the form. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <aside className="ruled relative hidden overflow-hidden border-r border-rule lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute inset-y-0 left-16 w-px bg-out/30" aria-hidden />
        <p className="pl-10 font-display text-3xl">Project K</p>
        <div className="pl-10">
          <p className="font-display text-5xl leading-[1.1]">
            Every rupee,
            <br />
            every branch,
            <br />
            <span className="text-accent">one register.</span>
          </p>
          <ul className="money mt-10 space-y-2 text-[15px] text-ink-soft">
            <li className="flex justify-between gap-8">
              <span>AEPS withdrawal</span>
              <span className="text-out">−₹1,980.00</span>
            </li>
            <li className="flex justify-between gap-8">
              <span>Money transfer</span>
              <span className="text-in">+₹5,050.00</span>
            </li>
            <li className="flex justify-between gap-8">
              <span>Xerox × 10</span>
              <span className="text-in">+₹20.00</span>
            </li>
          </ul>
        </div>
        <p className="pl-10 text-sm text-ink-soft">Cash · Wallets · Udhaar · Day close</p>
      </aside>
      <section className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="rise w-full max-w-sm">
          <p className="mb-8 font-display text-2xl lg:hidden">Project K</p>
          <h1 className="font-display text-3xl">{title}</h1>
          <p className="mt-2 text-ink-soft">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </section>
    </main>
  );
}
