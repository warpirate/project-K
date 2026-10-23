import { redirect } from "next/navigation";
import { getAppContext } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { Progress, STEPS, type StepKey } from "./progress";
import { BusinessStep } from "./business-step";
import { BranchesStep } from "./branches-step";
import { AccountsStep } from "./accounts-step";
import { ServicesStep } from "./services-step";
import { StaffStep } from "./staff-step";

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  const ctx = await getAppContext();
  if (!ctx.isOwner) redirect("/");

  const supabase = await createClient();
  const [{ data: accounts }, { data: services }] = await Promise.all([
    supabase.from("accounts").select("id, name, type, branch_id").is("deleted_at", null).order("created_at"),
    supabase.from("services").select("name").is("deleted_at", null),
  ]);

  // Resume at the first step that has nothing saved yet, unless one is asked for.
  const firstIncomplete: StepKey =
    !ctx.businessType ? "business" : ctx.branches.length === 0 ? "branches" : (accounts ?? []).length === 0 ? "accounts" : (services ?? []).length === 0 ? "services" : "staff";
  const asked = (await searchParams).step as StepKey | undefined;
  const reachable = STEPS.slice(0, STEPS.findIndex((s) => s.key === firstIncomplete) + 1).map((s) => s.key);
  const step = asked && reachable.includes(asked) ? asked : firstIncomplete;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <p className="font-display text-2xl">{ctx.shopName}</p>
      <h1 className="mt-1 text-ink-soft">Set up your shop. You can change all of this later.</h1>
      <Progress current={step} reachable={reachable} />
      <div className="rise mt-8" key={step}>
        {step === "business" && <BusinessStep current={ctx.businessType} />}
        {step === "branches" && <BranchesStep existing={ctx.branches} />}
        {step === "accounts" && <AccountsStep branches={ctx.branches} existing={accounts ?? []} businessType={ctx.businessType} />}
        {step === "services" && <ServicesStep businessType={ctx.businessType ?? "other"} existingNames={(services ?? []).map((s) => s.name)} />}
        {step === "staff" && <StaffStep branches={ctx.branches} />}
      </div>
    </main>
  );
}
