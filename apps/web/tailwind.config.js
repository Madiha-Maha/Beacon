/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        "bg-elev": "var(--bg-elev)",
        "bg-border": "var(--bg-border)",
        primary: "var(--primary)",
        "primary-ink": "var(--primary-ink)",
        text: "var(--text)",
        "text-dim": "var(--text-dim)",
        hazard: "var(--hazard)",
        social: "var(--social)",
        ambient: "var(--ambient)",
      },
      fontFamily: {
        sans: ["var(--font-atkinson)", "Atkinson Hyperlegible", "system-ui", "sans-serif"],
      },
      boxShadow: {
        "signal-glow": "0 0 24px 0 rgba(255, 184, 76, 0.35)",
      },
      keyframes: {
        "ring-pulse": {
          "0%, 100%": {
            transform: "scale(1)",
            opacity: "0.9",
            boxShadow: "0 0 0 0 rgba(255,184,76,0.55)",
          },
          "50%": {
            transform: "scale(1.05)",
            opacity: "1",
            boxShadow: "0 0 0 18px rgba(255,184,76,0)",
          },
        },
        "ring-hazard": {
          "0%, 100%": {
            transform: "scale(1)",
            boxShadow: "0 0 0 0 rgba(255,84,84,0.7)",
          },
          "50%": {
            transform: "scale(1.08)",
            boxShadow: "0 0 0 22px rgba(255,84,84,0)",
          },
        },
        "tier-fade": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "ring-pulse": "ring-pulse 1.6s ease-in-out infinite",
        "ring-hazard": "ring-hazard 1s ease-in-out infinite",
        "tier-fade": "tier-fade 180ms ease-out",
      },
    },
  },
  plugins: [],
};
