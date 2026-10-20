import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Project K",
  description: "Transactions, balances and udhaar for your shop",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
