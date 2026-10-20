"use client";

import { useActionState } from "react";
import { Banner, Button, Field, Input } from "@/components/ui";
import { createShopOnly, signUpOwner, type SignupState } from "./actions";

export function SignupForm({ shopOnly }: { shopOnly: boolean }) {
  const [state, action, pending] = useActionState<SignupState, FormData>(shopOnly ? createShopOnly : signUpOwner, {});
  const f = state.fields;
  return (
    <form action={action} className="flex flex-col gap-5">
      {state.error ? <Banner>{state.error}</Banner> : null}
      <Field label="Your name" htmlFor="name">
        <Input id="name" name="name" autoComplete="name" defaultValue={f?.name} autoFocus required />
      </Field>
      <Field label="Shop name" htmlFor="shopName" hint="As customers know it, e.g. Sai Net Center">
        <Input id="shopName" name="shopName" defaultValue={f?.shopName} required />
      </Field>
      {shopOnly ? null : (
        <>
          <Field label="Email" htmlFor="email">
            <Input id="email" name="email" type="email" autoComplete="email" defaultValue={f?.email} required />
          </Field>
          <Field label="Password" htmlFor="password" hint="At least 8 characters">
            <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
          </Field>
          <Field label="Confirm password" htmlFor="confirm">
            <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
          </Field>
        </>
      )}
      <Button type="submit" disabled={pending} className="mt-2 w-full">
        {pending ? "Creating…" : shopOnly ? "Create shop" : "Create shop account"}
      </Button>
    </form>
  );
}
