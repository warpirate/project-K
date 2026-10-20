"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Check, Plus, Trash2 } from "lucide-react";
import { Banner, Button, Card, Field, Input, Select, cx } from "@/components/ui";
import { formatINR, rupeesToPaise } from "@/lib/money";
import { calcRule, previewEntry } from "@/lib/rules";
import { flowLabel, flowUses } from "@/lib/flows";
import { buildPayments, type PartKind, type PayMode } from "@/lib/payments";
import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/database.types";
import { ServicePicker } from "./service-picker";
import { CreateServiceDialog } from "./create-service-dialog";
import { CustomerPicker } from "./customer-picker";
import type { AccountOption, CustomerOption, ServiceOption } from "./types";

const PAY_MODES: { value: PayMode; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "udhaar", label: "Udhaar" },
  { value: "split", label: "Split" },
];

const walletKey = (branchId: string, serviceId: string) => `pk:wallet:${branchId}:${serviceId}`;

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage unavailable: just don't remember
  }
}

/** Parse an optional override; "" means use the rule. Returns undefined when invalid. */
function override(v: string): number | null | undefined {
  if (v.trim() === "") return null;
  const p = rupeesToPaise(v);
  return p === null ? undefined : p;
}

export function EntryForm({
  shopId,
  branchId,
  isOwner,
  services: initialServices,
  accounts,
  customers: initialCustomers,
}: {
  shopId: string;
  branchId: string;
  isOwner: boolean;
  services: ServiceOption[];
  accounts: AccountOption[];
  customers: CustomerOption[];
}) {
  const router = useRouter();
  const pickerRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  const [services, setServices] = useState(initialServices);
  const [customers, setCustomers] = useState(initialCustomers);
  const [service, setService] = useState<ServiceOption | null>(null);
  const [creating, setCreating] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [walletId, setWalletId] = useState("");
  const [feeText, setFeeText] = useState("");
  const [commissionText, setCommissionText] = useState("");
  const [costText, setCostText] = useState("");
  const [payMode, setPayMode] = useState<PayMode>("cash");
  const [upiId, setUpiId] = useState(accounts.find((a) => a.type === "bank")?.id ?? "");
  const [parts, setParts] = useState<{ kind: PartKind; amount: string }[]>([
    { kind: "cash", amount: "" },
    { kind: "upi", amount: "" },
  ]);
  const [customer, setCustomer] = useState<CustomerOption | null>(null);
  const [note, setNote] = useState("");
  const [clientId, setClientId] = useState(() => crypto.randomUUID());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState<string>();

  const cashId = accounts.find((a) => a.type === "cash")?.id;
  const banks = accounts.filter((a) => a.type === "bank");
  const walletChoices = [...accounts.filter((a) => a.type === "wallet"), ...banks];
  const uses = service ? flowUses(service.flow) : null;

  useEffect(() => setServices(initialServices), [initialServices]);

  const amountPaise = rupeesToPaise(amount);
  const auto = useMemo(() => {
    if (!service || amountPaise === null) return { fee: 0, commission: 0, cost: 0 };
    try {
      return {
        fee: calcRule(service.fee_rule, amountPaise),
        commission: calcRule(service.commission_rule, amountPaise),
        cost: calcRule(service.portal_cost_rule, amountPaise),
      };
    } catch {
      return { fee: 0, commission: 0, cost: 0 };
    }
  }, [service, amountPaise]);

  const feeO = override(feeText);
  const comO = override(commissionText);
  const costO = override(costText);
  const fee = uses?.fee ? (feeO ?? auto.fee) : 0;
  const commission = uses?.commission ? (comO ?? auto.commission) : 0;
  const cost = uses?.portalCost ? (costO ?? auto.cost) : 0;
  const preview = service && amountPaise !== null ? previewEntry(service.flow, amountPaise, fee, commission, cost) : null;

  const pick = (s: ServiceOption) => {
    setService(s);
    setFeeText("");
    setCommissionText("");
    setCostText("");
    setError(undefined);
    setSaved(undefined);
    const remembered = readStored(walletKey(branchId, s.id));
    setWalletId(walletChoices.find((w) => w.id === remembered)?.id ?? walletChoices[0]?.id ?? "");
    if (s.flow === "cash_out" && (payMode === "udhaar" || payMode === "split")) setPayMode("cash");
    requestAnimationFrame(() => amountRef.current?.focus());
  };

  const reset = () => {
    setService(null);
    setAmount("");
    setFeeText("");
    setCommissionText("");
    setCostText("");
    setPayMode("cash");
    setParts([
      { kind: "cash", amount: "" },
      { kind: "upi", amount: "" },
    ]);
    setCustomer(null);
    setNote("");
    setClientId(crypto.randomUUID());
    requestAnimationFrame(() => pickerRef.current?.focus());
  };

  const save = async () => {
    setError(undefined);
    setSaved(undefined);
    if (!service) return setError("Pick a service");
    if (amountPaise === null || amountPaise <= 0) return setError("Enter the amount in rupees, e.g. 2000 or 20.50");
    if (feeO === undefined || comO === undefined || costO === undefined) return setError("Fee, commission and portal cost must be rupee amounts");
    if (uses?.wallet && !walletId) return setError("This branch has no wallet or bank account. Add one in setup.");
    if (!preview) return;

    const partsPaise = parts.map((p) => ({ kind: p.kind, amount: rupeesToPaise(p.amount || "0") ?? -1 }));
    if (payMode === "split" && partsPaise.some((p) => p.amount < 0)) return setError("Split amounts must be rupee amounts");
    const pay = buildPayments({
      mode: payMode,
      total: preview.customerTotal,
      flow: service.flow,
      cashId,
      upiId: upiId || undefined,
      hasCustomer: !!customer,
      parts: partsPaise,
    });
    if (!pay.ok) return setError(pay.error);

    setSaving(true);
    const supabase = createClient();
    const { error: err } = await supabase.rpc("post_service", {
      p_client_id: clientId,
      p_branch_id: branchId,
      p_service_id: service.id,
      p_amount: amountPaise,
      p_payments: pay.payments as unknown as Json,
      p_wallet_account_id: uses?.wallet ? walletId : undefined,
      p_customer_id: customer?.id,
      p_fee: uses?.fee && feeO !== null ? feeO : undefined,
      p_commission: uses?.commission && comO !== null ? comO : undefined,
      p_portal_cost: uses?.portalCost && costO !== null ? costO : undefined,
      p_note: note.trim() || undefined,
    });
    setSaving(false);
    if (err) {
      const offline = /fetch|network|Failed to fetch/i.test(err.message);
      return setError(offline ? "Not saved: check the internet and press Save again." : err.message);
    }
    if (uses?.wallet) writeStored(walletKey(branchId, service.id), walletId);
    setSaved(`${service.name} · ${formatINR(amountPaise)} saved`);
    reset();
    router.refresh();
  };

  return (
    <Card className="relative">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="flex flex-col gap-5"
      >
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl">New entry</h2>
          {saved ? (
            <p role="status" className="rise flex items-center gap-1 text-sm text-in">
              <Check size={16} /> {saved}
            </p>
          ) : null}
        </div>

        {service ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-accent bg-accent-soft px-4 py-3">
            <div>
              <p className="text-lg font-semibold">{service.name}</p>
              <p className="text-sm text-ink-soft">{flowLabel(service.flow)}</p>
            </div>
            <Button type="button" variant="ghost" onClick={() => setService(null)}>
              <ArrowLeftRight size={16} /> Change
            </Button>
          </div>
        ) : (
          <ServicePicker services={services} onPick={pick} onCreate={setCreating} inputRef={pickerRef} />
        )}

        {service ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={service.flow === "application" ? "Charge to customer (₹)" : "Amount (₹)"} htmlFor="amount">
                <Input
                  ref={amountRef}
                  id="amount"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0"
                  className="money min-h-13 text-2xl"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </Field>
              {uses?.wallet ? (
                <Field label="Portal / account" htmlFor="wallet">
                  <Select id="wallet" value={walletId} onChange={(e) => setWalletId(e.target.value)} className="min-h-13">
                    {walletChoices.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : null}
            </div>

            {uses && (uses.fee || uses.commission || uses.portalCost) ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {uses.fee ? (
                  <Field label="Fee (₹)" htmlFor="fee">
                    <Input id="fee" inputMode="decimal" className="money" placeholder={(auto.fee / 100).toFixed(2)} value={feeText} onChange={(e) => setFeeText(e.target.value)} />
                  </Field>
                ) : null}
                {uses.commission ? (
                  <Field label="Commission (₹)" htmlFor="commission">
                    <Input
                      id="commission"
                      inputMode="decimal"
                      className="money"
                      placeholder={(auto.commission / 100).toFixed(2)}
                      value={commissionText}
                      onChange={(e) => setCommissionText(e.target.value)}
                    />
                  </Field>
                ) : null}
                {uses.portalCost ? (
                  <Field label="Portal cost (₹)" htmlFor="cost">
                    <Input id="cost" inputMode="decimal" className="money" placeholder={(auto.cost / 100).toFixed(2)} value={costText} onChange={(e) => setCostText(e.target.value)} />
                  </Field>
                ) : null}
              </div>
            ) : null}

            {preview ? (
              <div className="ruled rounded-xl border border-rule bg-paper px-4 py-3" aria-live="polite">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-ink-soft">{preview.shopPays ? "Give customer" : "Collect from customer"}</span>
                  <span className={cx("money text-2xl font-semibold", preview.shopPays ? "text-out" : "text-in")}>
                    {formatINR(preview.customerTotal)}
                  </span>
                </div>
                <div className="mt-1 flex justify-between text-sm">
                  <span className="text-ink-soft">Shop earns</span>
                  <span className="money font-medium">{formatINR(preview.earning)}</span>
                </div>
              </div>
            ) : null}

            <Field label={preview?.shopPays ? "Paid out as" : "Customer pays by"}>
              <div role="radiogroup" className="grid grid-cols-4 gap-2">
                {PAY_MODES.filter((m) => service.flow !== "cash_out" || m.value === "cash" || m.value === "upi").map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    role="radio"
                    aria-checked={payMode === m.value}
                    onClick={() => setPayMode(m.value)}
                    className={cx(
                      "min-h-11 rounded-lg border text-[15px] font-medium transition",
                      payMode === m.value ? "border-accent bg-accent text-accent-ink" : "border-rule-strong bg-raised text-ink hover:border-ink-soft",
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </Field>

            {(payMode === "upi" || (payMode === "split" && parts.some((p) => p.kind === "upi"))) && banks.length > 1 ? (
              <Field label="UPI / bank account" htmlFor="upi">
                <Select id="upi" value={upiId} onChange={(e) => setUpiId(e.target.value)}>
                  {banks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}

            {payMode === "split" ? (
              <div className="flex flex-col gap-2">
                {parts.map((p, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1.2fr_auto] gap-2">
                    <Select
                      aria-label="Part type"
                      value={p.kind}
                      onChange={(e) => setParts(parts.map((x, j) => (j === i ? { ...x, kind: e.target.value as PartKind } : x)))}
                    >
                      <option value="cash">Cash</option>
                      <option value="upi">UPI</option>
                      {service.flow !== "cash_out" ? <option value="udhaar">Udhaar</option> : null}
                    </Select>
                    <Input
                      aria-label="Part amount"
                      inputMode="decimal"
                      className="money"
                      placeholder="₹"
                      value={p.amount}
                      onChange={(e) => setParts(parts.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))}
                    />
                    <Button type="button" variant="ghost" aria-label="Remove part" onClick={() => setParts(parts.filter((_, j) => j !== i))}>
                      <Trash2 size={16} />
                    </Button>
                  </div>
                ))}
                <div className="flex items-center justify-between">
                  <Button type="button" variant="ghost" onClick={() => setParts([...parts, { kind: "udhaar", amount: "" }])}>
                    <Plus size={16} /> Add part
                  </Button>
                  {preview ? (
                    <span className="money text-sm text-ink-soft">
                      Left:{" "}
                      {formatINR(preview.customerTotal - parts.reduce((s, p) => s + (rupeesToPaise(p.amount || "0") ?? 0), 0))}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}

            <Field label={payMode === "udhaar" || (payMode === "split" && parts.some((p) => p.kind === "udhaar")) ? "Customer (needed for udhaar)" : "Customer"}>
              <CustomerPicker
                customers={customers}
                shopId={shopId}
                value={customer}
                onChange={setCustomer}
                onAdded={(c) => setCustomers((cs) => [...cs, c])}
              />
            </Field>

            <Field label="Note" htmlFor="note">
              <Input id="note" placeholder="Optional" value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>

            {error ? <Banner>{error}</Banner> : null}

            <div className="sticky bottom-3 flex gap-3">
              <Button type="button" variant="secondary" onClick={reset}>
                Clear
              </Button>
              <Button type="submit" disabled={saving} className="flex-1 text-[17px]">
                {saving ? "Saving…" : "Save entry"}
              </Button>
            </div>
          </>
        ) : null}
      </form>

      <CreateServiceDialog
        name={creating}
        shopId={shopId}
        isOwner={isOwner}
        onClose={() => setCreating(null)}
        onCreated={(s) => {
          setServices((list) => (list.some((x) => x.id === s.id) ? list : [...list, s]));
          setCreating(null);
          pick(s);
        }}
      />
    </Card>
  );
}
