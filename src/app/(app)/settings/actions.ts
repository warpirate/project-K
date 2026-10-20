"use server";

import { revalidatePath } from "next/cache";
import { getAppContext } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export type SimpleResult = { ok: true } | { ok: false; error: string };

/** Owner sets a new password for one of their staff. */
export async function resetStaffPassword(userId: string, password: string): Promise<SimpleResult> {
  const ctx = await getAppContext();
  if (!ctx.isOwner) return { ok: false, error: "Only the owner can do this" };
  if (password.length < 6) return { ok: false, error: "Password: at least 6 characters" };
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("shop_id, role").eq("user_id", userId).maybeSingle();
  if (!profile || profile.shop_id !== ctx.profile.shop_id || profile.role !== "staff") return { ok: false, error: "Staff member not found" };
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}
