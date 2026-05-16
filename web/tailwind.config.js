import typography from "@tailwindcss/typography";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Instrument Serif"', "ui-serif", "Georgia", "serif"],
        sans: [
          '"Inter"',
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: [
          '"JetBrains Mono"',
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
      colors: {
        paper: {
          50: "#FDFCF8",
          100: "#F8F5EC",
          200: "#EFEAD8",
          300: "#E2DBC2",
          400: "#C9C0A0",
        },
        ink: {
          50: "#F4F3EF",
          100: "#E6E3DA",
          200: "#C6C2B4",
          300: "#9A9583",
          400: "#6E6A5C",
          500: "#4A4740",
          600: "#2E2C28",
          700: "#1E1D1A",
          800: "#141311",
          900: "#0A0A09",
        },
        ochre: {
          50: "#FBF5E8",
          100: "#F4E6C2",
          200: "#E9CC85",
          300: "#D9AC4A",
          400: "#C18A20",
          500: "#A06D0E",
          600: "#7E5408",
          700: "#5C3D08",
        },
        moss: {
          400: "#7C8A4E",
          500: "#5F6F3A",
          600: "#475528",
        },
        rust: {
          400: "#C26642",
          500: "#A04E2C",
          600: "#7E3A1E",
        },
      },
      boxShadow: {
        paper: "0 1px 0 rgba(20,19,17,0.04), 0 2px 8px -2px rgba(20,19,17,0.08)",
        "paper-lg": "0 1px 0 rgba(20,19,17,0.04), 0 12px 32px -8px rgba(20,19,17,0.16)",
        inset: "inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -1px 0 rgba(20,19,17,0.04)",
        toolbar: "0 8px 24px -6px rgba(20,19,17,0.4), 0 2px 0 rgba(0,0,0,0.2)",
      },
      keyframes: {
        "pulse-dot": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.55", transform: "scale(0.92)" },
        },
        "rise-in": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "toast-in": {
          "0%": { opacity: "0", transform: "translateY(12px) scale(0.96)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
      },
      animation: {
        "pulse-dot": "pulse-dot 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "rise-in": "rise-in 240ms cubic-bezier(0.16, 1, 0.3, 1)",
        "toast-in": "toast-in 220ms cubic-bezier(0.16, 1, 0.3, 1)",
      },
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [typography],
};
