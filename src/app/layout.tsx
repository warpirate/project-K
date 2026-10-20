import type { Metadata, Viewport } from "next";
import { Young_Serif, Onest, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const youngSerif = Young_Serif({ weight: "400", subsets: ["latin"], variable: "--font-young-serif" });
const onest = Onest({ subsets: ["latin"], variable: "--font-onest" });
const plexMono = IBM_Plex_Mono({ weight: ["400", "500", "600"], subsets: ["latin"], variable: "--font-plex-mono" });

export const metadata: Metadata = {
  title: "Project K",
  description: "Transactions, balances and udhaar for your shop",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f1e7" },
    { media: "(prefers-color-scheme: dark)", color: "#15140f" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${youngSerif.variable} ${onest.variable} ${plexMono.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
