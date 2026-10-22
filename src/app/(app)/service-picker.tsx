"use client";

import { Command } from "cmdk";
import { useEffect, useMemo, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { searchServices, shouldOfferCreate } from "@/lib/services";
import { ServiceGlyph } from "@/components/icons";
import type { ServiceOption } from "./types";

/** Desktop (mouse) only: focusing on a phone pops the keyboard over the tiles. */
const canAutoFocus = () => typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches;

/**
 * Every service as a big picture tile (like a portal's service grid), with a search box on top.
 * Typing filters the tiles; when nothing starts with what was typed, the last tile offers to create it.
 */
export function ServicePicker({
  services,
  onPick,
  onCreate,
  inputRef,
}: {
  services: ServiceOption[];
  onPick: (s: ServiceOption) => void;
  onCreate: (name: string) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => searchServices(services, query), [services, query]);
  const canCreate = shouldOfferCreate(services, query);

  useEffect(() => {
    if (canAutoFocus()) inputRef?.current?.focus();
  }, [inputRef]);

  return (
    <Command shouldFilter={false} loop label="Service">
      <div className="flex items-center gap-2 rounded-xl border-2 border-rule-strong bg-raised px-3 focus-within:border-accent">
        <Search size={18} className="shrink-0 text-ink-soft" aria-hidden />
        <Command.Input
          ref={inputRef}
          value={query}
          onValueChange={setQuery}
          placeholder="Search a service: xerox, aeps, recharge…"
          className="min-h-12 w-full bg-transparent text-[17px] text-ink placeholder:text-ink-soft/70 focus:outline-none"
        />
        {query ? (
          <button type="button" aria-label="Clear search" onClick={() => setQuery("")} className="p-1 text-ink-soft hover:text-ink">
            <X size={18} />
          </button>
        ) : null}
      </div>
      <Command.List className="mt-3">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {matches.map((s) => (
            <Command.Item
              key={s.id}
              value={s.id}
              onSelect={() => {
                onPick(s);
                setQuery("");
              }}
              className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-rule px-1.5 py-2.5 text-center transition hover:border-accent data-[selected=true]:border-accent data-[selected=true]:bg-accent-soft"
            >
              <ServiceGlyph name={s.name} flow={s.flow} size="lg" />
              <span className="line-clamp-2 text-[13px] leading-tight font-medium">{s.name}</span>
            </Command.Item>
          ))}
          {canCreate ? (
            <Command.Item
              value="__create__"
              onSelect={() => onCreate(query.trim())}
              className="col-span-3 flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-rule-strong px-3 text-accent data-[selected=true]:bg-accent-soft sm:col-span-4"
            >
              <Plus size={16} />
              <span>
                Create <strong>“{query.trim()}”</strong> as a new service
              </span>
            </Command.Item>
          ) : null}
        </div>
        {matches.length === 0 && !canCreate ? <p className="py-6 text-center text-sm text-ink-soft">No service found.</p> : null}
      </Command.List>
    </Command>
  );
}
