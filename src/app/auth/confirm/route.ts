import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/** Landing spot for email links (password reset): signs the user in, then sends them on. */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl;
  const next = searchParams.get("next")?.startsWith("/") ? searchParams.get("next")! : "/";
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const supabase = await createClient();

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error("missing code") };

  if (error) return NextResponse.redirect(`${origin}/login?link=bad`);
  return NextResponse.redirect(`${origin}${next}?reset=1`);
}
