"use client";

import { Command } from "cmdk";
import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { searchServices, shouldOfferCreate } from "@/lib/services";
import { flowLabel } from "@/lib/flows";
import { FLOW_ICON, IconTile } from "@/components/icons";
import type { ServiceOption } from "./types";

/**
 * Type to find a service. When no existing name starts with what was typed, the last option offers to create it.
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
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => searchServices(services, query).slice(0, 8), [services, query]);
  const canCreate = shouldOfferCreate(services, query);

  return (
    <Command shouldFilter={false} loop label="Service" className="relative">
      <div className="flex items-center gap-2 rounded-xl border-2 border-rule-strong bg-raised px-3 focus-within:border-accent">
        <Search size={18} className="shrink-0 text-ink-soft" aria-hidden />
        <Command.Input
          ref={inputRef}
          value={query}
          onValueChange={setQuery}
          placeholder="Type a service: xerox, aeps, recharge…"
          className="min-h-13 w-full bg-transparent text-[17px] text-ink placeholder:text-ink-soft/70 focus:outline-none"
          autoFocus
        />
      </div>
      <Command.List className="mt-2 max-h-80 overflow-y-auto rounded-xl border border-rule bg-raised p-1 empty:hidden">
        {matches.map((s) => (
          <Command.Item
            key={s.id}
            value={s.id}
            onSelect={() => {
              onPick(s);
              setQuery("");
            }}
            className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-lg px-2 data-[selected=true]:bg-accent-soft"
          >
            <span className="flex min-w-0 items-center gap-3">
              <IconTile icon={FLOW_ICON[s.flow]} size="sm" />
              <span className="truncate font-medium">{s.name}</span>
            </span>
            <span className="shrink-0 text-xs text-ink-soft">{flowLabel(s.flow)}</span>
          </Command.Item>
        ))}
        {canCreate ? (
          <Command.Item
            value="__create__"
            onSelect={() => onCreate(query.trim())}
            className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 text-accent data-[selected=true]:bg-accent-soft"
          >
            <Plus size={16} />
            <span>
              Create <strong>“{query.trim()}”</strong> as a new service
            </span>
          </Command.Item>
        ) : null}
      </Command.List>
    </Command>
  );
}
