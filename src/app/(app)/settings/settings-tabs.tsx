"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, ListChecks, Plus, Store, Users, Wallet } from "lucide-react";
import { Banner, Button, Card, Field, Input, Select, Tabs, cx } from "@/components/ui";
import { ACCOUNT_ICON, FLOW_ICON, IconTile } from "@/components/icons";
import { allPayButtons, branchPayButtons, defaultPayKey } from "@/lib/pay-buttons";
import { RuleInput, type RuleDraft } from "@/components/rule-input";
import { FLOWS, flowLabel, flowUses } from "@/lib/flows";
import { describeRule, ruleFromDraft, ruleFromInput, ruleToDraft, ruleToInput, type Flow } from "@/lib/rules";
import { createClient } from "@/lib/supabase/client";
import { useSubmit } from "@/lib/use-submit";
import type { Json } from "@/lib/database.types";
import { createStaff } from "@/app/setup/actions";
import { resetStaffPassword } from "./actions";
import type { AccountRow, ServiceRow, StaffRow } from "./page";

type Tab = "services" | "accounts" | "branches" | "staff";
type Branch = { id: string; name: string };
export type PayConfig = Record<string, { buttons: string[] | null; default: string | null }>;

export function SettingsTabs({
  initialTab,
  shopId,
  branches,
  services,
  accounts,
  staff,
  payConfig,
}: {
  initialTab: string;
  shopId: string;
  branches: Branch[];
  services: ServiceRow[];
  accounts: AccountRow[];
  staff: StaffRow[];
  payConfig: PayConfig;
}) {
  const [tab, setTab] = useState<Tab>((["services", "accounts", "branches", "staff"] as Tab[]).includes(initialTab as Tab) ? (initialTab as Tab) : "services");
  const toReview = services.filter((s) => !s.reviewed).length;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl">Settings</h1>
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "services", label: toReview ? `Services (${toReview} new)` : "Services", icon: <ListChecks size={16} aria-hidden /> },
            { value: "accounts", label: "Cash & wallets", icon: <Wallet size={16} aria-hidden /> },
            { value: "branches", label: "Branches", icon: <Store size={16} aria-hidden /> },
            { value: "staff", label: "Staff", icon: <Users size={16} aria-hidden /> },
          ]}
        />
      </div>
      {tab === "services" && <ServicesSettings services={services} />}
      {tab === "accounts" && <AccountsSettings shopId={shopId} branches={branches} accounts={accounts} payConfig={payConfig} />}
      {tab === "branches" && <BranchesSettings shopId={shopId} branches={branches} />}
      {tab === "staff" && <StaffSettings branches={branches} staff={staff} />}
    </div>
  );
}

/* ---------------- Services ---------------- */

function ServicesSettings({ services }: { services: ServiceRow[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const [showOff, setShowOff] = useState(false);
  const sorted = [...services].sort((a, b) => Number(a.reviewed) - Number(b.reviewed) || Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
  const list = sorted.filter((s) => showOff || s.active || !s.reviewed);
  return (
    <Card className="p-0 sm:p-0">
      <div className="flex items-center justify-between gap-3 border-b border-rule px-5 py-3">
        <p className="text-sm text-ink-soft">Tap a service to change its charges. New ones can also be added from the entry screen.</p>
        <label className="flex shrink-0 items-center gap-2 text-sm text-ink-soft">
          <input type="checkbox" checked={showOff} onChange={(e) => setShowOff(e.target.checked)} className="size-4 accent-[var(--accent)]" />
          Show turned off
        </label>
      </div>
      <ul className="divide-y divide-rule">
        {list.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => setOpen(open === s.id ? null : s.id)}
              aria-expanded={open === s.id}
              className="flex min-h-14 w-full items-center gap-3 px-5 py-2 text-left hover:bg-paper"
            >
              <IconTile icon={FLOW_ICON[s.flow]} size="sm" />
              <span className="min-w-0 flex-1">
                <span className={cx("block font-medium", !s.active && "text-ink-soft line-through")}>{s.name}</span>
                <span className="block text-sm text-ink-soft">
                  {flowLabel(s.flow)}
                  {flowUses(s.flow).fee ? ` · charge ${describeRule(s.fee_rule)}` : ""}
                  {flowUses(s.flow).commission ? ` · commission ${describeRule(s.commission_rule)}` : ""}
                  {flowUses(s.flow).portalCost ? ` · portal fee ${describeRule(s.portal_cost_rule)}` : ""}
                </span>
              </span>
              {!s.reviewed ? <span className="rounded-full bg-highlight/20 px-2 py-0.5 text-xs font-medium">New · check</span> : null}
              <ChevronDown size={18} className={cx("shrink-0 text-ink-soft transition", open === s.id && "rotate-180")} />
            </button>
            {open === s.id ? <ServiceEditor service={s} onDone={() => setOpen(null)} /> : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ServiceEditor({ service, onDone }: { service: ServiceRow; onDone: () => void }) {
  const { busy, error, run, setError } = useSubmit();
  const [name, setName] = useState(service.name);
  const [flow, setFlow] = useState<Flow>(service.flow);
  const [fee, setFee] = useState<RuleDraft>(ruleToDraft(service.fee_rule));
  const [commission, setCommission] = useState<RuleDraft>(ruleToDraft(service.commission_rule));
  const [cost, setCost] = useState<RuleDraft>(ruleToInput(service.portal_cost_rule));
  const [aliases, setAliases] = useState(service.aliases.join(", "));
  const uses = flowUses(flow);

  const save = async (patch?: Partial<{ active: boolean; reviewed: boolean }>) => {
    let rules;
    try {
      rules = {
        fee_rule: uses.fee ? ruleFromDraft(fee) : null,
        commission_rule: uses.commission ? ruleFromDraft(commission) : null,
        portal_cost_rule: uses.portalCost ? ruleFromInput("fixed", cost.value) : null,
      };
    } catch (e) {
      return setError((e as Error).message);
    }
    if (!name.trim()) return setError("Enter a name");
    const ok = await run(
      () =>
        createClient()
          .from("services")
          .update({
            name: name.trim(),
            flow,
            fee_rule: rules.fee_rule as Json,
            commission_rule: rules.commission_rule as Json,
            portal_cost_rule: rules.portal_cost_rule as Json,
            aliases: aliases.split(",").map((a) => a.trim()).filter(Boolean),
            reviewed: true,
            ...patch,
          })
          .eq("id", service.id),
      "Saved",
    );
    if (ok) onDone();
  };

  return (
    <div className="flex flex-col gap-4 border-t border-dashed border-rule bg-paper px-5 py-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor={`n-${service.id}`}>
          <Input id={`n-${service.id}`} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Type" htmlFor={`f-${service.id}`}>
          <Select id={`f-${service.id}`} value={flow} onChange={(e) => setFlow(e.target.value as Flow)}>
            {FLOWS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>
        </Field>
        {uses.fee ? (
          <Field label="Your charge from customer" htmlFor={`fee-${service.id}`} hint={fee.mode === "slab" ? "Bigger amount, bigger charge. The last row covers everything above." : "Empty = no charge. Use “By amount” if the charge grows with the amount."}>
            <RuleInput id={`fee-${service.id}`} label="Charge" allowSlab tryIt value={fee} onChange={setFee} />
          </Field>
        ) : null}
        {uses.commission ? (
          <Field label="Commission from portal" htmlFor={`com-${service.id}`} hint="Empty = none">
            <RuleInput id={`com-${service.id}`} label="Commission" allowSlab value={commission} onChange={setCommission} />
          </Field>
        ) : null}
        {uses.portalCost ? (
          <Field label="Portal fee from wallet" htmlFor={`cost-${service.id}`}>
            <RuleInput id={`cost-${service.id}`} label="Portal fee" allowPercent={false} value={cost} onChange={setCost} />
          </Field>
        ) : null}
        <Field label="Other names (for search)" htmlFor={`a-${service.id}`} hint="Comma separated, e.g. zerox, copy">
          <Input id={`a-${service.id}`} value={aliases} onChange={(e) => setAliases(e.target.value)} />
        </Field>
      </div>
      {error ? <Banner>{/duplicate|unique/i.test(error) ? "Another service already has this name" : error}</Banner> : null}
      <div className="flex flex-wrap justify-between gap-2">
        <Button type="button" variant="ghost" disabled={busy} onClick={() => void save({ active: !service.active })}>
          {service.active ? "Turn off" : "Turn on"}
        </Button>
        <div className="flex gap-2">
          {!service.reviewed ? (
            <Button type="button" variant="secondary" disabled={busy} onClick={() => void save()}>
              <Check size={16} /> Looks good
            </Button>
          ) : null}
          <Button type="button" disabled={busy} onClick={() => void save()}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Accounts ---------------- */

const TYPES = { cash: "Cash", wallet: "Portal wallet", bank: "Bank / UPI" } as const;

function AccountsSettings({ shopId, branches, accounts, payConfig }: { shopId: string; branches: Branch[]; accounts: AccountRow[]; payConfig: PayConfig }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-2">
      {branches.map((b) => (
        <Card key={b.id}>
          <h2 className="font-display text-xl">{b.name}</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {accounts
              .filter((a) => a.branch_id === b.id)
              .map((a) => (
                <AccountItem key={a.id} account={a} />
              ))}
          </ul>
          <NewAccount shopId={shopId} branchId={b.id} />
          <PayButtonsEditor
            key={JSON.stringify(payConfig[b.id] ?? null)}
            branchId={b.id}
            accounts={accounts.filter((a) => a.branch_id === b.id && a.active)}
            saved={payConfig[b.id] ?? { buttons: null, default: null }}
          />
        </Card>
      ))}
    </div>
  );
}

function AccountItem({ account }: { account: AccountRow }) {
  const { busy, error, run } = useSubmit();
  const [name, setName] = useState(account.name);
  const update = (patch: Partial<AccountRow>) => run(() => createClient().from("accounts").update(patch).eq("id", account.id), "Saved");
  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <IconTile icon={ACCOUNT_ICON[account.type]} size="sm" />
        <Input aria-label="Account name" value={name} onChange={(e) => setName(e.target.value)} className={cx(!account.active && "line-through opacity-60")} />
        <span className="hidden w-28 shrink-0 text-xs text-ink-soft sm:block">{TYPES[account.type]}</span>
        {name.trim() !== account.name ? (
          <Button variant="secondary" disabled={busy} onClick={() => void update({ name: name.trim() })}>
            Save
          </Button>
        ) : (
          <Button variant="ghost" disabled={busy} onClick={() => void update({ active: !account.active })}>
            {account.active ? "Turn off" : "Turn on"}
          </Button>
        )}
      </div>
      {error ? <p className="text-sm text-out">{error}</p> : null}
    </li>
  );
}

/** Owner picks which "How did the customer pay?" buttons this branch shows on New entry, and the one picked first. */
function PayButtonsEditor({
  branchId,
  accounts,
  saved,
}: {
  branchId: string;
  accounts: AccountRow[];
  saved: { buttons: string[] | null; default: string | null };
}) {
  const { busy, error, done, run, setError } = useSubmit();
  const all = allPayButtons(accounts);
  const current = branchPayButtons(saved.buttons, accounts);
  const [on, setOn] = useState<string[]>(current.map((b) => b.key));
  const [first, setFirst] = useState(defaultPayKey(saved.default, current));
  const toggle = (key: string) => setOn(on.includes(key) ? on.filter((k) => k !== key) : [...on, key]);
  const ordered = all.filter((b) => on.includes(b.key)).map((b) => b.key);

  const save = async () => {
    if (ordered.length === 0) return setError("Keep at least one button");
    const def = ordered.includes(first) ? first : ordered[0];
    setFirst(def);
    await run(() => createClient().from("branches").update({ pay_buttons: ordered, default_pay: def }).eq("id", branchId), "Saved");
  };

  return (
    <div className="mt-5 flex flex-col gap-2 border-t border-dashed border-rule pt-4">
      <h3 className="font-medium">Payment buttons on New entry</h3>
      <p className="text-sm text-ink-soft">Tick the ways customers pay here. Add a Bank / UPI account above (e.g. Paytm Business) to get its button.</p>
      <ul className="flex flex-col divide-y divide-rule rounded-lg border border-rule">
        {all.map((b) => (
          <li key={b.key} className="flex min-h-11 items-center justify-between gap-3 px-3">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={on.includes(b.key)} onChange={() => toggle(b.key)} className="size-4 accent-[var(--accent)]" />
              {b.label}
              {b.mode === "udhaar" ? <span className="text-xs text-ink-soft">pay later</span> : b.mode === "split" ? <span className="text-xs text-ink-soft">part cash, part UPI</span> : null}
            </label>
            <label className={cx("flex items-center gap-1.5 text-sm", on.includes(b.key) ? "text-ink-soft" : "invisible")}>
              <input type="radio" name={`default-${branchId}`} checked={first === b.key} onChange={() => setFirst(b.key)} className="size-4 accent-[var(--accent)]" />
              Default
            </label>
          </li>
        ))}
      </ul>
      {error ? <Banner>{error}</Banner> : null}
      {done ? <Banner tone="info">{done}</Banner> : null}
      <Button type="button" variant="secondary" disabled={busy} onClick={() => void save()} className="self-end">
        {busy ? "Saving…" : "Save buttons"}
      </Button>
    </div>
  );
}

function NewAccount({ shopId, branchId }: { shopId: string; branchId: string }) {
  const { busy, error, run, setError } = useSubmit();
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountRow["type"]>("wallet");
  return (
    <form
      className="mt-4 flex flex-col gap-2 border-t border-dashed border-rule pt-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return setError("Enter a name");
        if (await run(() => createClient().from("accounts").insert({ shop_id: shopId, branch_id: branchId, name: name.trim(), type }), "Added")) setName("");
      }}
    >
      <div className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1.4fr_1fr_auto]">
        <Input aria-label="New account name" placeholder="New account, e.g. Spice Money" value={name} onChange={(e) => setName(e.target.value)} />
        <Select aria-label="Type" value={type} onChange={(e) => setType(e.target.value as AccountRow["type"])} className="col-span-2 sm:col-span-1 sm:row-start-1 sm:col-start-2">
          {Object.entries(TYPES).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary" disabled={busy} className="row-start-1 col-start-2 sm:col-start-3">
          <Plus size={16} /> Add
        </Button>
      </div>
      <p className="text-xs text-ink-soft">Set its starting balance from Money → Fix a balance.</p>
      {error ? <p className="text-sm text-out">{/duplicate|unique/i.test(error) ? "This branch already has an account with this name" : error}</p> : null}
    </form>
  );
}

/* ---------------- Branches ---------------- */

function BranchesSettings({ shopId, branches }: { shopId: string; branches: Branch[] }) {
  const { busy, error, run, setError } = useSubmit();
  const [newName, setNewName] = useState("");
  return (
    <Card>
      <ul className="flex flex-col gap-2">
        {branches.map((b) => (
          <BranchItem key={b.id} branch={b} />
        ))}
      </ul>
      <form
        className="mt-4 flex gap-2 border-t border-dashed border-rule pt-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!newName.trim()) return setError("Enter a name");
          if (await run(() => createClient().from("branches").insert({ shop_id: shopId, name: newName.trim() }), "Added")) setNewName("");
        }}
      >
        <Input aria-label="New branch name" placeholder="New branch name" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <Button type="submit" variant="secondary" disabled={busy}>
          <Plus size={16} /> Add
        </Button>
      </form>
      <p className="mt-2 text-xs text-ink-soft">After adding a branch, add its cash drawer and wallets in “Cash & wallets”.</p>
      {error ? <p className="mt-2 text-sm text-out">{error}</p> : null}
    </Card>
  );
}

function BranchItem({ branch }: { branch: Branch }) {
  const { busy, error, run } = useSubmit();
  const [name, setName] = useState(branch.name);
  return (
    <li className="flex flex-col gap-1">
      <div className="flex gap-2">
        <Input aria-label="Branch name" value={name} onChange={(e) => setName(e.target.value)} />
        {name.trim() !== branch.name ? (
          <Button variant="secondary" disabled={busy} onClick={() => void run(() => createClient().from("branches").update({ name: name.trim() }).eq("id", branch.id), "Saved")}>
            Save
          </Button>
        ) : null}
      </div>
      {error ? <p className="text-sm text-out">{error}</p> : null}
    </li>
  );
}

/* ---------------- Staff ---------------- */

function StaffSettings({ branches, staff }: { branches: Branch[]; staff: StaffRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState({ name: "", username: "", password: "", branchId: branches[0]?.id ?? "" });
  const [error, setError] = useState<string>();
  const add = () =>
    start(async () => {
      setError(undefined);
      const res = await createStaff([draft]);
      if (!res.ok) return setError(Object.values(res.rowErrors ?? {})[0] ?? res.error);
      setDraft({ name: "", username: "", password: "", branchId: draft.branchId });
      router.refresh();
    });
  return (
    <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
      <Card>
        {staff.length === 0 ? <p className="py-6 text-center text-ink-soft">No staff yet.</p> : null}
        <ul className="divide-y divide-rule">
          {staff.map((s) => (
            <StaffItem key={s.user_id} member={s} branches={branches} />
          ))}
        </ul>
      </Card>
      <Card>
        <h2 className="font-display text-xl">Add staff</h2>
        <div className="mt-4 flex flex-col gap-3">
          <Input aria-label="Staff name" placeholder="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <Input aria-label="Staff username" placeholder="Username (for login)" autoCapitalize="none" value={draft.username} onChange={(e) => setDraft({ ...draft, username: e.target.value.replace(/\s/g, "") })} />
          <Input aria-label="Staff password" placeholder="Password" autoComplete="off" value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} />
          <Select aria-label="Staff branch" value={draft.branchId} onChange={(e) => setDraft({ ...draft, branchId: e.target.value })}>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          {error ? <Banner>{error}</Banner> : null}
          <Button onClick={add} disabled={pending}>
            {pending ? "Adding…" : "Add staff"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function StaffItem({ member, branches }: { member: StaffRow; branches: Branch[] }) {
  const { busy, error, done, run, setError, setDone } = useSubmit();
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const update = (patch: Partial<{ active: boolean; branch_id: string }>) =>
    run(() => createClient().from("profiles").update(patch).eq("user_id", member.user_id), "Saved");
  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="min-w-0 flex-1">
          <span className={cx("block font-medium", !member.active && "text-ink-soft line-through")}>{member.name}</span>
          <span className="money text-sm text-ink-soft">login: {member.username}</span>
        </span>
        <Select aria-label={`${member.name} branch`} value={member.branch_id ?? ""} onChange={(e) => void update({ branch_id: e.target.value })} className="w-auto">
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" disabled={busy} onClick={() => void update({ active: !member.active })}>
          {member.active ? "Stop login" : "Allow login"}
        </Button>
        <Button variant="ghost" onClick={() => setShowPw(!showPw)}>
          New password
        </Button>
      </div>
      {showPw ? (
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const res = await resetStaffPassword(member.user_id, pw);
            if (!res.ok) return setError(res.error);
            setDone("Password changed");
            setPw("");
            setShowPw(false);
          }}
        >
          <Input aria-label="New password" placeholder="New password" autoComplete="off" value={pw} onChange={(e) => setPw(e.target.value)} />
          <Button type="submit" variant="secondary">
            Set
          </Button>
        </form>
      ) : null}
      {error ? <p className="text-sm text-out">{error}</p> : null}
      {done ? <p className="text-sm text-in">{done}</p> : null}
    </li>
  );
}
