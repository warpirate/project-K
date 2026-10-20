"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginIdToEmail } from "@/lib/staff";

export interface LoginState {
  error?: string;
  loginId?: string;
}

export async function logIn(_prev: LoginState, form: FormData): Promise<LoginState> {
  const loginId = String(form.get("loginId") ?? "");
  const password = String(form.get("password") ?? "");
  if (!loginId.trim() || !password) return { error: "Enter your login and password.", loginId };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: loginIdToEmail(loginId), password });
  if (error) return { error: "Wrong login or password.", loginId };
  redirect("/");
}

export async function logOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
