"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { BRANCH_COOKIE, getAppContext } from "@/lib/session";

/** Owner switches the branch they are working in. */
export async function setBranch(form: FormData) {
  const ctx = await getAppContext();
  const branchId = String(form.get("branchId") ?? "");
  if (!ctx.isOwner || !ctx.branches.some((b) => b.id === branchId)) return;
  (await cookies()).set(BRANCH_COOKIE, branchId, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}
