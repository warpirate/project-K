"use client";

import { useRef } from "react";
import { setBranch } from "./branch-actions";

export function BranchSwitcher({ branches, current }: { branches: { id: string; name: string }[]; current: string | null }) {
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} action={setBranch}>
      <label className="sr-only" htmlFor="branchId">
        Branch
      </label>
      <select
        id="branchId"
        name="branchId"
        defaultValue={current ?? undefined}
        onChange={() => form.current?.requestSubmit()}
        className="min-h-10 rounded-full border border-rule-strong bg-raised py-1 pr-8 pl-3 text-[15px] font-medium text-ink focus:border-accent focus:outline-none"
      >
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
    </form>
  );
}
