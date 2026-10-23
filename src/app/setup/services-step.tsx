"use client";

import { useRouter } from "next/navigation";
import { Card } from "@/components/ui";
import { PackBuilder } from "@/components/pack-builder";
import { packById } from "@/lib/business-packs";
import { saveServices } from "./actions";

export function ServicesStep({ businessType, existingNames }: { businessType: string; existingNames: string[] }) {
  const router = useRouter();
  const pack = packById(businessType) ?? packById("other")!;
  return (
    <Card>
      <h2 className="font-display text-2xl">What do you sell?</h2>
      <p className="mt-1 mb-6 text-ink-soft">
        A few yes/no questions about your {pack.id === "other" ? "shop" : pack.name.toLowerCase()}, then check the prices. You can change
        anything later in Settings.
      </p>
      <PackBuilder
        firstPack={pack.id}
        existing={existingNames}
        onSave={saveServices}
        onSaved={() => router.push("/setup?step=staff")}
        onBack={() => router.push("/setup?step=accounts")}
      />
    </Card>
  );
}
