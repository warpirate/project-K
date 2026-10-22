"use client";

import { useEffect, useRef, useState } from "react";
import { Banner, Button, Field, Input, Select } from "@/components/ui";
import { RuleInput, emptyRule, type RuleDraft } from "@/components/rule-input";
import { FLOWS, flowUses } from "@/lib/flows";
import { ruleFromDraft, ruleFromInput, type Flow, type Rule } from "@/lib/rules";
import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/database.types";
import type { ServiceOption } from "./types";

/** Popup to add a service that does not exist yet; returns the saved (or already existing) service. */
export function CreateServiceDialog({
  name,
  shopId,
  isOwner,
  onClose,
  onCreated,
}: {
  name: string | null;
  shopId: string;
  isOwner: boolean;
  onClose: () => void;
  onCreated: (s: ServiceOption) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [draftName, setDraftName] = useState("");
  const [flow, setFlow] = useState<Flow>("counter_sale");
  const [fee, setFee] = useState<RuleDraft>(emptyRule);
  const [commission, setCommission] = useState<RuleDraft>(emptyRule);
  const [portalCost, setPortalCost] = useState<RuleDraft>(emptyRule);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (name === null) return ref.current?.close();
    setDraftName(name);
    setFlow("counter_sale");
    setFee(emptyRule);
    setCommission(emptyRule);
    setPortalCost(emptyRule);
    setError(undefined);
    ref.current?.showModal();
  }, [name]);

  const uses = flowUses(flow);

  const save = async () => {
    setError(undefined);
    let rules: { fee_rule: Rule | null; commission_rule: Rule | null; portal_cost_rule: Rule | null };
    try {
      rules = {
        fee_rule: uses.fee ? ruleFromDraft(fee) : null,
        commission_rule: uses.commission ? ruleFromDraft(commission) : null,
        portal_cost_rule: uses.portalCost ? ruleFromInput("fixed", portalCost.value) : null,
      };
    } catch (e) {
      return setError((e as Error).message);
    }
    if (!draftName.trim()) return setError("Enter a name");
    setSaving(true);
    const supabase = createClient();
    const cols = "id, name, flow, category, aliases, fee_rule, commission_rule, portal_cost_rule";
    const { data, error: err } = await supabase
      .from("services")
      .insert({
        shop_id: shopId,
        name: draftName.trim(),
        flow,
        fee_rule: rules.fee_rule as Json,
        commission_rule: rules.commission_rule as Json,
        portal_cost_rule: rules.portal_cost_rule as Json,
      })
      .select(cols)
      .single();
    setSaving(false);
    if (err) {
      if (/duplicate|unique/i.test(err.message)) {
        const { data: existing } = await supabase.from("services").select(cols).ilike("name", draftName.trim()).maybeSingle();
        if (existing) return onCreated(existing as unknown as ServiceOption);
        return setError("A service with this name already exists.");
      }
      return setError(err.message);
    }
    onCreated(data as unknown as ServiceOption);
  };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl border border-rule bg-raised p-0 text-ink shadow-2xl"
    >
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="flex flex-col gap-5 p-6"
      >
        <div>
          <h2 className="font-display text-2xl">New service</h2>
          {!isOwner ? (
            <p className="mt-1 text-sm text-ink-soft">Only the name is needed. The owner can check the charges later.</p>
          ) : null}
        </div>
        {error ? <Banner>{error}</Banner> : null}
        <Field label="Name" htmlFor="svc-name">
          <Input id="svc-name" value={draftName} onChange={(e) => setDraftName(e.target.value)} required />
        </Field>
        <Field label="What kind of service?" htmlFor="svc-flow" hint={FLOWS.find((f) => f.value === flow)?.help}>
          <Select id="svc-flow" value={flow} onChange={(e) => setFlow(e.target.value as Flow)}>
            {FLOWS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>
        </Field>
        {uses.fee || uses.commission || uses.portalCost ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {uses.fee ? (
              <Field label="Your charge (optional)" htmlFor="svc-fee" hint="What you take from the customer">
                <RuleInput id="svc-fee" label="Fee" allowSlab value={fee} onChange={setFee} />
              </Field>
            ) : null}
            {uses.commission ? (
              <Field label="Portal commission (optional)" htmlFor="svc-com" hint="What the portal pays you">
                <RuleInput id="svc-com" label="Commission" value={commission} onChange={setCommission} />
              </Field>
            ) : null}
            {uses.portalCost ? (
              <Field label="Portal fee (optional)" htmlFor="svc-cost" hint="Cut from your wallet per application">
                <RuleInput id="svc-cost" label="Portal cost" allowPercent={false} value={portalCost} onChange={setPortalCost} />
              </Field>
            ) : null}
          </div>
        ) : null}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={() => ref.current?.close()}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Create & use"}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
