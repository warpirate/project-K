"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Banknote, BookUser, Check, Plus, Smartphone, Split, Trash2 } from "lucide-react";
import { ServiceGlyph } from "@/components/icons";
import { Banner, Button, Card, Field, Input, Select, cx } from "@/components/ui";
import { formatINR, rupeesToPaise } from "@/lib/money";
import { calcRule, previewEntry } from "@/lib/rules";
import { flowCopy, flowLabel, flowUses } from "@/lib/flows";
import { buildPayments, changeDue, type PartKind, type PayMode } from "@/lib/payments";
import { branchPayButtons, defaultPayKey } from "@/lib/pay-buttons";
import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/database.types";
import { ServicePicker } from "./service-picker";
import { CreateServiceDialog } from "./create-service-dialog";
import { CustomerPicker } from "./customer-picker";
import type { AccountOption, CustomerOption, ServiceOption } from "./types";

const PAY_ICON = { cash: Banknote, upi: Smartphone, udhaar: BookUser, split: Split } as const;

const walletKey = (branchId: string, serviceId: string) => `pk:wallet:${branchId}:${serviceId}`;
/** Withdrawals: "apart:<button key>" when the customer pays the charge separately, "cut" when it comes off the cash. */
const chargeKey = (branchId: string, serviceId: string) => `pk:charge:${branchId}:${serviceId}`;

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

const rupeesText = (paise: number) => (paise / 100).toFixed(2).replace(/\.00$/, "");

/** Optional rupee box: "" → null (use default); invalid → undefined. */
function optionalPaise(v: string): number | null | undefined {
  if (v.trim() === "") return null;
  const p = rupeesToPaise(v);
  return p === null ? undefined : p;
}

/** Small "+ Something" link that reveals an optional field. */
function Reveal({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-10 items-center gap-1 rounded-full border border-dashed border-rule-strong px-3 text-sm text-ink-soft hover:border-accent hover:text-accent"
    >
      <Plus size={14} /> {label}
    </button>
  );
}

export function EntryForm({
  businessType,
  searchHint,
  shopId,
  branchId,
  isOwner,
  services: initialServices,
  accounts,
  customers: initialCustomers,
  payButtons,
  defaultPay,
}: {
  businessType: string | null;
  /** Search box hint for this kind of business. */
  searchHint?: string;
  shopId: string;
  branchId: string;
  isOwner: boolean;
  services: ServiceOption[];
  accounts: AccountOption[];
  customers: CustomerOption[];
  /** Branch's saved payment buttons (null = Cash + every bank/UPI account). */
  payButtons: string[] | null;
  defaultPay: string | null;
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
  const [showCharges, setShowCharges] = useState(false);
  const [feeText, setFeeText] = useState("");
  // The charge box shows the usual charge until someone types over it.
  const [feeEdited, setFeeEdited] = useState(false);
  // Withdrawals: customer pays the charge on top (by cash or QR) instead of it being cut from the cash.
  const [chargeApart, setChargeApart] = useState(false);
  const [chargeBy, setChargeBy] = useState("cash");
  const [commissionText, setCommissionText] = useState("");
  const [costText, setCostText] = useState("");
  const buttons = useMemo(() => branchPayButtons(payButtons, accounts), [payButtons, accounts]);
  const startKey = defaultPayKey(defaultPay, buttons);
  const [payKey, setPayKey] = useState(startKey);
  const [upiId, setUpiId] = useState(accounts.find((a) => a.type === "bank")?.id ?? "");
  const [receivedText, setReceivedText] = useState("");
  const [showReceived, setShowReceived] = useState(false);
  const [parts, setParts] = useState<{ kind: PartKind; amount: string }[]>([
    { kind: "cash", amount: "" },
    { kind: "upi", amount: "" },
  ]);
  const [showCustomer, setShowCustomer] = useState(false);
  const [customer, setCustomer] = useState<CustomerOption | null>(null);
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState("");
  const [clientId, setClientId] = useState(() => crypto.randomUUID());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState<string>();

  const cashId = accounts.find((a) => a.type === "cash")?.id;
  const banks = accounts.filter((a) => a.type === "bank");
  const walletChoices = [...accounts.filter((a) => a.type === "wallet"), ...banks];
  const uses = service ? flowUses(service.flow) : null;
  const copy = service ? flowCopy(service.flow) : null;
  const givesCash = service?.flow === "cash_out";
  // When the shop gives cash there is no udhaar or mixed: only cash and bank/UPI buttons.
  const shownButtons = givesCash ? buttons.filter((b) => b.mode === "cash" || b.mode === "upi") : buttons;
  const payButton = shownButtons.find((b) => b.key === payKey) ?? shownButtons[0];
  const payMode: PayMode = payButton?.mode ?? "cash";
  const payUpiId = payButton?.mode === "upi" ? payButton.accountId : upiId;

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

  const feeO = feeEdited ? (feeText.trim() === "" ? 0 : optionalPaise(feeText)) : null;
  const comO = optionalPaise(commissionText);
  const costO = optionalPaise(costText);
  const receivedO = optionalPaise(receivedText);
  const fee = uses?.fee ? (feeO ?? auto.fee) : 0;
  const commission = uses?.commission ? (comO ?? auto.commission) : 0;
  const cost = uses?.portalCost ? (costO ?? auto.cost) : 0;
  const preview = service && amountPaise !== null ? previewEntry(service.flow, amountPaise, fee, commission, cost) : null;
  const needsCustomer = payMode === "udhaar" || (payMode === "split" && parts.some((p) => p.kind === "udhaar"));
  const change = preview && !givesCash && (payMode === "cash" || payMode === "upi") ? changeDue(preview.customerTotal, receivedO ?? undefined) : 0;
  const separateCharge = givesCash && fee > 0 && chargeApart;
  // Paid separately: the customer gets the full amount and hands the charge over by cash or QR.
  const giveTotal = preview ? preview.customerTotal + (separateCharge ? fee : 0) : 0;
  const chargeButtons = shownButtons; // withdrawals only show Cash and bank/UPI buttons
  const chargeButton = chargeButtons.find((b) => b.key === chargeBy) ?? chargeButtons[0];

  const pick = (s: ServiceOption) => {
    setService(s);
    // Fixed-price items come with their usual price; it can still be changed for this sale.
    if (s.price !== null && s.price !== undefined && !flowUses(s.flow).fee) setAmount(String(Number((s.price / 100).toFixed(2))));
    setFeeText("");
    setFeeEdited(false);
    setCommissionText("");
    setCostText("");
    setShowCharges(false);
    setError(undefined);
    setSaved(undefined);
    const remembered = readStored(walletKey(branchId, s.id));
    // UPI-to-cash money lands in the bank; everything else defaults to the first portal wallet.
    const preferred = s.category === "upi_cash" || /\bupi\b/i.test(s.name) ? banks[0] : undefined;
    setWalletId(walletChoices.find((w) => w.id === remembered)?.id ?? preferred?.id ?? walletChoices[0]?.id ?? "");
    const charge = readStored(chargeKey(branchId, s.id));
    setChargeApart(!!charge?.startsWith("apart"));
    setChargeBy(charge?.startsWith("apart:") ? charge.slice(6) : "cash");
    requestAnimationFrame(() => amountRef.current?.focus());
  };

  const reset = () => {
    setService(null);
    setAmount("");
    setFeeText("");
    setFeeEdited(false);
    setCommissionText("");
    setCostText("");
    setShowCharges(false);
    setPayKey(startKey);
    setReceivedText("");
    setShowReceived(false);
    setParts([
      { kind: "cash", amount: "" },
      { kind: "upi", amount: "" },
    ]);
    setCustomer(null);
    setShowCustomer(false);
    setNote("");
    setShowNote(false);
    setClientId(crypto.randomUUID());
    // The service grid comes back and focuses its search box itself (desktop only).
  };

  const save = async () => {
    setError(undefined);
    setSaved(undefined);
    if (!service) return setError("Pick a service");
    if (amountPaise === null || amountPaise <= 0) return setError("Enter the amount, like 2000 or 20.50");
    if (feeO === undefined || comO === undefined || costO === undefined) return setError("Charges must be rupee amounts, like 20");
    if (receivedO === undefined) return setError("\"Customer gave\" must be a rupee amount");
    if (uses?.wallet && !walletId) return setError("This branch has no wallet or bank account yet. Add one in setup.");
    if (!preview) return;

    const partsPaise = parts.map((p) => ({ kind: p.kind, amount: rupeesToPaise(p.amount || "0") ?? -1 }));
    if (payMode === "split" && partsPaise.some((p) => p.amount < 0)) return setError("Mixed amounts must be rupee amounts");
    const pay = buildPayments({
      mode: payMode,
      total: giveTotal,
      flow: service.flow,
      cashId,
      upiId: payUpiId || undefined,
      hasCustomer: !!customer,
      parts: partsPaise,
      received: givesCash ? undefined : (receivedO ?? undefined),
    });
    if (!pay.ok) {
      if (needsCustomer && !customer) setShowCustomer(true);
      return setError(pay.error);
    }
    if (separateCharge) {
      // The charge comes back in: a negative part on the account it was paid into (cash drawer or QR/bank).
      const chargeAccount = chargeButton?.mode === "upi" ? chargeButton.accountId : cashId;
      if (!chargeAccount) return setError("Pick where the charge was paid");
      pay.payments.push({ account_id: chargeAccount, amount: -fee });
    }

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
      const offline = /fetch|network/i.test(err.message);
      return setError(offline ? "Not saved: check the internet and press Save again." : err.message);
    }
    if (uses?.wallet) writeStored(walletKey(branchId, service.id), walletId);
    if (givesCash && fee > 0) writeStored(chargeKey(branchId, service.id), chargeApart ? `apart:${chargeButton?.key ?? "cash"}` : "cut");
    setSaved(
      `${service.name} · ${formatINR(amountPaise)} saved${change ? ` · give back ${formatINR(change)}` : ""}${
        separateCharge ? ` · take ${formatINR(fee)} charge by ${chargeButton?.label ?? "Cash"}` : ""
      }`,
    );
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
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-2xl">New entry</h2>
          {saved ? (
            <p role="status" className="rise flex items-center gap-1 text-sm text-in">
              <Check size={16} /> {saved}
            </p>
          ) : null}
        </div>

        {service && copy ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-accent bg-accent-soft px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <ServiceGlyph name={service.name} flow={service.flow} />
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold">{service.name}</p>
                <p className="text-sm text-ink-soft">{flowLabel(service.flow)}</p>
              </div>
            </div>
            <Button type="button" variant="ghost" onClick={() => setService(null)}>
              <ArrowLeftRight size={16} /> Change
            </Button>
          </div>
        ) : (
          <ServicePicker services={services} onPick={pick} onCreate={setCreating} inputRef={pickerRef} placeholder={searchHint} />
        )}

        {service && copy && uses ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={copy.amount} htmlFor="amount">
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
              {uses.wallet && walletChoices.length > 1 ? (
                <Field label={copy.account} htmlFor="wallet">
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

            {preview ? (
              <div className="rounded-xl border border-rule bg-paper px-4 py-3" aria-live="polite">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-ink-soft">{copy.money}</span>
                  <span className={cx("money text-2xl font-semibold", preview.shopPays ? "text-out" : "text-in")}>
                    {formatINR(giveTotal)}
                  </span>
                </div>
                {uses.fee ? (
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-rule pt-3">
                    <label htmlFor="fee" className="text-sm font-medium" title={copy.charge}>
                      Your charge
                    </label>
                    <div className="flex items-center overflow-hidden rounded-lg border border-rule-strong bg-raised focus-within:border-accent">
                      <span className="px-2 text-ink-soft">₹</span>
                      <Input
                        id="fee"
                        inputMode="decimal"
                        className="money min-h-10 w-24 rounded-none border-0 px-1 text-lg font-semibold focus:border-0"
                        value={feeEdited ? feeText : rupeesText(auto.fee)}
                        onChange={(e) => {
                          setFeeEdited(true);
                          setFeeText(e.target.value);
                        }}
                        onFocus={(e) => e.target.select()}
                      />
                    </div>
                    {feeEdited && feeO !== auto.fee ? (
                      <button type="button" onClick={() => setFeeEdited(false)} className="text-sm text-accent underline-offset-4 hover:underline">
                        use usual {formatINR(auto.fee)}
                      </button>
                    ) : (
                      <span className="text-xs text-ink-soft">usual charge · type to change</span>
                    )}
                  </div>
                ) : null}
                {givesCash && fee > 0 ? (
                  <div className="mt-3 flex flex-col gap-2">
                    <div role="radiogroup" aria-label="How is the charge taken?" className="grid grid-cols-2 gap-2">
                      {[
                        { apart: false, label: "Cut from cash" },
                        { apart: true, label: "Paid separately" },
                      ].map((o) => (
                        <button
                          key={o.label}
                          type="button"
                          role="radio"
                          aria-checked={chargeApart === o.apart}
                          onClick={() => setChargeApart(o.apart)}
                          className={cx(
                            "min-h-11 rounded-lg border px-2 text-sm font-medium transition",
                            chargeApart === o.apart ? "border-accent bg-accent-soft text-ink" : "border-rule-strong bg-raised text-ink-soft hover:border-ink-soft",
                          )}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                    {chargeApart ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-ink-soft">Take {formatINR(fee)} charge by</span>
                        <div role="radiogroup" aria-label="Charge paid by" className="flex flex-wrap gap-2">
                          {chargeButtons.map((b) => {
                            const Icon = PAY_ICON[b.mode];
                            const on = chargeButton?.key === b.key;
                            return (
                              <button
                                key={b.key}
                                type="button"
                                role="radio"
                                aria-checked={on}
                                onClick={() => setChargeBy(b.key)}
                                className={cx(
                                  "inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition",
                                  on ? "border-accent bg-accent text-accent-ink" : "border-rule-strong bg-raised text-ink hover:border-ink-soft",
                                )}
                              >
                                <Icon size={15} aria-hidden /> {b.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="text-ink-soft">
                    You earn <span className="money font-medium text-ink">{formatINR(preview.earning)}</span>
                  </span>
                  {(uses.commission || uses.portalCost) && !showCharges ? (
                    <button type="button" onClick={() => setShowCharges(true)} className="text-accent underline-offset-4 hover:underline">
                      {uses.commission ? "Portal commission · change" : "Portal fee · change"}
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {showCharges ? (
              <div className="grid gap-4 rounded-xl border border-dashed border-rule-strong p-4 sm:grid-cols-2">
                {uses.commission ? (
                  <Field label="Portal commission to you" htmlFor="commission" hint="What the portal pays you. Usually automatic.">
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
                  <Field label="Portal fee cut from your wallet" htmlFor="cost">
                    <Input id="cost" inputMode="decimal" className="money" placeholder={(auto.cost / 100).toFixed(2)} value={costText} onChange={(e) => setCostText(e.target.value)} />
                  </Field>
                ) : null}
              </div>
            ) : null}

            <Field label={copy.pay}>
              <div role="radiogroup" className="grid grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fit,minmax(7.5rem,1fr))]">
                {shownButtons.map((b) => {
                  const Icon = PAY_ICON[b.mode];
                  const on = payButton?.key === b.key;
                  return (
                    <button
                      key={b.key}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => {
                        setPayKey(b.key);
                        if (b.mode === "udhaar") setShowCustomer(true);
                      }}
                      className={cx(
                        "flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-lg border px-2 text-[15px] font-medium transition",
                        on ? "border-accent bg-accent text-accent-ink" : "border-rule-strong bg-raised text-ink hover:border-ink-soft",
                      )}
                    >
                      <Icon size={17} aria-hidden className="shrink-0" />
                      <span className="truncate">{b.label}</span>
                    </button>
                  );
                })}
              </div>
            </Field>

            {payMode === "split" && parts.some((p) => p.kind === "upi") && banks.length > 1 ? (
              <Field label={givesCash ? "UPI sent from" : "UPI received in"} htmlFor="upi">
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
                      aria-label="Paid by"
                      value={p.kind}
                      onChange={(e) => setParts(parts.map((x, j) => (j === i ? { ...x, kind: e.target.value as PartKind } : x)))}
                    >
                      <option value="cash">Cash</option>
                      <option value="upi">UPI</option>
                      <option value="udhaar">Udhaar</option>
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
                      Left: {formatINR(preview.customerTotal - parts.reduce((s, p) => s + (rupeesToPaise(p.amount || "0") ?? 0), 0))}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}

            {showReceived && !givesCash && (payMode === "cash" || payMode === "upi") ? (
              <Field
                label={payMode === "upi" ? "Customer sent by UPI (₹)" : "Customer gave (₹)"}
                htmlFor="received"
                hint={payMode === "upi" ? "If they sent extra, give the rest back in cash" : "To work out the change"}
              >
                <Input id="received" inputMode="decimal" className="money" placeholder="0" value={receivedText} onChange={(e) => setReceivedText(e.target.value)} />
              </Field>
            ) : null}
            {change > 0 ? (
              <div className="rise flex items-baseline justify-between rounded-xl bg-highlight/15 px-4 py-3">
                <span className="font-medium">Give back in cash</span>
                <span className="money text-xl font-semibold text-out">{formatINR(change)}</span>
              </div>
            ) : null}

            {showCustomer || needsCustomer ? (
              <Field label={needsCustomer ? "Customer (needed for udhaar)" : "Customer"}>
                <CustomerPicker customers={customers} shopId={shopId} value={customer} onChange={setCustomer} onAdded={(c) => setCustomers((cs) => [...cs, c])} />
              </Field>
            ) : null}

            {showNote ? (
              <Field label="Note" htmlFor="note">
                <Input id="note" autoFocus placeholder="Anything to remember" value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {!givesCash && (payMode === "cash" || payMode === "upi") && !showReceived ? (
                <Reveal label={payMode === "upi" ? "Customer sent extra?" : "Customer gave a big note?"} onClick={() => setShowReceived(true)} />
              ) : null}
              {!showCustomer && !needsCustomer ? <Reveal label="Customer name" onClick={() => setShowCustomer(true)} /> : null}
              {!showNote ? <Reveal label="Note" onClick={() => setShowNote(true)} /> : null}
            </div>

            {error ? <Banner>{error}</Banner> : null}

            <div className="sticky bottom-[calc(60px+env(safe-area-inset-bottom))] md:bottom-0 -mx-5 -mb-5 flex gap-3 rounded-b-2xl border-t border-rule bg-raised/95 px-5 py-3 backdrop-blur sm:-mx-6 sm:-mb-6 sm:px-6">
              <Button type="button" variant="secondary" onClick={reset}>
                Clear
              </Button>
              <Button type="submit" disabled={saving} className="min-h-12 flex-1 text-[17px]">
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </>
        ) : null}
      </form>

      <CreateServiceDialog
        name={creating}
        businessType={businessType}
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
