import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface AccountBalance {
  account_id: string;
  branch_id: string;
  name: string;
  type: "cash" | "wallet" | "bank";
  balance: number;
}

/** Active accounts with live balances that the signed-in user can see, optionally for one branch. */
export async function loadBalances(branchId?: string): Promise<AccountBalance[]> {
  const supabase = await createClient();
  let q = supabase.from("account_balances").select("account_id, branch_id, name, type, balance, active").eq("active", true);
  if (branchId) q = q.eq("branch_id", branchId);
  const { data } = await q.order("name");
  const order = { cash: 0, wallet: 1, bank: 2 } as const;
  return ((data ?? []) as (AccountBalance & { active: boolean })[])
    .map(({ account_id, branch_id, name, type, balance }) => ({ account_id, branch_id, name, type, balance: Number(balance) }))
    .sort((a, b) => order[a.type] - order[b.type] || a.name.localeCompare(b.name));
}

export const TYPE_LABEL = { cash: "Cash", wallet: "Portal wallet", bank: "Bank / UPI" } as const;
