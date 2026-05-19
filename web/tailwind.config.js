import typography from "@tailwindcss/typography";

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
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
          50: "var(--color-paper-50)",
          100: "var(--color-paper-100)",
          200: "var(--color-paper-200)",
          300: "var(--color-paper-300)",
          400: "var(--color-paper-400)",
        },
        ink: {
          50: "var(--color-ink-50)",
          100: "var(--color-ink-100)",
          200: "var(--color-ink-200)",
          300: "var(--color-ink-300)",
          400: "var(--color-ink-400)",
          500: "var(--color-ink-500)",
          600: "var(--color-ink-600)",
          700: "var(--color-ink-700)",
          800: "var(--color-ink-800)",
          900: "var(--color-ink-900)",
        },
        ochre: {
          50: "var(--color-ochre-50)",
          100: "var(--color-ochre-100)",
          200: "var(--color-ochre-200)",
          300: "var(--color-ochre-300)",
          400: "var(--color-ochre-400)",
          500: "var(--color-ochre-500)",
          600: "var(--color-ochre-600)",
          700: "var(--color-ochre-700)",
        },
        moss: {
          400: "var(--color-moss-400)",
          500: "var(--color-moss-500)",
          600: "var(--color-moss-600)",
        },
        rust: {
          400: "var(--color-rust-400)",
          500: "var(--color-rust-500)",
          600: "var(--color-rust-600)",
        },
      },
      boxShadow: {
        paper: "var(--shadow-paper)",
        "paper-lg": "var(--shadow-paper-lg)",
        inset: "var(--shadow-inset)",
        toolbar: "var(--shadow-toolbar)",
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
