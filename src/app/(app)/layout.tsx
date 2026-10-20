import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { getAppContext } from "@/lib/session";
import { logOut } from "@/app/login/actions";
import { BranchSwitcher } from "./branch-switcher";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAppContext();
  if (ctx.isOwner && ctx.branches.length === 0) redirect("/setup");
  const branchName = ctx.branches.find((b) => b.id === ctx.branchId)?.name;

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-rule bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-xl leading-tight">{ctx.shopName}</p>
            <p className="truncate text-xs text-ink-soft">
              {ctx.profile.name} · {ctx.isOwner ? "Owner" : "Staff"}
            </p>
          </div>
          {ctx.isOwner && ctx.branches.length > 1 ? (
            <BranchSwitcher branches={ctx.branches} current={ctx.branchId} />
          ) : branchName ? (
            <span className="rounded-full border border-rule-strong px-3 py-1.5 text-[15px] font-medium">{branchName}</span>
          ) : null}
          <form action={logOut}>
            <button
              type="submit"
              className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-full text-ink-soft hover:bg-raised hover:text-ink"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut size={18} />
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
