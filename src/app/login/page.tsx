import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <AuthShell title="Log in" subtitle="Owner: use your email. Staff: use the username your owner gave you.">
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
