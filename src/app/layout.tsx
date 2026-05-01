import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "@/components/providers";

// IvyMode Semi Bold — Dils brand display serif, used for h1–h4 + brand mark.
// Variable name kept as --font-rufina so the cascade in globals.css and tailwind.config.ts
// keeps working without sweeping every utility (zero functional risk).
const ivymode = localFont({
  src: "../../public/fonts/IvyMode-SemiBold.otf",
  weight: "600",
  style: "normal",
  variable: "--font-rufina",
  display: "swap",
});

// Nunito Sans — Dils body font, loaded from local variable-font files
// (full weight axis 100-1000, italic variant included).
const nunitoSans = localFont({
  src: [
    {
      path: "../../public/fonts/NunitoSans-Variable.ttf",
      style: "normal",
      weight: "100 1000",
    },
    {
      path: "../../public/fonts/NunitoSans-Italic-Variable.ttf",
      style: "italic",
      weight: "100 1000",
    },
  ],
  variable: "--font-nunito",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Dils Investment Portal",
  description: "Deal pipeline tracking for Dils Investment Sales",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${ivymode.variable} ${nunitoSans.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
