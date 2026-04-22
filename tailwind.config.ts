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
        // Dils secondary palette (business units) — legacy, kept for
        // backward compat during Phase 3 component sweep
        unit: {
          office: "#9BCBEB",      // Pantone 283
          logistics: "#CEC492",   // Pantone 4171
          hospitality: "#FF8B40", // Pantone 1575
          living: "#B1B3B3",      // Pantone Cool Gray 5
          retail: "#AB8B5F",      // Pantone 10127 (brass)
        },
        // next-portal-enterprise-soft — business categories
        office:            { DEFAULT: "var(--office)",           soft: "var(--office-soft)" },
        retail:            { DEFAULT: "var(--retail)",           soft: "var(--retail-soft)" },
        logistics:         { DEFAULT: "var(--logistics)",        soft: "var(--logistics-soft)" },
        living:            { DEFAULT: "var(--living)",           soft: "var(--living-soft)" },
        "capital-markets": { DEFAULT: "var(--capital-markets)",  soft: "var(--capital-markets-soft)" },
        hospitality:       "var(--hospitality)",
        corporate:         "var(--corporate)",
        // Support functions
        technology:        { DEFAULT: "var(--technology)",       soft: "var(--technology-soft)" },
        marketing:         { DEFAULT: "var(--marketing)",        soft: "var(--marketing-soft)" },
        research:          { DEFAULT: "var(--research)",         soft: "var(--research-soft)" },
        // Status
        status: {
          success: "var(--status-success)",
          warning: "var(--status-warning)",
          danger:  "var(--status-danger)",
          info:    "var(--status-info)",
          future:  "var(--status-future)",
        },
        // Banner / hero
        "banner-info": {
          DEFAULT:    "var(--banner-info-bg)",
          foreground: "var(--banner-info-text)",
        },
      },
      fontFamily: {
        heading: ["var(--font-rufina)", "Georgia", "serif"],
        sans: ["var(--font-nunito)", "system-ui", "-apple-system", "Arial", "sans-serif"],
      },
      fontSize: {
        hero:         ["var(--fs-hero)",       { lineHeight: "1.25" }],
        section:      ["var(--fs-section)",    { lineHeight: "1.35" }],
        "card-title": ["var(--fs-card-title)", { lineHeight: "1.4"  }],
        meta:         ["var(--fs-meta)",       { lineHeight: "1.4"  }],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        soft:  "var(--shadow-soft)",
        hover: "var(--shadow-hover)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
