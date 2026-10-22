"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDownToLine, ArrowLeft, ArrowUpFromLine, Banknote, BookUser, Phone, Search, Smartphone, UserPlus } from "lucide-react";
import { Banner, Button, Card, Field, Input, Segmented, Select, cx } from "@/components/ui";
import { IconTile, KIND_ICON } from "@/components/icons";
import { formatINR, rupeesToPaise } from "@/lib/money";
import { PHONE_ERROR, cleanPhone } from "@/lib/phone";
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
  kind: string;
  note: string | null;
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
  // A customer just added shows up in `customers` only after the page refreshes.
  const [justAdded, setJustAdded] = useState<Customer | null>(null);
  const selected = customers.find((c) => c.id === selectedId) ?? (justAdded?.id === selectedId ? justAdded : null);
  const total = customers.reduce((s, c) => s + Math.max(c.due, 0), 0);
  const owing = customers.filter((c) => c.due > 0).length;

  const list = useMemo(() => {
    const n = normalizeName(q);
    return customers
      .filter((c) => (onlyDue && !n ? c.due !== 0 || c.id === selectedId : true))
      .filter((c) => !n || normalizeName(c.name).includes(n) || (c.phone ?? "").includes(n.replace(/\s/g, "")));
  }, [customers, q, onlyDue, selectedId]);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <Card className={cx(selected && "hidden lg:block")}>
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="font-display text-2xl">Udhaar</h1>
          <p className="text-sm text-ink-soft">
            {owing === 0 ? (
              "Nobody owes you"
            ) : (
              <>
                {owing} owe you <span className="money text-base font-semibold text-out">{formatINR(total)}</span>
              </>
            )}
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
        {adding ? (
          <AddCustomer
            shopId={shopId}
            initialName={q}
            onCancel={() => setAdding(false)}
            onAdded={(c) => {
              setAdding(false);
              setQ("");
              setJustAdded(c);
              setSelectedId(c.id);
            }}
          />
        ) : null}
        {list.length === 0 ? (
          <p className="py-10 text-center text-ink-soft">
            {q ? "No one found. Tap Add to create them." : "Nobody owes you money. Tap Add to give someone udhaar."}
          </p>
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
                  <span className="flex min-w-0 items-center gap-3">
                    <Initials name={c.name} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{c.name}</span>
                      {c.phone ? <span className="money text-sm text-ink-soft">{c.phone}</span> : null}
                    </span>
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
          <div className="flex flex-col items-center gap-3 py-16 text-center text-ink-soft">
            <IconTile icon={BookUser} tone="plain" />
            <p>Pick a customer to take payment, give udhaar or see their history.</p>
          </div>
        </Card>
      )}
    </div>
  );
}

function Initials({ name }: { name: string }) {
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span aria-hidden className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-paper text-sm font-semibold text-ink-soft">
      {letters || "?"}
    </span>
  );
}

function AddCustomer({
  shopId,
  initialName,
  onCancel,
  onAdded,
}: {
  shopId: string;
  initialName: string;
  onCancel: () => void;
  onAdded: (c: Customer) => void;
}) {
  const { busy, error, run, setError } = useSubmit();
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState("");
  return (
    <form
      className="mt-3 flex flex-col gap-3 rounded-xl border border-dashed border-rule-strong p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return setError("Enter a name");
        const cleaned = cleanPhone(phone);
        if (cleaned === null) return setError(PHONE_ERROR);
        let added: Customer | null = null;
        const ok = await run(async () => {
          const res = await createClient()
            .from("customers")
            .insert({ shop_id: shopId, name: name.trim(), phone: cleaned || null })
            .select("id, name, phone")
            .single();
          if (res.data) added = { ...res.data, due: 0 };
          return res;
        }, "Added");
        if (ok && added) onAdded(added);
      }}
    >
      <Input aria-label="Customer name" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <Input aria-label="Phone" placeholder="Phone (optional)" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      {error ? <Banner>{/duplicate|unique/i.test(error) ? "Someone with this phone already exists" : error}</Banner> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          Add customer
        </Button>
      </div>
    </form>
  );
}

type Action = "pay" | "take";

const rupeesText = (paise: number) => (paise / 100).toFixed(2).replace(/\.00$/, "");

const HISTORY_WHAT: Record<string, string> = {
  udhaar_payment: "Paid back",
  udhaar_given: "Took money",
  reversal: "Reversed",
};

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
  const { busy, error, done, run, setError, setDone } = useSubmit();
  const due = customer.due;
  const [action, setAction] = useState<Action>(due > 0 ? "pay" : "take");
  const [amount, setAmount] = useState(due > 0 ? rupeesText(due) : "");
  const [mode, setMode] = useState<"cash" | "upi">("cash");
  const [bankId, setBankId] = useState(banks[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [clientId, setClientId] = useState(() => crypto.randomUUID());
  const [history, setHistory] = useState<HistoryRow[] | null>(null);
  const paise = rupeesToPaise(amount);

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
            return {
              id: l.id,
              amount: Number(l.amount),
              when: new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(t.created_at)),
              what: HISTORY_WHAT[t.kind] ?? t.services?.name ?? t.kind,
              kind: t.kind,
              note: t.note,
            };
          }),
        );
      });
    return () => {
      live = false;
    };
  }, [customer.id, done]);

  const switchAction = (a: Action) => {
    setAction(a);
    setAmount(a === "pay" && due > 0 ? rupeesText(due) : "");
    setError(undefined);
    setDone(undefined);
  };

  // What will happen, in counter words, before saving.
  let hint: string | null = null;
  if (action === "pay") {
    if (due <= 0) hint = "They owe nothing now. This money will be kept as their advance.";
    else if (paise && paise > due) hint = `${formatINR(paise - due)} more than they owe. The extra is kept as their advance.`;
    else if (paise && paise < due) hint = `They will still owe ${formatINR(due - paise)}.`;
  } else if (paise) {
    if (due < 0 && paise <= -due) hint = `Giving back their advance.${paise < -due ? ` ${formatINR(-due - paise)} advance stays.` : ""}`;
    else if (due < 0) hint = `${formatINR(-due)} is their advance, ${formatINR(paise + due)} becomes udhaar.`;
    else hint = `They will owe you ${formatINR(due + paise)}.`;
  }

  const submit = async () => {
    if (!paise) return setError(action === "pay" ? "Enter the amount received" : "Enter the amount given");
    const accountId = mode === "cash" ? cashId : bankId;
    if (!accountId) return setError(mode === "cash" ? "No cash account in this branch" : "No bank/UPI account in this branch");
    const args = {
      p_client_id: clientId,
      p_branch_id: branchId,
      p_customer_id: customer.id,
      p_account_id: accountId,
      p_amount: paise,
      p_note: note.trim() || undefined,
    };
    const ok = await run(
      () => createClient().rpc(action === "pay" ? "post_udhaar_payment" : "post_udhaar_given", args),
      action === "pay" ? `${formatINR(paise)} received from ${customer.name}` : `${formatINR(paise)} given to ${customer.name}`,
    );
    if (ok) {
      setAmount("");
      setNote("");
      setClientId(crypto.randomUUID());
    }
  };

  const pay = action === "pay";

  return (
    <Card>
      <button type="button" onClick={onBack} className="mb-3 inline-flex items-center gap-1 text-sm text-ink-soft lg:hidden">
        <ArrowLeft size={16} /> All customers
      </button>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Initials name={customer.name} />
          <div className="min-w-0">
            <h2 className="truncate font-display text-2xl">{customer.name}</h2>
            {customer.phone ? (
              <a href={`tel:${customer.phone}`} className="money mt-1 inline-flex items-center gap-1 text-sm text-accent">
                <Phone size={14} /> {customer.phone}
              </a>
            ) : null}
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-ink-soft">{due < 0 ? "Advance" : "Owes you"}</p>
          <p className={cx("money text-2xl font-semibold", due > 0 ? "text-out" : due < 0 ? "text-in" : "text-ink-soft")}>{formatINR(Math.abs(due))}</p>
        </div>
      </div>

      <div className="mt-6">
        <Segmented
          label="What is happening?"
          options={[
            { value: "pay", label: "Paying back", icon: <ArrowDownToLine size={17} aria-hidden /> },
            { value: "take", label: due < 0 ? "Return advance" : "Taking money", icon: <ArrowUpFromLine size={17} aria-hidden /> },
          ]}
          value={action}
          onChange={switchAction}
        />
      </div>

      <form
        className="mt-3 flex flex-col gap-4 rounded-xl border border-rule bg-paper p-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <p className="text-sm text-ink-soft">
          {pay
            ? "Customer gives you money for their udhaar."
            : due < 0
              ? "You give the customer back the advance they left with you."
              : "Customer takes cash or UPI from the shop without buying anything. They will owe you."}
        </p>
        <Field label={pay ? "Amount received (₹)" : "Amount given (₹)"} htmlFor="ud-amount">
          <Input id="ud-amount" inputMode="decimal" placeholder="0" className="money min-h-13 text-2xl" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Segmented
          label={pay ? "How did they pay?" : "How do you give the money?"}
          options={[
            { value: "cash", label: "Cash", icon: <Banknote size={17} aria-hidden /> },
            { value: "upi", label: "UPI", icon: <Smartphone size={17} aria-hidden /> },
          ]}
          value={mode}
          onChange={setMode}
        />
        {mode === "upi" && banks.length > 1 ? (
          <Select aria-label={pay ? "UPI received in" : "UPI sent from"} value={bankId} onChange={(e) => setBankId(e.target.value)}>
            {banks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        ) : null}
        <Input
          aria-label="Note"
          placeholder={pay ? "Note (optional)" : "What for? (optional) e.g. hospital, returns Monday"}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        {hint ? <p className="text-sm font-medium">{hint}</p> : null}
        {error ? <Banner>{error}</Banner> : null}
        {done ? <Banner tone="info">{done}</Banner> : null}
        <Button type="submit" disabled={busy} className="min-h-12">
          {busy ? "Saving…" : pay ? "Save payment" : due < 0 ? "Save advance returned" : "Save udhaar given"}
        </Button>
      </form>

      <h3 className="mt-6 font-medium">History</h3>
      {history === null ? (
        <p className="py-6 text-sm text-ink-soft">Loading…</p>
      ) : history.length === 0 ? (
        <p className="py-6 text-sm text-ink-soft">No udhaar yet.</p>
      ) : (
        <>
          <ul className="mt-2 divide-y divide-rule">
            {history.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="flex min-w-0 items-center gap-3">
                  <IconTile size="sm" icon={KIND_ICON[h.kind] ?? BookUser} tone={h.kind === "reversal" ? "plain" : h.amount > 0 ? "out" : "in"} />
                  <span className="min-w-0">
                    <span className="block">{h.what}</span>
                    <span className="block truncate text-xs text-ink-soft">
                      {h.when}
                      {h.note ? ` · ${h.note}` : ""}
                    </span>
                  </span>
                </span>
                <span className={cx("money font-medium", h.amount > 0 ? "text-out" : "text-in")}>
                  {h.amount > 0 ? "+" : "−"}
                  {formatINR(Math.abs(h.amount))}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-soft">+ means they owe more. − means they paid, or you are holding their money.</p>
        </>
      )}
    </Card>
  );
}
