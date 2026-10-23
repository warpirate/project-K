"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ListPlus, X } from "lucide-react";

export const READY_LIST_SEEN = "pk_ready_list_seen";

/** One-time hint for owners of shops set up before ready lists existed. */
export function ReadyListBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      setShow(localStorage.getItem(READY_LIST_SEEN) !== "1");
    } catch {}
  }, []);
  if (!show) return null;
  const hide = () => {
    setShow(false);
    try {
      localStorage.setItem(READY_LIST_SEEN, "1");
    } catch {}
  };
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-accent/40 bg-accent-soft px-4 py-3">
      <ListPlus size={20} className="shrink-0 text-accent" aria-hidden />
      <Link href="/settings/ready-list" onClick={hide} className="min-w-0 flex-1 font-medium text-ink hover:underline">
        Ready price lists for your business. Add in 1 minute →
      </Link>
      <button type="button" aria-label="Close" onClick={hide} className="flex size-10 shrink-0 items-center justify-center rounded-lg text-ink-soft hover:text-ink">
        <X size={18} />
      </button>
    </div>
  );
}
