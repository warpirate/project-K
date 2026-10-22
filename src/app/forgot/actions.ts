"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export interface ForgotState {
  sent?: boolean;
  error?: string;
  email?: string;
}

/** Emails the owner a link to set a new password. Staff passwords are reset by the owner. */
export async function sendResetLink(_prev: ForgotState, form: FormData): Promise<ForgotState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "Enter your email." };
  if (!email.includes("@")) return { error: "Staff: ask the owner to set a new password in Settings → Staff.", email };

  const h = await headers();
  const origin = h.get("origin") ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/confirm?next=/password` });
  // Same answer whether or not the email has an account, so nobody can test which emails exist.
  if (error && !/not found|rate/i.test(error.message)) return { error: error.message, email };
  if (error && /rate/i.test(error.message)) return { error: "Too many tries. Wait a few minutes and try again.", email };
  return { sent: true, email };
}
