import { redirect } from "next/navigation";
import { getAppContext } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { ReadyList } from "./ready-list";

/** Owner adds services from a ready list after setup (existing shops, or a second line of business). */
export default async function ReadyListPage() {
  const ctx = await getAppContext();
  if (!ctx.isOwner) redirect("/");
  const supabase = await createClient();
  const { data: services } = await supabase.from("services").select("name").is("deleted_at", null);
  return <ReadyList businessType={ctx.businessType} existingNames={(services ?? []).map((s) => s.name)} />;
}
