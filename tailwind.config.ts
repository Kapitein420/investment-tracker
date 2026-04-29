import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Dils primary brand palette (from Brand Identity Guidelines 2025-05-14)
        dils: {
          black: "#101820",    // Pantone Black 6 — institutional
          red: "#EE2E24",      // Pantone 1788 — accent / alert only, never on word "Dils"
          brass: "#AB8B5F",    // Pantone 10127 — decorative warm accent
          white: "#FFFFFF",
          // Extended halftones of brand black for flexibility
          50: "#F5F6F7",
          100: "#E6E8EB",
          200: "#C9CDD3",
          300: "#9BA2AC",
          400: "#6C7580",
          500: "#4A5261",
          600: "#2F3743",
          700: "#1E2530",
          800: "#141A24",
          900: "#101820",
        },
        // Dils secondary palette (business units)
        unit: {
          office: "#9BCBEB",      // Pantone 283
          logistics: "#CEC492",   // Pantone 4171
          hospitality: "#FF8B40", // Pantone 1575
          living: "#B1B3B3",      // Pantone Cool Gray 5
          retail: "#AB8B5F",      // Pantone 10127 (brass)
        },
        // ─────────────────────────────────────────────────────────────
        // Soft-enterprise palette (additive — see globals.css :root for
        // the source-of-truth CSS variables and the HTML mockups).
        // Hex values are duplicated here so Tailwind's opacity modifier
        // (e.g. bg-soft-office/14) and arbitrary-value class names work
        // without `hsl()` wrapping. Brand tokens (dils.*, unit.*) above
        // are untouched.
        // ─────────────────────────────────────────────────────────────
        "banner-info": {
          DEFAULT: "#D9F1F1",      // banner background
          foreground: "#245C63",   // banner text + deep info accent
        },
        soft: {
          office: "#7FA9B5",
          "office-soft": "rgba(127, 169, 181, 0.14)",
          retail: "#B89B4C",
          "retail-soft": "rgba(184, 155, 76, 0.14)",
          logistics: "#6FA08E",
          "logistics-soft": "rgba(111, 160, 142, 0.14)",
          living: "#C79AA5",
          "living-soft": "rgba(199, 154, 165, 0.14)",
          "capital-markets": "#8C6B73",
          "capital-markets-soft": "rgba(140, 107, 115, 0.14)",
          research: "#6D4C7D",
          "research-soft": "rgba(109, 76, 125, 0.12)",
          marketing: "#0F7C82",
          "marketing-soft": "rgba(15, 124, 130, 0.12)",
          accent: "#C2533F",
          "bg-main": "#F6F7F9",
          "bg-surface": "#FFFFFF",
          "bg-surface-alt": "#F9FAFB",
          border: "#E5E7EB",
          "text-primary": "#1F2937",
          "text-secondary": "#6B7280",
          "text-muted": "#9CA3AF",
        },
        status: {
          success: "#6FA08E",
          "success-soft": "rgba(111, 160, 142, 0.14)",
          warning: "#B89B4C",
          "warning-soft": "rgba(184, 155, 76, 0.14)",
          info: "#7FA9B5",
          "info-soft": "rgba(127, 169, 181, 0.14)",
          danger: "#C86B6B",
          "danger-soft": "rgba(200, 107, 107, 0.12)",
          current: "#245C63",
        },
        funnel: {
          1: "#6FA08E", // success
          2: "#7FA9B5", // office
          3: "#6D4C7D", // research
          4: "#B89B4C", // warning
          5: "#C86B6B", // danger
        },
      },
      boxShadow: {
        "soft-card": "0 2px 8px rgba(17, 24, 39, 0.05)",
        "soft-card-hover": "0 6px 20px rgba(17, 24, 39, 0.08)",
      },
      fontFamily: {
        heading: ["var(--font-rufina)", "Georgia", "serif"],
        sans: ["var(--font-nunito)", "system-ui", "-apple-system", "Arial", "sans-serif"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
