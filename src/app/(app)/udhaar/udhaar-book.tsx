"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Phone, Search, UserPlus } from "lucide-react";
import { Banner, Button, Card, Field, Input, Segmented, Select, cx } from "@/components/ui";
import { formatINR, rupeesToPaise } from "@/lib/money";
import { normalizeName } from "@/lib/services";
import { createClient } from "@/lib/supabase/client";
import { useSubmit } from "@/lib/use-submit";

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  due: number;
}

interface HistoryRow {
  id: number;
  amount: number;
  when: string;
  what: string;
}

export function UdhaarBook({
  shopId,
  branchId,
  customers,
  cashId,
  banks,
}: {
  shopId: string;
  branchId: string;
  customers: Customer[];
  cashId?: string;
  banks: { id: string; name: string }[];
}) {
  const [q, setQ] = useState("");
  const [onlyDue, setOnlyDue] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const selected = customers.find((c) => c.id === selectedId) ?? null;
  const total = customers.reduce((s, c) => s + Math.max(c.due, 0), 0);
  const owing = customers.filter((c) => c.due > 0).length;

  const list = useMemo(() => {
    const n = normalizeName(q);
    return customers
      .filter((c) => (onlyDue && !n ? c.due !== 0 : true))
      .filter((c) => !n || normalizeName(c.name).includes(n) || (c.phone ?? "").includes(n.replace(/\s/g, "")));
  }, [customers, q, onlyDue]);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <Card className={cx(selected && "hidden lg:block")}>
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="font-display text-2xl">Udhaar</h1>
          <p className="text-sm text-ink-soft">
            {owing} owe <span className="money text-base font-semibold text-out">{formatINR(total)}</span>
          </p>
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-rule-strong bg-raised px-3 focus-within:border-accent">
          <Search size={16} className="text-ink-soft" aria-hidden />
          <input
            aria-label="Search customer"
            placeholder="Name or phone"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="min-h-11 w-full bg-transparent text-[16px] focus:outline-none"
          />
        </div>
        <div className="mt-3 flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <input type="checkbox" checked={onlyDue} onChange={(e) => setOnlyDue(e.target.checked)} className="size-4 accent-[var(--accent)]" />
            Only people with udhaar
          </label>
          <Button variant="ghost" onClick={() => setAdding(true)}>
            <UserPlus size={16} /> Add
          </Button>
        </div>
        {adding ? <AddCustomer shopId={shopId} initialName={q} onDone={() => setAdding(false)} /> : null}
        {list.length === 0 ? (
          <p className="py-10 text-center text-ink-soft">{q ? "No one found." : "Nobody owes you money. 🎉"}</p>
        ) : (
          <ul className="mt-2 divide-y divide-rule">
            {list.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className={cx(
                    "flex min-h-14 w-full items-center justify-between gap-3 rounded-lg px-2 text-left hover:bg-paper",
                    selectedId === c.id && "bg-accent-soft",
                  )}
                >
                  <span>
                    <span className="block font-medium">{c.name}</span>
                    {c.phone ? <span className="money text-sm text-ink-soft">{c.phone}</span> : null}
                  </span>
                  <span className={cx("money font-semibold", c.due > 0 ? "text-out" : c.due < 0 ? "text-in" : "text-ink-soft")}>
                    {c.due < 0 ? `advance ${formatINR(-c.due)}` : formatINR(c.due)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {selected ? (
        <CustomerPanel key={selected.id} customer={selected} branchId={branchId} cashId={cashId} banks={banks} onBack={() => setSelectedId(null)} />
      ) : (
        <Card className="hidden lg:block">
          <p className="py-16 text-center text-ink-soft">Pick a customer to take payment or see their history.</p>
        </Card>
      )}
    </div>
  );
}

function AddCustomer({ shopId, initialName, onDone }: { shopId: string; initialName: string; onDone: () => void }) {
  const { busy, error, run, setError } = useSubmit();
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState("");
  return (
    <form
      className="mt-3 flex flex-col gap-3 rounded-xl border border-dashed border-rule-strong p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return setError("Enter a name");
        const ok = await run(
          () => createClient().from("customers").insert({ shop_id: shopId, name: name.trim(), phone: phone.trim() || null }),
          "Added",
        );
        if (ok) onDone();
      }}
    >
      <Input aria-label="Customer name" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <Input aria-label="Phone" placeholder="Phone (optional)" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      {error ? <Banner>{/duplicate|unique/i.test(error) ? "Someone with this phone already exists" : error}</Banner> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          Add customer
        </Button>
      </div>
    </form>
  );
}

function CustomerPanel({
  customer,
  branchId,
  cashId,
  banks,
  onBack,
}: {
  customer: Customer;
  branchId: string;
  cashId?: string;
  banks: { id: string; name: string }[];
  onBack: () => void;
}) {
  const { busy, error, done, run, setError } = useSubmit();
  const [amount, setAmount] = useState(customer.due > 0 ? (customer.due / 100).toFixed(2).replace(/\.00$/, "") : "");
  const [mode, setMode] = useState<"cash" | "upi">("cash");
  const [bankId, setBankId] = useState(banks[0]?.id ?? "");
  const [clientId, setClientId] = useState(() => crypto.randomUUID());
  const [history, setHistory] = useState<HistoryRow[] | null>(null);

  useEffect(() => {
    let live = true;
    void createClient()
      .from("ledger_lines")
      .select("id, amount, transactions(created_at, kind, note, services(name))")
      .eq("customer_id", customer.id)
      .order("id", { ascending: false })
      .limit(100)
      .then(({ data }) => {
        if (!live) return;
        setHistory(
          (data ?? []).map((l) => {
            const t = l.transactions as unknown as { created_at: string; kind: string; note: string | null; services: { name: string } | null };
            const what = t.kind === "udhaar_payment" ? "Paid back" : t.kind === "reversal" ? `Reversed${t.note ? `: ${t.note}` : ""}` : (t.services?.name ?? t.kind);
            return {
              id: l.id,
              amount: Number(l.amount),
              when: new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(t.created_at)),
              what,
            };
          }),
        );
      });
    return () => {
      live = false;
    };
  }, [customer.id, done]);

  const submit = async () => {
    const paise = rupeesToPaise(amount);
    if (!paise) return setError("Enter the amount received");
    const accountId = mode === "cash" ? cashId : bankId;
    if (!accountId) return setError(mode === "cash" ? "No cash account in this branch" : "No bank/UPI account in this branch");
    const ok = await run(
      () =>
        createClient().rpc("post_udhaar_payment", {
          p_client_id: clientId,
          p_branch_id: branchId,
          p_customer_id: customer.id,
          p_account_id: accountId,
          p_amount: paise,
        }),
      `${formatINR(paise)} received from ${customer.name}`,
    );
    if (ok) {
      setAmount("");
      setClientId(crypto.randomUUID());
    }
  };

  return (
    <Card>
      <button type="button" onClick={onBack} className="mb-3 inline-flex items-center gap-1 text-sm text-ink-soft lg:hidden">
        <ArrowLeft size={16} /> All customers
      </button>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl">{customer.name}</h2>
          {customer.phone ? (
            <a href={`tel:${customer.phone}`} className="money mt-1 inline-flex items-center gap-1 text-sm text-accent">
              <Phone size={14} /> {customer.phone}
            </a>
          ) : null}
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-ink-soft">{customer.due < 0 ? "Advance" : "Owes you"}</p>
          <p className={cx("money text-2xl font-semibold", customer.due > 0 ? "text-out" : "text-in")}>{formatINR(Math.abs(customer.due))}</p>
        </div>
      </div>

      <form
        className="mt-6 flex flex-col gap-4 rounded-xl border border-rule bg-paper p-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <h3 className="font-medium">Customer is paying back</h3>
        <Field label="Amount received (₹)" htmlFor="ud-amount">
          <Input id="ud-amount" inputMode="decimal" className="money min-h-13 text-2xl" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Segmented
          label="Paid by"
          options={[
            { value: "cash", label: "Cash" },
            { value: "upi", label: "UPI" },
          ]}
          value={mode}
          onChange={setMode}
        />
        {mode === "upi" && banks.length > 1 ? (
          <Select aria-label="UPI received in" value={bankId} onChange={(e) => setBankId(e.target.value)}>
            {banks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        ) : null}
        {error ? <Banner>{error}</Banner> : null}
        {done ? <Banner tone="info">{done}</Banner> : null}
        <Button type="submit" disabled={busy} className="min-h-12">
          {busy ? "Saving…" : "Save payment"}
        </Button>
      </form>

      <h3 className="mt-6 font-medium">History</h3>
      {history === null ? (
        <p className="py-6 text-sm text-ink-soft">Loading…</p>
      ) : history.length === 0 ? (
        <p className="py-6 text-sm text-ink-soft">No udhaar yet.</p>
      ) : (
        <ul className="mt-2 divide-y divide-rule">
          {history.map((h) => (
            <li key={h.id} className="flex items-center justify-between gap-3 py-2.5">
              <span>
                <span className="block">{h.what}</span>
                <span className="text-xs text-ink-soft">{h.when}</span>
              </span>
              <span className={cx("money font-medium", h.amount > 0 ? "text-out" : "text-in")}>
                {h.amount > 0 ? "+" : "−"}
                {formatINR(Math.abs(h.amount))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
