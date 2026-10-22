"use client";

import { useState } from "react";
import { ArrowLeftRight, Receipt, Scale } from "lucide-react";
import { Banner, Button, Card, Field, Input, Select, Tabs } from "@/components/ui";
import { formatINR, rupeesToPaise } from "@/lib/money";
import { createClient } from "@/lib/supabase/client";
import { useSubmit } from "@/lib/use-submit";

interface Acct {
  account_id: string;
  branch_id: string;
  branchName: string;
  name: string;
  type: "cash" | "wallet" | "bank";
  balance: number;
}

type Tab = "expense" | "move" | "fix";

export function MoneyForms({ branchId, isOwner, here, all }: { branchId: string; isOwner: boolean; here: Omit<Acct, "branchName">[]; all: Acct[] }) {
  const [tab, setTab] = useState<Tab>("expense");
  const tabs = [
    { value: "expense" as const, label: "Expense", icon: <Receipt size={16} aria-hidden /> },
    { value: "move" as const, label: "Move money", icon: <ArrowLeftRight size={16} aria-hidden /> },
    ...(isOwner ? [{ value: "fix" as const, label: "Fix a balance", icon: <Scale size={16} aria-hidden /> }] : []),
  ];
  return (
    <Card>
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      <div className="mt-5" key={tab}>
        {tab === "expense" && <ExpenseForm branchId={branchId} accounts={here} />}
        {tab === "move" && <MoveForm branchId={branchId} isOwner={isOwner} all={all} />}
        {tab === "fix" && <FixForm accounts={here} />}
      </div>
    </Card>
  );
}

const cashFirst = (list: { account_id: string; type: string }[]) => list.find((a) => a.type === "cash")?.account_id ?? list[0]?.account_id ?? "";

function ExpenseForm({ branchId, accounts }: { branchId: string; accounts: Omit<Acct, "branchName">[] }) {
  const { busy, error, done, run, setError } = useSubmit();
  const [amount, setAmount] = useState("");
  const [from, setFrom] = useState(cashFirst(accounts));
  const [note, setNote] = useState("");
  const [clientId, setClientId] = useState(() => crypto.randomUUID());

  const submit = async () => {
    const paise = rupeesToPaise(amount);
    if (!paise) return setError("Enter the amount, like 50");
    const ok = await run(
      () =>
        createClient().rpc("post_expense", {
          p_client_id: clientId,
          p_branch_id: branchId,
          p_account_id: from,
          p_amount: paise,
          p_note: note.trim() || undefined,
        }),
      `Expense ${formatINR(paise)} saved`,
    );
    if (ok) {
      setAmount("");
      setNote("");
      setClientId(crypto.randomUUID());
    }
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <p className="text-sm text-ink-soft">Money spent by the shop: tea, paper, rent, current bill…</p>
      <Field label="Amount (₹)" htmlFor="exp-amount">
        <Input id="exp-amount" inputMode="decimal" className="money min-h-13 text-2xl" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Field>
      {accounts.length > 1 ? (
        <Field label="Paid from" htmlFor="exp-from">
          <Select id="exp-from" value={from} onChange={(e) => setFrom(e.target.value)}>
            {accounts.map((a) => (
              <option key={a.account_id} value={a.account_id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      <Field label="What for? (optional)" htmlFor="exp-note">
        <Input id="exp-note" placeholder="e.g. tea, A4 paper" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      {error ? <Banner>{error}</Banner> : null}
      {done ? <Banner tone="info">{done}</Banner> : null}
      <Button type="submit" disabled={busy} className="min-h-12">
        {busy ? "Saving…" : "Save expense"}
      </Button>
    </form>
  );
}

function MoveForm({ branchId, isOwner, all }: { branchId: string; isOwner: boolean; all: Acct[] }) {
  const { busy, error, done, run, setError } = useSubmit();
  const here = all.filter((a) => a.branch_id === branchId);
  const targets = isOwner ? all : here;
  const [from, setFrom] = useState(cashFirst(here));
  const [to, setTo] = useState(here.find((a) => a.type === "bank")?.account_id ?? here.find((a) => a.account_id !== cashFirst(here))?.account_id ?? "");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [clientId, setClientId] = useState(() => crypto.randomUUID());
  const name = (id: string) => all.find((a) => a.account_id === id)?.name ?? "";

  const submit = async () => {
    const paise = rupeesToPaise(amount);
    if (!paise) return setError("Enter the amount");
    if (from === to) return setError("Pick two different accounts");
    const ok = await run(
      () =>
        createClient().rpc("post_transfer", {
          p_client_id: clientId,
          p_from_account_id: from,
          p_to_account_id: to,
          p_amount: paise,
          p_note: note.trim() || undefined,
        }),
      `Moved ${formatINR(paise)} from ${name(from)} to ${name(to)}`,
    );
    if (ok) {
      setAmount("");
      setNote("");
      setClientId(crypto.randomUUID());
    }
  };

  const options = (list: Acct[]) =>
    isOwner
      ? [...new Set(list.map((a) => a.branchName))].map((b) => (
          <optgroup key={b} label={b}>
            {list
              .filter((a) => a.branchName === b)
              .map((a) => (
                <option key={a.account_id} value={a.account_id}>
                  {a.name}
                </option>
              ))}
          </optgroup>
        ))
      : list.map((a) => (
          <option key={a.account_id} value={a.account_id}>
            {a.name}
          </option>
        ));

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <p className="text-sm text-ink-soft">
        Money moving between your own places: cash deposited in bank, wallet top-up, cash taken to the other branch. Not
        profit or loss.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Take from" htmlFor="mv-from">
          <Select id="mv-from" value={from} onChange={(e) => setFrom(e.target.value)}>
            {options(here)}
          </Select>
        </Field>
        <Field label="Put into" htmlFor="mv-to">
          <Select id="mv-to" value={to} onChange={(e) => setTo(e.target.value)}>
            {options(targets)}
          </Select>
        </Field>
      </div>
      <Field label="Amount (₹)" htmlFor="mv-amount">
        <Input id="mv-amount" inputMode="decimal" className="money min-h-13 text-2xl" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Field>
      <Field label="Note (optional)" htmlFor="mv-note">
        <Input id="mv-note" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      {error ? <Banner>{error}</Banner> : null}
      {done ? <Banner tone="info">{done}</Banner> : null}
      <Button type="submit" disabled={busy} className="min-h-12">
        {busy ? "Saving…" : "Move money"}
      </Button>
    </form>
  );
}

function FixForm({ accounts }: { accounts: Omit<Acct, "branchName">[] }) {
  const { busy, error, done, run, setError } = useSubmit();
  const [accountId, setAccountId] = useState(accounts[0]?.account_id ?? "");
  const [real, setReal] = useState("");
  const [clientId, setClientId] = useState(() => crypto.randomUUID());
  const current = accounts.find((a) => a.account_id === accountId)?.balance ?? 0;
  const realPaise = rupeesToPaise(real);
  const diff = realPaise === null ? null : realPaise - current;

  const submit = async () => {
    if (diff === null) return setError("Enter the real balance, like 12500");
    if (diff === 0) return setError("Already correct, nothing to fix");
    const ok = await run(
      () => createClient().rpc("post_opening_balance", { p_client_id: clientId, p_account_id: accountId, p_amount: diff, p_note: "Balance correction" }),
      `Balance set to ${formatINR(realPaise!)}`,
    );
    if (ok) {
      setReal("");
      setClientId(crypto.randomUUID());
    }
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <p className="text-sm text-ink-soft">
        Count or check the real money, type it here. The difference is saved as a correction (not profit).
      </p>
      <Field label="Account" htmlFor="fx-acct">
        <Select id="fx-acct" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          {accounts.map((a) => (
            <option key={a.account_id} value={a.account_id}>
              {a.name} (now {formatINR(a.balance)})
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Real balance now (₹)" htmlFor="fx-real">
        <Input id="fx-real" inputMode="decimal" className="money min-h-13 text-2xl" placeholder="0" value={real} onChange={(e) => setReal(e.target.value)} />
      </Field>
      {diff !== null && diff !== 0 ? (
        <p className="text-sm">
          Correction: <span className={`money font-semibold ${diff < 0 ? "text-out" : "text-in"}`}>{diff > 0 ? "+" : ""}{formatINR(diff)}</span>
        </p>
      ) : null}
      {error ? <Banner>{error}</Banner> : null}
      {done ? <Banner tone="info">{done}</Banner> : null}
      <Button type="submit" disabled={busy} className="min-h-12">
        {busy ? "Saving…" : "Save correct balance"}
      </Button>
    </form>
  );
}
