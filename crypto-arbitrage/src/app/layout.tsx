import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Real-Time Crypto Arbitrage Dashboard",
  description: "Monitors and highlights profitable arbitrage opportunities after fees in real time across 7 major exchanges.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased font-sans bg-slate-950 text-slate-100">
        {children}
      </body>
    </html>
  );
}
