import type { Config } from "tailwindcss";

/**
 * Palette per The Drink Exchange Brand Asset Book §04.
 * Black market #0D0D0D, trading floor charcoal #171717, brass reserve #C5A352,
 * ticker green #00B764, bull green #00A85E, bear red #C0322F,
 * ivory ledger #F2E8D5, deep emerald leather #003432.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Surfaces
        bg: {
          DEFAULT: "#0D0D0D",
          card: "#171717",
          elev: "#1F1F1F",
          glass: "rgba(20, 20, 20, 0.7)",
          emerald: "#003432",
        },
        // Lines / edges
        edge: "#2A2418",
        "edge-bright": "#3A2F1B",
        // Type
        ink: {
          DEFAULT: "#F2E8D5",
          dim: "#A89B7E",
          ghost: "#5C5340",
        },
        // Brand accents
        brass: {
          DEFAULT: "#C5A352",
          dim: "#8C7438",
          dark: "#5A4A23",
        },
        bull: "#00B764",
        "bull-dim": "#007A42",
        bear: "#C0322F",
        "bear-dim": "#7A1F1D",
        amber: "#E0A040",
        "amber-dim": "#A06D20",
        emerald: "#003432",
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        serif: [
          "Playfair Display",
          "Cormorant Garamond",
          "Georgia",
          "Cambria",
          "Times New Roman",
          "serif",
        ],
        mono: [
          "JetBrains Mono",
          "IBM Plex Mono",
          "Geist Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
        display: ["Bebas Neue", "Inter", "sans-serif"],
      },
      letterSpacing: {
        terminal: "0.18em",
        brand: "0.32em",
      },
      keyframes: {
        flash: {
          "0%": { opacity: "0" },
          "30%": { opacity: "0.8" },
          "100%": { opacity: "0" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        priceUp: {
          "0%": { backgroundColor: "rgba(0, 183, 100, 0.35)" },
          "100%": { backgroundColor: "transparent" },
        },
        priceDown: {
          "0%": { backgroundColor: "rgba(192, 50, 47, 0.35)" },
          "100%": { backgroundColor: "transparent" },
        },
      },
      animation: {
        flash: "flash 200ms ease-out",
        marquee: "marquee 45s linear infinite",
        "price-up": "priceUp 600ms ease-out",
        "price-down": "priceDown 600ms ease-out",
      },
      backgroundImage: {
        "brass-gradient":
          "linear-gradient(90deg, rgba(197,163,82,0) 0%, rgba(197,163,82,0.55) 50%, rgba(197,163,82,0) 100%)",
        "emerald-haze":
          "radial-gradient(circle at 50% 0%, rgba(0,52,50,0.45), transparent 55%)",
      },
    },
  },
  plugins: [],
};

export default config;
