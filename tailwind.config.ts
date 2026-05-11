import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bull: "#22D48F",
        "bull-dim": "#0B7A50",
        bear: "#FF4757",
        "bear-dim": "#7A1F26",
        amber: "#F4B842",
        bg: {
          DEFAULT: "#06080B",
          card: "#0B0F14",
          elev: "#10161D",
          glass: "rgba(13, 19, 27, 0.6)",
        },
        ink: {
          DEFAULT: "#E6E8EB",
          dim: "#8A93A0",
          ghost: "#4B5360",
        },
        edge: "#1A2027",
        "edge-bright": "#252D36",
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
      fontFeatureSettings: {
        tabular: '"tnum", "lnum"',
      },
      letterSpacing: {
        terminal: "0.18em",
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
          "0%": { backgroundColor: "rgba(34, 212, 143, 0.35)" },
          "100%": { backgroundColor: "transparent" },
        },
        priceDown: {
          "0%": { backgroundColor: "rgba(255, 71, 87, 0.35)" },
          "100%": { backgroundColor: "transparent" },
        },
      },
      animation: {
        flash: "flash 200ms ease-out",
        marquee: "marquee 45s linear infinite",
        "price-up": "priceUp 600ms ease-out",
        "price-down": "priceDown 600ms ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
