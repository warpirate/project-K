"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Result = { error: { message: string } | null };

/** Plain words for database/network errors shown at the counter. */
export function friendlyError(message: string): string {
  if (/fetch|network|Failed to fetch/i.test(message)) return "Not saved: check the internet and try again.";
  if (/no access/i.test(message)) return "You can't do this for that branch.";
  if (/owner only/i.test(message)) return "Only the owner can do this.";
  if (/already closed/i.test(message)) return "This day is already closed for this branch.";
  if (/must be positive|must not be zero/i.test(message)) return "Enter an amount more than zero.";
  if (/same account/i.test(message)) return "Pick two different accounts.";
  return message;
}

/** Runs a Supabase call, tracks busy/error/success, refreshes server data on success. */
export function useSubmit() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<string>();

  const run = async (call: () => PromiseLike<Result>, successText: string): Promise<boolean> => {
    setBusy(true);
    setError(undefined);
    setDone(undefined);
    try {
      const { error: err } = await call();
      if (err) {
        setError(friendlyError(err.message));
        return false;
      }
      setDone(successText);
      router.refresh();
      return true;
    } catch (e) {
      setError(friendlyError((e as Error).message));
      return false;
    } finally {
      setBusy(false);
    }
  };

  return { busy, error, done, run, setError, setDone };
}
