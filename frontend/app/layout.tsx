import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "AstroDetect — AI Exoplanet Transit Detection",
  description:
    "AI-powered exoplanet transit detection from TESS light curves. Built for the Bharatiya Antariksh Hackathon 2026 (BAH 2026, Challenge 7 by ISRO).",
  keywords: ["exoplanet", "TESS", "transit detection", "BLS", "machine learning", "BAH 2026", "ISRO"],
  authors: [{ name: "AstroDetect Team" }],
  openGraph: {
    title: "AstroDetect — AI Exoplanet Transit Detection",
    description: "AI pipeline for TESS exoplanet transit detection — BAH 2026",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      </head>
      <body>
        <Providers>
          <Navbar />
          <main className="relative z-10 pt-14">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
