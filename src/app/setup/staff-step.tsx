"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Banner, Button, Card, Input, Select } from "@/components/ui";
import { createStaff, type StaffRow } from "./actions";

const blank = (branchId: string): StaffRow & { key: string } => ({
  key: crypto.randomUUID(),
  name: "",
  username: "",
  password: "",
  branchId,
});

export function StaffStep({ branches }: { branches: { id: string; name: string }[] }) {
  const router = useRouter();
  const [rows, setRows] = useState([blank(branches[0]?.id ?? "")]);
  const [error, setError] = useState<string>();
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const [added, setAdded] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const update = (i: number, patch: Partial<StaffRow>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const submit = (finish: boolean) =>
    start(async () => {
      setError(undefined);
      setRowErrors({});
      const filled = rows.filter((r) => r.name.trim() || r.username.trim());
      if (filled.length) {
        const res = await createStaff(rows);
        if (!res.ok) {
          const errs = res.rowErrors ?? {};
          setAdded((a) => [...a, ...rows.filter((_, i) => !errs[i] && rows[i].username).map((r) => r.username)]);
          setRows(rows.filter((_, i) => errs[i]));
          setRowErrors(Object.fromEntries(Object.values(errs).map((e, i) => [i, e])));
          return setError(res.error);
        }
        setAdded((a) => [...a, ...filled.map((r) => r.username)]);
      }
      if (finish) router.push("/");
      else setRows([blank(branches[0]?.id ?? "")]);
    });

  return (
    <Card>
      <h2 className="font-display text-2xl">Staff logins</h2>
      <p className="mt-1 text-ink-soft">
        Staff log in with a username and password you set here. They only see their own branch. You can skip this and add
        staff later.
      </p>
      {error ? <div className="mt-4"><Banner>{error}</Banner></div> : null}
      {added.length ? (
        <div className="mt-4">
          <Banner tone="info">Added: {added.join(", ")}</Banner>
        </div>
      ) : null}
      <ul className="mt-6 flex flex-col gap-4">
        {rows.map((r, i) => (
          <li key={r.key} className="flex flex-col gap-1">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1.2fr_1fr_1fr_1fr_auto]">
              <Input aria-label="Name" placeholder="Name" value={r.name} onChange={(e) => update(i, { name: e.target.value })} />
              <Input
                aria-label="Username"
                placeholder="Username"
                autoCapitalize="none"
                value={r.username}
                onChange={(e) => update(i, { username: e.target.value.replace(/\s/g, "") })}
              />
              <Input
                aria-label="Password"
                placeholder="Password"
                type="text"
                autoComplete="off"
                value={r.password}
                onChange={(e) => update(i, { password: e.target.value })}
              />
              <Select aria-label="Branch" value={r.branchId} onChange={(e) => update(i, { branchId: e.target.value })}>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
              <Button variant="ghost" aria-label="Remove" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                <X size={18} />
              </Button>
            </div>
            {rowErrors[i] ? <p className="text-sm text-out">{rowErrors[i]}</p> : null}
          </li>
        ))}
      </ul>
      <Button variant="secondary" className="mt-3" onClick={() => setRows([...rows, blank(branches[0]?.id ?? "")])}>
        <Plus size={16} /> Add staff
      </Button>
      <div className="mt-8 flex flex-wrap justify-between gap-3">
        <Button variant="ghost" onClick={() => router.push("/setup?step=services")}>
          Back
        </Button>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => submit(false)} disabled={pending}>
            Save & add more
          </Button>
          <Button onClick={() => submit(true)} disabled={pending}>
            {pending ? "Saving…" : "Finish setup"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
