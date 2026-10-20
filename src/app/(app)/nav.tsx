"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BookUser, LockKeyhole, PenLine, Settings, Wallet } from "lucide-react";
import { cx } from "@/components/ui";

const ITEMS = [
  { href: "/", label: "Entry", icon: PenLine, owner: false },
  { href: "/money", label: "Money", icon: Wallet, owner: false },
  { href: "/udhaar", label: "Udhaar", icon: BookUser, owner: false },
  { href: "/close", label: "Close day", icon: LockKeyhole, owner: false },
  { href: "/dashboard", label: "Dashboard", icon: BarChart3, owner: true },
  { href: "/settings", label: "Settings", icon: Settings, owner: true },
];

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path.startsWith(href));

/** Desktop: links under the header. Phone: fixed bottom tab bar. */
export function Nav({ isOwner }: { isOwner: boolean }) {
  const path = usePathname();
  const items = ITEMS.filter((i) => isOwner || !i.owner);
  return (
    <>
      <nav aria-label="Main" className="mx-auto hidden max-w-6xl gap-1 px-4 pb-2 md:flex">
        {items.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(path, href) ? "page" : undefined}
            className={cx(
              "inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-[15px] font-medium transition",
              isActive(path, href) ? "bg-ink text-paper" : "text-ink-soft hover:bg-raised hover:text-ink",
            )}
          >
            <Icon size={16} /> {label}
          </Link>
        ))}
      </nav>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <ul className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
          {items.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                aria-current={isActive(path, href) ? "page" : undefined}
                className={cx(
                  "flex min-h-15 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
                  isActive(path, href) ? "text-accent" : "text-ink-soft",
                )}
              >
                <Icon size={20} strokeWidth={isActive(path, href) ? 2.4 : 1.8} />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
