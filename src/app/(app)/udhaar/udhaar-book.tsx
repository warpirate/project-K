"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDownToLine, ArrowLeft, ArrowUpFromLine, Banknote, BookUser, CircleCheck, Phone, Search, Smartphone, UserPlus } from "lucide-react";
import { Banner, Button, Card, Field, Input, Segmented, Select, cx } from "@/components/ui";
import { IconTile, KIND_ICON } from "@/components/icons";
import { formatINR, rupeesToPaise, withBalance } from "@/lib/money";
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
  effect: string;
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
  banks: { id: string; name: string; balance?: number }[];
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
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <Card className={cx(selected && "hidden lg:block")}>
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="font-display text-2xl">Udhaar</h1>
          <p className="text-sm text-ink-soft">
            {owing === 0 ? (
              "Nobody owes you"
            ) : (
              <>
                {owing === 1 ? "1 person owes" : `${owing} people owe`} you <span className="money text-base font-semibold text-out">{formatINR(total)}</span>
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
                  <span className="shrink-0 text-right">
                    <span className={cx("money block font-semibold", c.due > 0 ? "text-out" : c.due < 0 ? "text-in" : "text-ink-soft")}>
                      {c.due === 0 ? "—" : formatINR(Math.abs(c.due))}
                    </span>
                    <span className="block text-xs text-ink-soft">{c.due > 0 ? "owes you" : c.due < 0 ? "you hold" : "clear"}</span>
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

/** History row label and what it did to the balance, in plain words. */
function historyWords(kind: string, amount: number, service?: string): { what: string; effect: string } {
  if (kind === "reversal") return { what: "Entry reversed", effect: amount > 0 ? "owes more" : "owes less" };
  if (kind === "udhaar_payment") return { what: "Paid back", effect: "paid" };
  if (kind === "udhaar_given") return { what: "Took money", effect: "owes more" };
  return { what: service ? `${service} on udhaar` : "On udhaar", effect: amount > 0 ? "owes more" : "paid" };
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
  banks: { id: string; name: string; balance?: number }[];
  onBack: () => void;
}) {
  const { busy, error, done, run, setError, setDone } = useSubmit();
  const due = customer.due;
  const [formOpen, setFormOpen] = useState(false);
  // Nothing to clear → the form is the only thing to do, so it is always open.
  const showForm = formOpen || due === 0;
  const [action, setAction] = useState<Action>(due > 0 ? "pay" : "take");
  const [amount, setAmount] = useState("");
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
              ...historyWords(t.kind, Number(l.amount), t.services?.name),
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

  /** Saves a payback ("pay") or money given ("take") of `value` paise into/out of `accountId`. */
  const post = async (act: Action, value: number, accountId: string | undefined, how: string, text?: string) => {
    if (!accountId) return setError(how === "Cash" ? "No cash account in this branch" : "No bank/UPI account in this branch");
    const ok = await run(
      () =>
        createClient().rpc(act === "pay" ? "post_udhaar_payment" : "post_udhaar_given", {
          p_client_id: clientId,
          p_branch_id: branchId,
          p_customer_id: customer.id,
          p_account_id: accountId,
          p_amount: value,
          p_note: text?.trim() || undefined,
        }),
      act === "pay" ? `${formatINR(value)} received from ${customer.name} (${how})` : `${formatINR(value)} given to ${customer.name} (${how})`,
    );
    if (ok) {
      setAmount("");
      setNote("");
      setFormOpen(false);
      setClientId(crypto.randomUUID());
    }
  };

  // What the form will do, in counter words, before saving.
  let hint: string | null = null;
  if (action === "pay" && paise) {
    if (due <= 0) hint = "They owe nothing now. This money will be kept as their advance.";
    else if (paise > due) hint = `${formatINR(paise - due)} more than they owe. The extra is kept as their advance.`;
    else if (paise < due) hint = `They will still owe ${formatINR(due - paise)}.`;
    else hint = "All clear after this ✓";
  } else if (action === "take" && paise) {
    if (due < 0 && paise <= -due) hint = paise < -due ? `You will still hold ${formatINR(-due - paise)} of theirs.` : "All clear after this ✓";
    else if (due < 0) hint = `${formatINR(-due)} is their advance, ${formatINR(paise + due)} becomes udhaar.`;
    else hint = `They will owe you ${formatINR(due + paise)}.`;
  }

  const howOptions = [{ id: cashId, name: "Cash", icon: Banknote }, ...banks.map((b) => ({ id: b.id, name: b.name, icon: Smartphone }))];
  const pay = action === "pay";

  return (
    <Card>
      <button type="button" onClick={onBack} className="mb-3 inline-flex items-center gap-1 text-sm text-ink-soft lg:hidden">
        <ArrowLeft size={16} /> All customers
      </button>
      <div className="flex items-center gap-3">
        <Initials name={customer.name} />
        <div className="min-w-0">
          <h2 className="truncate font-display text-2xl">{customer.name}</h2>
          {customer.phone ? (
            <a href={`tel:${customer.phone}`} className="money inline-flex items-center gap-1 text-sm text-accent">
              <Phone size={14} /> {customer.phone}
            </a>
          ) : null}
        </div>
      </div>

      {/* One look: who owes whom, how much. */}
      <div
        className={cx(
          "mt-5 rounded-xl px-5 py-4",
          due > 0 ? "bg-danger-soft" : due < 0 ? "bg-accent-soft" : "border border-rule bg-paper",
        )}
      >
        {due === 0 ? (
          <p className="flex items-center gap-2 text-xl font-semibold">
            <CircleCheck size={22} className="text-in" aria-hidden /> All clear. Nobody owes anything.
          </p>
        ) : (
          <>
            <p className="text-sm text-ink-soft">{due > 0 ? `${customer.name} owes you` : `You are holding ${customer.name}'s money`}</p>
            <p className={cx("money text-4xl font-semibold", due > 0 ? "text-out" : "text-in")}>{formatINR(Math.abs(due))}</p>
          </>
        )}
      </div>

      {due !== 0 ? (
        <div className="mt-4">
          <p className="mb-2 font-medium">{due > 0 ? `Got all ${formatINR(due)} back? Tap how:` : `Gave back all ${formatINR(-due)}? Tap how:`}</p>
          <div className="grid grid-cols-2 gap-2">
            {howOptions.map((o) => (
              <Button
                key={o.name}
                type="button"
                disabled={busy}
                className="min-h-13 min-w-0"
                onClick={() => void post(due > 0 ? "pay" : "take", Math.abs(due), o.id, o.name)}
              >
                <o.icon size={17} aria-hidden className="shrink-0" />
                <span className="truncate">{o.name}</span>
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      {error && !showForm ? <div className="mt-3"><Banner>{error}</Banner></div> : null}
      {done && !showForm ? <div className="mt-3"><Banner tone="info">{done}</Banner></div> : null}

      {!showForm ? (
        <button type="button" onClick={() => setFormOpen(true)} className="mt-4 text-sm text-accent underline-offset-4 hover:underline">
          Other amount, or give more udhaar
        </button>
      ) : (
        <div className="mt-5 flex flex-col gap-3">
          <Segmented
            label="What is happening?"
            options={[
              { value: "take", label: due < 0 ? "Give back" : "Customer takes money", icon: <ArrowUpFromLine size={17} aria-hidden /> },
              { value: "pay", label: "Customer pays", icon: <ArrowDownToLine size={17} aria-hidden /> },
            ]}
            value={action}
            onChange={(a) => {
              setAction(a);
              setError(undefined);
              setDone(undefined);
            }}
          />
          <form
            className="flex flex-col gap-4 rounded-xl border border-rule bg-paper p-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!paise) return setError(pay ? "Enter the amount received" : "Enter the amount given");
              void post(action, paise, mode === "cash" ? cashId : bankId, mode === "cash" ? "Cash" : (banks.find((b) => b.id === bankId)?.name ?? "UPI"), note);
            }}
          >
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
                    {withBalance(b.name, b.balance)}
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
              {busy ? "Saving…" : pay ? "Save payment" : due < 0 ? "Save money given back" : "Save udhaar given"}
            </Button>
          </form>
        </div>
      )}

      <h3 className="mt-7 font-medium">History</h3>
      {history === null ? (
        <p className="py-6 text-sm text-ink-soft">Loading…</p>
      ) : history.length === 0 ? (
        <p className="py-6 text-sm text-ink-soft">Nothing yet.</p>
      ) : (
        <ul className="mt-2 divide-y divide-rule">
          {history.map((h) => (
            <li key={h.id} className="flex items-center justify-between gap-3 py-2.5">
              <span className="flex min-w-0 items-center gap-3">
                <IconTile size="sm" icon={KIND_ICON[h.kind] ?? BookUser} tone={h.amount > 0 ? "out" : "in"} />
                <span className="min-w-0">
                  <span className="block">{h.what}</span>
                  <span className="block truncate text-xs text-ink-soft">
                    {h.when}
                    {h.note ? ` · ${h.note}` : ""}
                  </span>
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className={cx("money block font-medium", h.amount > 0 ? "text-out" : "text-in")}>{formatINR(Math.abs(h.amount))}</span>
                <span className="block text-xs text-ink-soft">{h.effect}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
