"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Banner, Button, Card, Input, Select } from "@/components/ui";
import { rupeesToPaise } from "@/lib/money";
import { saveAccounts, type AccountRow } from "./actions";

type Draft = { branchId: string; name: string; type: AccountRow["type"]; opening: string; clientId: string };

const TYPE_LABEL = { cash: "Cash", wallet: "Portal wallet", bank: "Bank / UPI" } as const;

const newRow = (branchId: string, name = "", type: Draft["type"] = "wallet"): Draft => ({
  branchId,
  name,
  type,
  opening: "",
  clientId: crypto.randomUUID(),
});

export function AccountsStep({
  branches,
  existing,
}: {
  branches: { id: string; name: string }[];
  existing: { id: string; name: string; type: string; branch_id: string }[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Draft[]>(() =>
    branches.flatMap((b) =>
      existing.some((a) => a.branch_id === b.id) ? [] : [newRow(b.id, "Cash drawer", "cash"), newRow(b.id), newRow(b.id, "", "bank")],
    ),
  );
  const [error, setError] = useState<string>();
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const [pending, start] = useTransition();

  const update = (i: number, patch: Partial<Draft>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const submit = () =>
    start(async () => {
      setError(undefined);
      setRowErrors({});
      const bad: Record<number, string> = {};
      const payload: AccountRow[] = rows.map((r, i) => {
        const opening = r.opening.trim() === "" ? 0 : rupeesToPaise(r.opening.replace(/^-/, ""));
        if (opening === null) bad[i] = "Opening balance: enter rupees like 2500 or 2500.50";
        const sign = r.opening.trim().startsWith("-") ? -1 : 1;
        return { branchId: r.branchId, name: r.name, type: r.type, openingPaise: (opening ?? 0) * sign, clientId: r.clientId };
      });
      if (Object.keys(bad).length) return setRowErrors(bad);
      if (existing.length === 0 && !rows.some((r) => r.name.trim())) return setError("Add at least the cash drawer.");
      const res = await saveAccounts(payload);
      if (!res.ok) {
        setError(res.error);
        setRowErrors(res.rowErrors ?? {});
        return;
      }
      router.push("/setup?step=services");
    });

  return (
    <Card>
      <h2 className="font-display text-2xl">Cash drawer, wallets & bank</h2>
      <p className="mt-1 text-ink-soft">
        Add every place money sits: the drawer, each portal wallet (PayNearby, Spice Money…), and your bank/UPI. Opening
        balance = what is there right now.
      </p>
      {error ? <div className="mt-4"><Banner>{error}</Banner></div> : null}
      {branches.map((b) => (
        <div key={b.id} className="mt-8">
          <h3 className="border-b border-rule pb-2 font-medium">{b.name}</h3>
          <ul className="mt-3 flex flex-col gap-2">
            {existing
              .filter((a) => a.branch_id === b.id)
              .map((a) => (
                <li key={a.id} className="flex min-h-11 items-center gap-3 rounded-lg bg-paper px-3 text-ink-soft">
                  {a.name} <span className="text-xs">{TYPE_LABEL[a.type as Draft["type"]]}</span>
                  <span className="ml-auto text-xs">saved</span>
                </li>
              ))}
            {rows.map((r, i) =>
              r.branchId !== b.id ? null : (
                <li key={r.clientId} className="flex flex-col gap-1">
                  <div className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1.4fr_1fr_1fr_auto]">
                    <Input
                      aria-label="Account name"
                      placeholder={r.type === "bank" ? "e.g. SBI UPI" : r.type === "wallet" ? "e.g. PayNearby" : "Cash drawer"}
                      value={r.name}
                      onChange={(e) => update(i, { name: e.target.value })}
                    />
                    <Button variant="ghost" aria-label="Remove" className="sm:order-last" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                      <X size={18} />
                    </Button>
                    <Select aria-label="Type" value={r.type} onChange={(e) => update(i, { type: e.target.value as Draft["type"] })}>
                      {Object.entries(TYPE_LABEL).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </Select>
                    <Input
                      aria-label="Opening balance in rupees"
                      inputMode="decimal"
                      placeholder="Opening ₹"
                      className="money"
                      value={r.opening}
                      aria-invalid={!!rowErrors[i]}
                      onChange={(e) => update(i, { opening: e.target.value })}
                    />
                  </div>
                  {rowErrors[i] ? <p className="text-sm text-out">{rowErrors[i]}</p> : null}
                </li>
              ),
            )}
          </ul>
          <Button variant="secondary" className="mt-3" onClick={() => setRows([...rows, newRow(b.id)])}>
            <Plus size={16} /> Add account
          </Button>
        </div>
      ))}
      <div className="mt-8 flex justify-between">
        <Button variant="ghost" onClick={() => router.push("/setup?step=branches")}>
          Back
        </Button>
        <Button onClick={submit} disabled={pending}>
          {pending ? "Saving…" : "Save & continue"}
        </Button>
      </div>
    </Card>
  );
}
