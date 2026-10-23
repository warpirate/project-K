"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui";
import { BusinessGrid } from "@/components/business-grid";
import { PackBuilder } from "@/components/pack-builder";
import { saveServices } from "@/app/setup/actions";
import { READY_LIST_SEEN } from "../../ready-list-banner";

export function ReadyList({ businessType, existingNames }: { businessType: string | null; existingNames: string[] }) {
  const router = useRouter();
  const [pack, setPack] = useState<string | null>(null);

  // Opening this page is enough to stop the "ready price lists" banner on New entry.
  useEffect(() => {
    try {
      localStorage.setItem(READY_LIST_SEEN, "1");
    } catch {}
  }, []);

  return (
    <Card>
      <h1 className="font-display text-2xl">Add from a ready list</h1>
      {pack === null ? (
        <>
          <p className="mt-1 mb-6 text-ink-soft">
            Pick a business. Things you already have are skipped, and nothing you have is changed.
          </p>
          <BusinessGrid onPick={setPack} picked={businessType} hide={["other"]} />
          <p className="mt-3 text-sm text-ink-soft">Your business is highlighted. Pick another one too if you also do that.</p>
        </>
      ) : (
        <>
          <p className="mt-1 mb-6 text-ink-soft">Answer yes or no, then check the prices. Only the ticked new ones are added.</p>
          <PackBuilder
            key={pack}
            firstPack={pack}
            existing={existingNames}
            onSave={saveServices}
            onSaved={() => {
              router.push("/settings?tab=services");
              router.refresh();
            }}
            onBack={() => setPack(null)}
            backLabel="Other list"
            saveLabel="Add these"
            footerClassName="bottom-[calc(60px+env(safe-area-inset-bottom))] md:bottom-0"
          />
        </>
      )}
    </Card>
  );
}
