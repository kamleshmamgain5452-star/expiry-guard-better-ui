import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./hooks/**/*.{js,ts,jsx,tsx,mdx}",
    "./services/**/*.{js,ts,jsx,tsx,mdx}",
    "./utils/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        guard: {
          50: "#f4fbf8",
          100: "#dcf7ed",
          200: "#bdebdc",
          300: "#89dbc1",
          400: "#4fc29e",
          500: "#27a981",
          600: "#198866",
          700: "#176d54",
          800: "#165746",
          900: "#13483b"
        },
        expiry: {
          safe: "#1ea672",
          near: "#f59e0b",
          expired: "#ef4444"
        }
      },
      boxShadow: {
        soft: "0 18px 45px rgba(18, 56, 45, 0.10)",
        glass: "0 18px 45px rgba(15, 23, 42, 0.16)"
      },
      fontFamily: {
        sans: [
          "Inter",
          "Noto Sans Devanagari",
          "ui-sans-serif",
          "system-ui",
          "sans-serif"
        ]
      }
    }
  },
  plugins: []
};

export default config;
