"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Banner, Button, Card, Input, Select } from "@/components/ui";
import { RuleInput, emptyRule, type RuleDraft } from "@/components/rule-input";
import { SERVICE_TEMPLATES } from "@/lib/service-templates";
import { FLOWS, flowUses } from "@/lib/flows";
import { normalizeName } from "@/lib/services";
import { ruleFromInput, type Flow } from "@/lib/rules";
import { saveServices, type ServiceRow } from "./actions";

type Draft = {
  key: string;
  on: boolean;
  name: string;
  flow: Flow;
  category: string;
  aliases: string[];
  fee: RuleDraft;
  commission: RuleDraft;
  portalCost: RuleDraft;
};

export function ServicesStep({ existingNames }: { existingNames: string[] }) {
  const router = useRouter();
  const taken = new Set(existingNames.map(normalizeName));
  const [rows, setRows] = useState<Draft[]>(() =>
    SERVICE_TEMPLATES.filter((t) => !taken.has(normalizeName(t.name))).map((t) => ({
      key: t.name,
      on: true,
      name: t.name,
      flow: t.flow,
      category: t.category,
      aliases: t.aliases,
      fee: emptyRule,
      commission: emptyRule,
      portalCost: emptyRule,
    })),
  );
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const update = (i: number, patch: Partial<Draft>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const submit = () =>
    start(async () => {
      setError(undefined);
      let payload: ServiceRow[];
      try {
        payload = rows
          .filter((r) => r.on && r.name.trim())
          .map((r) => {
            const uses = flowUses(r.flow);
            return {
              name: r.name,
              flow: r.flow,
              category: r.category,
              aliases: r.aliases,
              feeRule: uses.fee ? ruleFromInput(r.fee.mode, r.fee.value) : null,
              commissionRule: uses.commission ? ruleFromInput(r.commission.mode, r.commission.value) : null,
              portalCostRule: uses.portalCost ? ruleFromInput("fixed", r.portalCost.value) : null,
            };
          });
      } catch (e) {
        return setError((e as Error).message);
      }
      if (payload.length === 0 && existingNames.length === 0) return setError("Tick at least one service.");
      const res = await saveServices(payload);
      if (!res.ok) return setError(res.error);
      router.push("/setup?step=staff");
    });

  return (
    <Card>
      <h2 className="font-display text-2xl">Services you offer</h2>
      <p className="mt-1 text-ink-soft">
        Untick what you don’t do. Charges are optional: fill them now, later, or never.
        <br />
        <strong className="font-medium text-ink">Your charge</strong> = what you take from the customer.{" "}
        <strong className="font-medium text-ink">Commission</strong> = what the portal pays you. Missing services can be
        added from the entry screen any time.
      </p>
      {error ? <div className="mt-4"><Banner>{error}</Banner></div> : null}
      <ul className="mt-6 divide-y divide-rule">
        {rows.map((r, i) => {
          const uses = flowUses(r.flow);
          return (
            <li key={r.key} className={`py-4 ${r.on ? "" : "opacity-50"}`}>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={r.on}
                  onChange={(e) => update(i, { on: e.target.checked })}
                  className="size-5 accent-[var(--accent)]"
                  aria-label={`Offer ${r.name}`}
                />
                <Input aria-label="Service name" value={r.name} onChange={(e) => update(i, { name: e.target.value })} className="flex-1" />
              </div>
              {r.on ? (
                <div className="mt-3 grid gap-3 pl-8 sm:grid-cols-3">
                  <label className="flex flex-col gap-1 text-xs text-ink-soft">
                    Type
                    <Select value={r.flow} onChange={(e) => update(i, { flow: e.target.value as Flow })}>
                      {FLOWS.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </Select>
                  </label>
                  {uses.fee ? (
                    <label className="flex flex-col gap-1 text-xs text-ink-soft">
                      Your charge (optional)
                      <RuleInput id={`fee-${i}`} label="Fee" value={r.fee} onChange={(v) => update(i, { fee: v })} />
                    </label>
                  ) : null}
                  {uses.commission ? (
                    <label className="flex flex-col gap-1 text-xs text-ink-soft">
                      Portal commission to you (optional)
                      <RuleInput id={`com-${i}`} label="Commission" value={r.commission} onChange={(v) => update(i, { commission: v })} />
                    </label>
                  ) : null}
                  {uses.portalCost ? (
                    <label className="flex flex-col gap-1 text-xs text-ink-soft">
                      Portal fee from wallet (optional)
                      <RuleInput
                        id={`cost-${i}`}
                        label="Portal cost"
                        allowPercent={false}
                        value={r.portalCost}
                        onChange={(v) => update(i, { portalCost: v })}
                      />
                    </label>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      <Button
        variant="secondary"
        className="mt-3"
        onClick={() =>
          setRows([
            ...rows,
            {
              key: crypto.randomUUID(),
              on: true,
              name: "",
              flow: "counter_sale",
              category: "general",
              aliases: [],
              fee: emptyRule,
              commission: emptyRule,
              portalCost: emptyRule,
            },
          ])
        }
      >
        <Plus size={16} /> Add another service
      </Button>
      <div className="mt-8 flex justify-between">
        <Button variant="ghost" onClick={() => router.push("/setup?step=accounts")}>
          Back
        </Button>
        <Button onClick={submit} disabled={pending}>
          {pending ? "Saving…" : "Save & continue"}
        </Button>
      </div>
    </Card>
  );
}
