"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Banner, Card } from "@/components/ui";
import { BusinessGrid } from "@/components/business-grid";
import { saveBusinessType } from "./actions";

export function BusinessStep({ current }: { current: string | null }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const pick = (id: string) =>
    start(async () => {
      setError(undefined);
      const res = await saveBusinessType(id);
      if (!res.ok) return setError(res.error);
      router.push("/setup?step=branches");
    });

  return (
    <Card>
      <h2 className="font-display text-2xl">What's your business?</h2>
      <p className="mt-1 text-ink-soft">Pick one. We'll fill in your services and usual prices for you. Do more than one thing? You can add more later.</p>
      {error ? <div className="mt-4"><Banner>{error}</Banner></div> : null}
      <div className={pending ? "pointer-events-none mt-6 opacity-60" : "mt-6"}>
        <BusinessGrid onPick={pick} picked={current} />
      </div>
    </Card>
  );
}
