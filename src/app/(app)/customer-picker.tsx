"use client";

import { useMemo, useState } from "react";
import { UserPlus, X } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { normalizeName } from "@/lib/services";
import { createClient } from "@/lib/supabase/client";
import type { CustomerOption } from "./types";

/** Search customers by name or phone; add a new one inline. */
export function CustomerPicker({
  customers,
  shopId,
  value,
  onChange,
  onAdded,
}: {
  customers: CustomerOption[];
  shopId: string;
  value: CustomerOption | null;
  onChange: (c: CustomerOption | null) => void;
  onAdded: (c: CustomerOption) => void;
}) {
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string>();

  const matches = useMemo(() => {
    const n = normalizeName(q);
    if (!n) return [];
    return customers.filter((c) => normalizeName(c.name).includes(n) || (c.phone ?? "").includes(n.replace(/\s/g, ""))).slice(0, 6);
  }, [customers, q]);

  if (value) {
    return (
      <div className="flex min-h-11 items-center justify-between rounded-lg border border-accent bg-accent-soft px-3">
        <span>
          <strong>{value.name}</strong> {value.phone ? <span className="money text-sm text-ink-soft">{value.phone}</span> : null}
        </span>
        <button type="button" onClick={() => onChange(null)} aria-label="Remove customer" className="p-1 text-ink-soft hover:text-ink">
          <X size={16} />
        </button>
      </div>
    );
  }

  const add = async () => {
    setError(undefined);
    const name = q.trim();
    if (!name) return setError("Type the customer name first");
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from("customers")
      .insert({ shop_id: shopId, name, phone: phone.trim() || null })
      .select("id, name, phone")
      .single();
    if (err) return setError(/duplicate|unique/i.test(err.message) ? "A customer with this phone already exists" : err.message);
    onAdded(data);
    onChange(data);
    setQ("");
    setPhone("");
    setAdding(false);
  };

  return (
    <div className="flex flex-col gap-2">
      <Input placeholder="Customer name or phone (optional)" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Customer" />
      {matches.length ? (
        <ul className="rounded-lg border border-rule bg-raised p-1">
          {matches.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(c);
                  setQ("");
                }}
                className="flex min-h-10 w-full items-center justify-between rounded-md px-3 text-left hover:bg-accent-soft"
              >
                <span>{c.name}</span>
                <span className="money text-sm text-ink-soft">{c.phone}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {q.trim() && !adding ? (
        <Button type="button" variant="ghost" className="self-start" onClick={() => setAdding(true)}>
          <UserPlus size={16} /> Add “{q.trim()}” as new customer
        </Button>
      ) : null}
      {adding ? (
        <div className="flex gap-2">
          <Input placeholder="Phone (optional)" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} aria-label="Phone" />
          <Button type="button" variant="secondary" onClick={() => void add()}>
            Add
          </Button>
        </div>
      ) : null}
      {error ? <p className="text-sm text-out">{error}</p> : null}
    </div>
  );
}
