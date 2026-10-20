import { redirect } from "next/navigation";
import { getAppContext } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Rule, Flow } from "@/lib/rules";
import { SettingsTabs } from "./settings-tabs";

export interface ServiceRow {
  id: string;
  name: string;
  flow: Flow;
  aliases: string[];
  fee_rule: Rule | null;
  commission_rule: Rule | null;
  portal_cost_rule: Rule | null;
  active: boolean;
  reviewed: boolean;
}

export interface AccountRow {
  id: string;
  branch_id: string;
  name: string;
  type: "cash" | "wallet" | "bank";
  active: boolean;
}

export interface StaffRow {
  user_id: string;
  name: string;
  username: string;
  branch_id: string | null;
  active: boolean;
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const ctx = await getAppContext();
  if (!ctx.isOwner) redirect("/");
  const supabase = await createClient();
  const [{ data: services }, { data: accounts }, { data: profiles }] = await Promise.all([
    supabase.from("services").select("id, name, flow, aliases, fee_rule, commission_rule, portal_cost_rule, active, reviewed").order("name"),
    supabase.from("accounts").select("id, branch_id, name, type, active").order("created_at"),
    supabase.from("profiles").select("user_id, name, branch_id, active, role").eq("role", "staff").order("name"),
  ]);

  // Usernames live in auth (as <username>@staff.projectk.local); look them up server-side.
  const admin = createAdminClient();
  const staff: StaffRow[] = await Promise.all(
    (profiles ?? []).map(async (p) => {
      const { data } = await admin.auth.admin.getUserById(p.user_id);
      return { user_id: p.user_id, name: p.name, branch_id: p.branch_id, active: p.active, username: data.user?.email?.split("@")[0] ?? "" };
    }),
  );

  return (
    <SettingsTabs
      initialTab={(await searchParams).tab ?? "services"}
      shopId={ctx.profile.shop_id}
      branches={ctx.branches}
      services={(services ?? []) as unknown as ServiceRow[]}
      accounts={(accounts ?? []) as AccountRow[]}
      staff={staff}
    />
  );
}
