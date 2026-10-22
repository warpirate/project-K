"use client";

import { useActionState } from "react";
import { MailCheck } from "lucide-react";
import { Banner, Button, Field, Input } from "@/components/ui";
import { sendResetLink, type ForgotState } from "./actions";

export function ForgotForm() {
  const [state, action, pending] = useActionState<ForgotState, FormData>(sendResetLink, {});
  if (state.sent) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-xl border border-accent bg-accent-soft p-5">
        <MailCheck size={22} className="text-accent" aria-hidden />
        <p className="font-medium">Check your email</p>
        <p className="text-sm text-ink-soft">
          If <strong>{state.email}</strong> has a shop account, a link to set a new password is on its way. Open it on this same phone or
          computer. Check spam if you don’t see it.
        </p>
      </div>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-5">
      {state.error ? <Banner>{state.error}</Banner> : null}
      <Field label="Your email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" autoCapitalize="none" defaultValue={state.email} autoFocus required />
      </Field>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Sending…" : "Send me a link"}
      </Button>
    </form>
  );
}
