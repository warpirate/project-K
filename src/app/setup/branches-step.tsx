"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Banner, Button, Card, Input } from "@/components/ui";
import { saveBranches } from "./actions";

export function BranchesStep({ existing }: { existing: { id: string; name: string }[] }) {
  const router = useRouter();
  const [names, setNames] = useState<string[]>(existing.length ? [] : ["Main branch"]);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      setError(undefined);
      const res = await saveBranches(names);
      if (!res.ok) return setError(res.error);
      router.push("/setup?step=accounts");
    });

  return (
    <Card>
      <h2 className="font-display text-2xl">Your branches</h2>
      <p className="mt-1 text-ink-soft">Each branch keeps its own cash drawer and wallets. Staff work in one branch.</p>
      {error ? <div className="mt-4"><Banner>{error}</Banner></div> : null}
      <ul className="mt-6 flex flex-col gap-3">
        {existing.map((b) => (
          <li key={b.id} className="flex min-h-11 items-center rounded-lg border border-rule bg-paper px-3 text-ink-soft">
            {b.name} <span className="ml-auto text-xs">saved</span>
          </li>
        ))}
        {names.map((n, i) => (
          <li key={i} className="flex gap-2">
            <Input
              aria-label={`Branch ${existing.length + i + 1} name`}
              value={n}
              autoFocus={i === names.length - 1}
              placeholder="e.g. Bus stand branch"
              onChange={(e) => setNames(names.map((x, j) => (j === i ? e.target.value : x)))}
            />
            <Button variant="ghost" aria-label="Remove" onClick={() => setNames(names.filter((_, j) => j !== i))}>
              <X size={18} />
            </Button>
          </li>
        ))}
      </ul>
      <Button variant="secondary" className="mt-3" onClick={() => setNames([...names, ""])}>
        <Plus size={16} /> Add branch
      </Button>
      <div className="mt-8 flex justify-end">
        <Button onClick={submit} disabled={pending}>
          {pending ? "Saving…" : "Save & continue"}
        </Button>
      </div>
    </Card>
  );
}
