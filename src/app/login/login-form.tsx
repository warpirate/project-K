"use client";

import { useActionState } from "react";
import { Banner, Button, Field, Input } from "@/components/ui";
import { logIn, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(logIn, {});
  return (
    <form action={action} className="flex flex-col gap-5">
      {state.error ? <Banner>{state.error}</Banner> : null}
      <Field label="Email or username" htmlFor="loginId">
        <Input
          id="loginId"
          name="loginId"
          autoComplete="username"
          autoCapitalize="none"
          defaultValue={state.loginId}
          autoFocus
          required
        />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <Button type="submit" disabled={pending} className="mt-2 w-full">
        {pending ? "Logging in…" : "Log in"}
      </Button>
    </form>
  );
}
