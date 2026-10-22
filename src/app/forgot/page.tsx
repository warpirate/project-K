import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { ForgotForm } from "./forgot-form";

export default function ForgotPage() {
  return (
    <AuthShell title="Forgot password" subtitle="Owner: we email you a link to set a new password. Staff: ask your owner to reset it.">
      <ForgotForm />
      <p className="mt-8 text-sm text-ink-soft">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-accent underline-offset-4 hover:underline">
          Back to log in
        </Link>
      </p>
    </AuthShell>
  );
}
