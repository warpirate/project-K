import { NextResponse, type NextRequest } from "next/server";
import { getAppContext } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { periodRange, todayIST } from "@/lib/periods";

const KIND: Record<string, string> = {
  service: "Service",
  expense: "Expense",
  transfer: "Move money",
  udhaar_payment: "Udhaar paid back",
  udhaar_given: "Udhaar given (money taken)",
  opening_balance: "Balance set",
  reversal: "Reversal",
};

const csvCell = (v: string | number | null | undefined) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const rupees = (p: number) => (p / 100).toFixed(2);

/** Owner downloads every entry in the period as a CSV (opens in Excel). */
export async function GET(req: NextRequest) {
  const ctx = await getAppContext();
  if (!ctx.isOwner) return new NextResponse("Only the owner can export", { status: 403 });
  const sp = req.nextUrl.searchParams;
  const range = periodRange(sp.get("period") ?? "today", todayIST(), sp.get("from") ?? undefined, sp.get("to") ?? undefined);
  const branch = sp.get("branch");

  const supabase = await createClient();
  const { data: people } = await supabase.from("profiles").select("user_id, name");
  const who = new Map((people ?? []).map((p) => [p.user_id, p.name]));

  const rows: string[] = [
    ["Date", "Time", "Branch", "What", "Amount", "Your charge", "Commission", "Portal fee", "Profit", "Customer", "By", "Note"].join(","),
  ];
  for (let offset = 0; ; offset += 1000) {
    let q = supabase
      .from("transactions")
      .select("business_date, created_at, kind, amount, fee, commission, portal_cost, earning, note, created_by, branches(name), services(name), customers(name)")
      .gte("business_date", range.from)
      .lte("business_date", range.to)
      .order("created_at")
      .range(offset, offset + 999);
    if (branch && branch !== "all") q = q.eq("branch_id", branch);
    const { data, error } = await q;
    if (error) return new NextResponse(error.message, { status: 500 });
    for (const t of data ?? []) {
      rows.push(
        [
          t.business_date,
          new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(t.created_at)),
          t.branches?.name,
          t.services?.name ?? KIND[t.kind] ?? t.kind,
          rupees(Number(t.amount)),
          rupees(Number(t.fee)),
          rupees(Number(t.commission)),
          rupees(Number(t.portal_cost)),
          rupees(Number(t.earning)),
          t.customers?.name,
          who.get(t.created_by),
          t.note,
        ]
          .map(csvCell)
          .join(","),
      );
    }
    if ((data ?? []).length < 1000) break;
  }

  // BOM so Excel reads ₹ and Indian names correctly.
  return new NextResponse("﻿" + rows.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="entries-${range.from}-to-${range.to}.csv"`,
    },
  });
}
