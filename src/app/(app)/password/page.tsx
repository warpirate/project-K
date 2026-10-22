import { PasswordForm } from "./password-form";

export default async function PasswordPage({ searchParams }: { searchParams: Promise<{ reset?: string }> }) {
  const fromEmail = (await searchParams).reset === "1";
  return (
    <div className="mx-auto max-w-md">
      <PasswordForm fromEmail={fromEmail} />
    </div>
  );
}
