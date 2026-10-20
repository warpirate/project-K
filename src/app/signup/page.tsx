import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { SignupForm } from "./signup-form";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  const shopOnly = (await searchParams).step === "shop";
  return (
    <AuthShell
      title={shopOnly ? "Name your shop" : "Create your shop"}
      subtitle={shopOnly ? "One last step before setup." : "For the shop owner. You will add branches and staff next."}
    >
      <SignupForm shopOnly={shopOnly} />
      {shopOnly ? null : (
        <p className="mt-8 text-sm text-ink-soft">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-accent underline-offset-4 hover:underline">
            Log in
          </Link>
        </p>
      )}
    </AuthShell>
  );
}
