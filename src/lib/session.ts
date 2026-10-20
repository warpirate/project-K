import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const BRANCH_COOKIE = "pk_branch";

export interface Branch {
  id: string;
  name: string;
}

export interface AppContext {
  userId: string;
  profile: { name: string; role: "owner" | "staff"; shop_id: string; branch_id: string | null };
  shopName: string;
  isOwner: boolean;
  branches: Branch[];
  branchId: string | null;
}

/** Signed-in user's profile, branches and current branch. Redirects when not signed in or no shop yet. */
export const getAppContext = cache(async (): Promise<AppContext> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, role, shop_id, branch_id")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (!profile) redirect("/signup?step=shop");

  const [{ data: shop }, { data: branches }] = await Promise.all([
    supabase.from("shops").select("name").eq("id", profile.shop_id).single(),
    supabase.from("branches").select("id, name").order("name"),
  ]);

  const isOwner = profile.role === "owner";
  const list = branches ?? [];
  let branchId: string | null = profile.branch_id;
  if (isOwner) {
    const wanted = (await cookies()).get(BRANCH_COOKIE)?.value;
    branchId = list.find((b) => b.id === wanted)?.id ?? list[0]?.id ?? null;
  }

  return { userId: auth.user.id, profile, shopName: shop?.name ?? "", isOwner, branches: list, branchId };
});
