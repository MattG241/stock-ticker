import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bull: "#10B981",
        bear: "#EF4444",
        amber: "#FBBF24",
        bg: {
          DEFAULT: "#09090B",
          card: "#18181B",
          elev: "#27272A",
        },
        ink: {
          DEFAULT: "#FAFAFA",
          dim: "#A1A1AA",
        },
        edge: "#27272A",
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
      },
      animation: {
        flash: "flash 200ms ease-out",
        marquee: "marquee 60s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
