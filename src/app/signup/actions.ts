"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface SignupState {
  error?: string;
  fields?: { name: string; shopName: string; email: string };
}

/** New owner: create a confirmed account (no email sent), sign in, create the shop. */
export async function signUpOwner(_prev: SignupState, form: FormData): Promise<SignupState> {
  const name = String(form.get("name") ?? "").trim();
  const shopName = String(form.get("shopName") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  const fields = { name, shopName, email };

  if (!name || !shopName || !email) return { error: "Fill in every field.", fields };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email.", fields };
  if (password.length < 8) return { error: "Password must be at least 8 characters.", fields };
  if (password !== confirm) return { error: "Passwords do not match.", fields };

  const admin = createAdminClient();
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name } });
  if (created.error) {
    const taken = /already|registered|exists/i.test(created.error.message);
    return { error: taken ? "This email already has an account. Log in instead." : created.error.message, fields };
  }

  const supabase = await createClient();
  const signIn = await supabase.auth.signInWithPassword({ email, password });
  if (signIn.error) return { error: signIn.error.message, fields };

  const shop = await supabase.rpc("create_shop", { p_shop_name: shopName, p_owner_name: name });
  if (shop.error) return { error: shop.error.message, fields };
  redirect("/setup");
}

/** Signed-in user who has no shop yet (e.g. signup interrupted after account creation). */
export async function createShopOnly(_prev: SignupState, form: FormData): Promise<SignupState> {
  const name = String(form.get("name") ?? "").trim();
  const shopName = String(form.get("shopName") ?? "").trim();
  const fields = { name, shopName, email: "" };
  if (!name || !shopName) return { error: "Fill in every field.", fields };
  const supabase = await createClient();
  const shop = await supabase.rpc("create_shop", { p_shop_name: shopName, p_owner_name: name });
  if (shop.error) return { error: shop.error.message, fields };
  redirect("/setup");
}
