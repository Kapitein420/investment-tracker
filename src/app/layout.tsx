import type { Metadata } from "next";
import { Rufina, Nunito_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const rufina = Rufina({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-rufina",
  display: "swap",
});

const nunitoSans = Nunito_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "600", "700", "800"],
  variable: "--font-nunito",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Dils Investment Tracker",
  description: "Deal pipeline tracking for Dils Investment Sales",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${rufina.variable} ${nunitoSans.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
