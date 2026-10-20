import { getAppContext } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { loadBalances } from "@/lib/balances";
import { UdhaarBook } from "./udhaar-book";

export default async function UdhaarPage() {
  const ctx = await getAppContext();
  if (!ctx.branchId) return <p className="text-ink-soft">No branch selected.</p>;
  const supabase = await createClient();
  const [{ data: dues }, accounts] = await Promise.all([
    supabase.from("customer_dues").select("customer_id, name, phone, due").order("due", { ascending: false }).limit(5000),
    loadBalances(ctx.branchId),
  ]);
  return (
    <UdhaarBook
      shopId={ctx.profile.shop_id}
      branchId={ctx.branchId}
      customers={(dues ?? []).map((d) => ({ id: d.customer_id!, name: d.name!, phone: d.phone, due: Number(d.due) }))}
      cashId={accounts.find((a) => a.type === "cash")?.account_id}
      banks={accounts.filter((a) => a.type === "bank").map((a) => ({ id: a.account_id, name: a.name }))}
    />
  );
}
