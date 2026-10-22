"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { Banner, Button, Card, Field, Input } from "@/components/ui";
import { IconTile } from "@/components/icons";
import { createClient } from "@/lib/supabase/client";
import { useSubmit } from "@/lib/use-submit";

/** Signed-in user sets a new password for their own login. */
export function PasswordForm({ fromEmail }: { fromEmail: boolean }) {
  const { busy, error, done, run, setError } = useSubmit();
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");

  const submit = async () => {
    if (password.length < 6) return setError("Password: at least 6 characters");
    if (password !== again) return setError("The two passwords are not the same");
    const ok = await run(() => createClient().auth.updateUser({ password }), "Password changed. Use the new one next time you log in.");
    if (ok) {
      setPassword("");
      setAgain("");
    }
  };

  return (
    <Card>
      <div className="flex items-center gap-3">
        <IconTile icon={KeyRound} tone="accent" />
        <h1 className="font-display text-2xl">{fromEmail ? "Set a new password" : "Change password"}</h1>
      </div>
      <form
        className="mt-5 flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Field label="New password" htmlFor="pw-new">
          <Input id="pw-new" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        </Field>
        <Field label="Type it again" htmlFor="pw-again">
          <Input id="pw-again" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
        </Field>
        {error ? <Banner>{/same.*(old|previous)|different from/i.test(error) ? "Pick a password different from the old one" : error}</Banner> : null}
        {done ? <Banner tone="info">{done}</Banner> : null}
        <Button type="submit" disabled={busy} className="min-h-12">
          {busy ? "Saving…" : "Save new password"}
        </Button>
      </form>
    </Card>
  );
}
