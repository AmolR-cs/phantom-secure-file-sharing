import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        cyber: {
          black: "#05070B",
          dark: "#0B0F17",
          darker: "#080B11",
          card: "rgba(15, 23, 42, 0.65)",
          border: "rgba(56, 189, 248, 0.15)",
          neonCyan: "#00F0FF",
          neonPurple: "#BD00FF",
          neonGreen: "#00FF66",
          neonRed: "#FF003C",
          neonYellow: "#FFE600",
          dim: "#64748B",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Menlo", "Monaco", "Courier New", "monospace"],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "glow": "glow 2s ease-in-out infinite alternate",
        "radar-sweep": "radar 4s linear infinite",
      },
      keyframes: {
        glow: {
          "0%": { boxShadow: "0 0 10px rgba(0, 240, 255, 0.2)" },
          "100%": { boxShadow: "0 0 25px rgba(0, 240, 255, 0.6)" },
        },
        radar: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};

export default config;
