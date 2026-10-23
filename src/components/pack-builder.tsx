"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Plus, X } from "lucide-react";
import { BUSINESS_PACKS, packById, type PackItem } from "@/lib/business-packs";
import { flowUses } from "@/lib/flows";
import { rupeesToPaise } from "@/lib/money";
import { normalizeName } from "@/lib/services";
import { describeRule, type Flow, type Rule } from "@/lib/rules";
import { BusinessGrid } from "./business-grid";
import { PACK_LOOK, ServiceGlyph } from "./icons";
import { Banner, Button, Input, cx } from "./ui";

/** One service/item to save, built from a ready list. */
export interface NewService {
  name: string;
  flow: Flow;
  category: string;
  aliases: string[];
  price: number | null;
  feeRule: Rule | null;
  commissionRule: Rule | null;
  portalCostRule: Rule | null;
}

type Row = { key: string; pack: string; item: PackItem; already: boolean };
type Group = { key: string; title: string; rows: Row[] };
type Extra = { key: string; name: string; price: string };

const rupees = (paise: number | null) => (paise === null ? "" : String(Number((paise / 100).toFixed(2))));

/**
 * Ready-list screens: yes/no questions per business, then one list of everything switched on with usual
 * prices filled in. Services the shop already has are shown as "Already added" and never saved again.
 */
export function PackBuilder({
  firstPack,
  existing,
  onSave,
  onSaved,
  onBack,
  backLabel = "Back",
  saveLabel = "Save & continue",
  footerClassName,
}: {
  firstPack: string;
  existing: string[];
  onSave: (rows: NewService[]) => Promise<{ ok: true } | { ok: false; error: string }>;
  onSaved: () => void;
  onBack?: () => void;
  backLabel?: string;
  saveLabel?: string;
  footerClassName?: string;
}) {
  const [packs, setPacks] = useState<string[]>([firstPack]);
  const [phase, setPhase] = useState<"ask" | "prices">("ask");
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [off, setOff] = useState<Record<string, boolean>>({});
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [extras, setExtras] = useState<Extra[]>(() =>
    packById(firstPack)?.questions.length ? [] : [{ key: crypto.randomUUID(), name: "", price: "" }],
  );
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const yes = (pack: string, qi: number, def: boolean) => answers[`${pack}:${qi}`] ?? def;

  // Everything the answers switch on, each name once; names the shop already has are marked.
  const groups = useMemo(() => {
    const have = new Set(existing.map(normalizeName));
    const seen = new Set<string>();
    const row = (key: string, pack: string, item: PackItem): Row | null => {
      const n = normalizeName(item.name);
      if (seen.has(n)) return null;
      seen.add(n);
      return { key, pack, item, already: have.has(n) };
    };
    const out: Group[] = [];
    for (const id of packs) {
      const p = packById(id);
      if (!p) continue;
      p.questions.forEach((q, qi) => {
        if (!yes(id, qi, q.on)) return;
        const rows = q.items.map((it, ii) => row(`${id}:${qi}:${ii}`, id, it)).filter((r): r is Row => !!r);
        if (rows.length) out.push({ key: `${id}:${qi}`, title: q.ask.replace(/\?$/, ""), rows });
      });
      const base = p.base.map((it, ii) => row(`${id}:b:${ii}`, id, it)).filter((r): r is Row => !!r);
      if (base.length) out.push({ key: `${id}:b`, title: "For anything not on the list", rows: base });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packs, answers, existing]);

  const isOn = (r: Row) => !r.already && !off[r.key];
  const picked = groups.flatMap((g) => g.rows).filter(isOn);
  const count = picked.length + extras.filter((e) => e.name.trim()).length;

  const save = () =>
    start(async () => {
      setError(undefined);
      const rows: NewService[] = [];
      for (const r of picked) {
        const text = prices[r.key] ?? rupees(r.item.price);
        const price = text.trim() === "" ? null : rupeesToPaise(text);
        if (price === null && text.trim() !== "") return setError(`Price of ${r.item.name}: enter rupees, like 40 or 12.50`);
        rows.push({
          name: r.item.name,
          flow: r.item.flow,
          category: r.pack,
          aliases: r.item.aliases,
          price: flowUses(r.item.flow).fee ? null : price,
          feeRule: r.item.fee ?? null,
          commissionRule: null,
          portalCostRule: r.item.portalCost ?? null,
        });
      }
      const have = new Set([...existing, ...rows.map((r) => r.name)].map(normalizeName));
      for (const e of extras) {
        if (!e.name.trim()) continue;
        if (have.has(normalizeName(e.name))) continue;
        const price = e.price.trim() === "" ? null : rupeesToPaise(e.price);
        if (price === null && e.price.trim() !== "") return setError(`Price of ${e.name}: enter rupees, like 40 or 12.50`);
        have.add(normalizeName(e.name));
        rows.push({ name: e.name.trim(), flow: "counter_sale", category: "general", aliases: [], price, feeRule: null, commissionRule: null, portalCostRule: null });
      }
      if (rows.length === 0 && existing.length === 0) return setError("Tick at least one thing you sell.");
      const res = await onSave(rows);
      if (!res.ok) return setError(res.error);
      onSaved();
    });

  const setGroup = (g: Group, on: boolean) => setOff({ ...off, ...Object.fromEntries(g.rows.map((r) => [r.key, !on])) });

  return (
    <div className="flex flex-col gap-6">
      {phase === "ask" ? (
        <>
          {packs.map((id) => {
            const p = packById(id)!;
            const look = PACK_LOOK[id] ?? PACK_LOOK.other;
            return (
              <section key={id} className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <span aria-hidden className={cx("inline-flex size-9 items-center justify-center rounded-xl", look.hue)}>
                    <look.icon size={19} strokeWidth={1.9} />
                  </span>
                  <h3 className="flex-1 text-lg font-semibold">{p.name}</h3>
                  {id !== firstPack ? (
                    <Button variant="ghost" aria-label={`Remove ${p.name}`} onClick={() => setPacks(packs.filter((x) => x !== id))}>
                      <X size={16} />
                    </Button>
                  ) : null}
                </div>
                {p.questions.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-rule-strong p-4 text-ink-soft">
                    No questions here. On the next screen, type what you sell and the price.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {p.questions.map((q, qi) => {
                      const on = yes(id, qi, q.on);
                      const names = q.items.map((i) => i.name);
                      return (
                        <li key={qi} className="flex flex-col gap-3 rounded-2xl border border-rule bg-raised p-4 sm:flex-row sm:items-center">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium">{q.ask}</p>
                            <p className="text-sm text-ink-soft">
                              {names.slice(0, 3).join(", ")}
                              {names.length > 3 ? ` and ${names.length - 3} more` : ""}
                            </p>
                          </div>
                          <div role="radiogroup" aria-label={q.ask} className="grid shrink-0 grid-cols-2 gap-2 sm:w-44">
                            {[true, false].map((v) => (
                              <button
                                key={String(v)}
                                type="button"
                                role="radio"
                                aria-checked={on === v}
                                onClick={() => setAnswers({ ...answers, [`${id}:${qi}`]: v })}
                                className={cx(
                                  "min-h-11 rounded-lg border text-[15px] font-semibold transition",
                                  on === v ? "border-accent bg-accent text-accent-ink" : "border-rule-strong bg-paper text-ink-soft hover:border-ink-soft",
                                )}
                              >
                                {v ? "Yes" : "No"}
                              </button>
                            ))}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
          {adding ? (
            <section className="flex flex-col gap-3 rounded-2xl border border-dashed border-rule-strong p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">What else do you do?</h3>
                <Button variant="ghost" onClick={() => setAdding(false)}>
                  Cancel
                </Button>
              </div>
              <BusinessGrid
                hide={[...packs, "other"]}
                onPick={(id) => {
                  setPacks([...packs, id]);
                  setAdding(false);
                }}
              />
            </section>
          ) : packs.length < BUSINESS_PACKS.length - 1 ? (
            <Button variant="secondary" className="self-start" onClick={() => setAdding(true)}>
              <Plus size={16} /> Also do something else?
            </Button>
          ) : null}
        </>
      ) : (
        <>
          <p className="text-ink-soft">Usual prices are filled in. Change only what's different, and untick what you don't sell.</p>
          {groups.map((g) => {
            const free = g.rows.filter((r) => !r.already);
            const allOn = free.every((r) => !off[r.key]);
            return (
              <section key={g.key}>
                <div className="flex items-center justify-between gap-3 border-b border-rule pb-1.5">
                  <h3 className="text-xs font-semibold tracking-wide text-ink-soft uppercase">{g.title}</h3>
                  {free.length > 1 ? (
                    <button type="button" onClick={() => setGroup(g, !allOn)} className="min-h-9 px-1 text-sm font-medium text-accent">
                      {allOn ? "Untick all" : "Tick all"}
                    </button>
                  ) : null}
                </div>
                <ul className="divide-y divide-rule">
                  {g.rows.map((r) => {
                    const on = isOn(r);
                    const uses = flowUses(r.item.flow);
                    return (
                      <li key={r.key} className={cx("flex min-h-14 items-center gap-3 py-1.5", !on && "opacity-55")}>
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={on}
                          aria-label={r.item.name}
                          disabled={r.already}
                          onClick={() => setOff({ ...off, [r.key]: on })}
                          className={cx(
                            "flex size-7 shrink-0 items-center justify-center rounded-lg border-2 transition",
                            on ? "border-accent bg-accent text-accent-ink" : "border-rule-strong bg-raised",
                          )}
                        >
                          {on ? <Check size={16} strokeWidth={3} /> : null}
                        </button>
                        <ServiceGlyph name={r.item.name} flow={r.item.flow} size="sm" />
                        <span className="min-w-0 flex-1 leading-tight">{r.item.name}</span>
                        {r.already ? (
                          <span className="shrink-0 text-xs text-ink-soft">Already added</span>
                        ) : uses.fee ? (
                          <span className="w-28 shrink-0 text-right text-xs text-ink-soft">
                            {r.item.fee ? `Your charge ${describeRule(r.item.fee)}` : "Charge: set later"}
                          </span>
                        ) : (
                          <label className="flex h-11 w-28 shrink-0 items-center gap-1 rounded-lg border border-rule-strong bg-raised px-2.5 focus-within:border-accent">
                            <span className="text-ink-soft">₹</span>
                            <input
                              inputMode="decimal"
                              aria-label={`Price of ${r.item.name}`}
                              placeholder="—"
                              disabled={!on}
                              value={prices[r.key] ?? rupees(r.item.price)}
                              onChange={(e) => setPrices({ ...prices, [r.key]: e.target.value })}
                              className="money w-full min-w-0 bg-transparent text-right text-[16px] focus:outline-none"
                            />
                          </label>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
          <section>
            <h3 className="border-b border-rule pb-1.5 text-xs font-semibold tracking-wide text-ink-soft uppercase">Your own</h3>
            <ul className="flex flex-col gap-2 pt-2">
              {extras.map((e, i) => (
                <li key={e.key} className="flex items-center gap-2">
                  <Input
                    aria-label="Name"
                    placeholder="Name, like Gift wrap"
                    value={e.name}
                    onChange={(ev) => setExtras(extras.map((x, j) => (j === i ? { ...x, name: ev.target.value } : x)))}
                  />
                  <label className="flex h-11 w-28 shrink-0 items-center gap-1 rounded-lg border border-rule-strong bg-raised px-2.5 focus-within:border-accent">
                    <span className="text-ink-soft">₹</span>
                    <input
                      inputMode="decimal"
                      aria-label="Price"
                      placeholder="—"
                      value={e.price}
                      onChange={(ev) => setExtras(extras.map((x, j) => (j === i ? { ...x, price: ev.target.value } : x)))}
                      className="money w-full min-w-0 bg-transparent text-right text-[16px] focus:outline-none"
                    />
                  </label>
                  <Button variant="ghost" aria-label="Remove" onClick={() => setExtras(extras.filter((_, j) => j !== i))}>
                    <X size={16} />
                  </Button>
                </li>
              ))}
            </ul>
            <Button variant="secondary" className="mt-2" onClick={() => setExtras([...extras, { key: crypto.randomUUID(), name: "", price: "" }])}>
              <Plus size={16} /> Add something else you sell
            </Button>
          </section>
        </>
      )}

      {error ? <Banner>{error}</Banner> : null}
      <div className={cx("sticky bottom-0 -mx-1 flex items-center gap-3 border-t border-rule bg-paper/95 px-1 py-3 backdrop-blur", footerClassName)}>
        {phase === "prices" ? (
          <Button variant="ghost" onClick={() => setPhase("ask")}>
            Back
          </Button>
        ) : onBack ? (
          <Button variant="ghost" onClick={onBack}>
            {backLabel}
          </Button>
        ) : null}
        <span className="flex-1 text-right text-sm text-ink-soft">{count} ready</span>
        {phase === "ask" ? (
          <Button onClick={() => (setPhase("prices"), window.scrollTo({ top: 0 }))}>Next: prices</Button>
        ) : (
          <Button onClick={save} disabled={pending}>
            {pending ? "Saving…" : saveLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
