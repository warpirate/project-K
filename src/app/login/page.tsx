import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { Banner } from "@/components/ui";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ off?: string }> }) {
  const off = (await searchParams).off === "1";
  return (
    <AuthShell title="Log in" subtitle="Owner: use your email. Staff: use the username your owner gave you.">
      {off ? (
        <div className="mb-5">
          <Banner>Your login has been stopped by the owner.</Banner>
        </div>
      ) : null}
      <LoginForm />
      <p className="mt-8 text-sm text-ink-soft">
        New shop?{" "}
        <Link href="/signup" className="font-medium text-accent underline-offset-4 hover:underline">
          Create your shop account
        </Link>
      </p>
    </AuthShell>
  );
}
