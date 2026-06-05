/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Primary brand: violet/purple
        accent: {
          DEFAULT: "#7c3aed",
          hover: "#6d28d9",
          soft: "#7c3aed1a",
        },
        // Electric secondary used to add vibrancy in dark mode
        iris: {
          DEFAULT: "#8b5cf6",
          light: "#a855f7",
        },
        cyan: {
          glow: "#22d3ee",
        },
        // Secondary brand: warm gold
        gold: {
          DEFAULT: "#f5b50a",
          hover: "#e0a500",
          soft: "#f5b50a1f",
        },
        // Per-category accents (Monday.com-style): each data type owns a hue.
        cat: {
          jobs: "#3b82f6",      // blue
          invoices: "#7c3aed",  // violet
          quotes: "#f59e0b",    // amber
          messages: "#06b6d4",  // cyan
          customers: "#10b981", // emerald
          revenue: "#7c3aed",
          danger: "#ef4444",
        },
        // Surfaces: clean white in light, professional deep-navy/slate in dark.
        canvas: {
          light: "#f6f7fb",
          dark: "#0a0e1a",
        },
        panel: {
          light: "#ffffff",
          dark: "#111627",
        },
        edge: {
          light: "#e7e9f2",
          dark: "#222a44",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(124,58,237,0.18), 0 12px 40px -12px rgba(124,58,237,0.5)",
        "glow-lg": "0 0 0 1px rgba(124,58,237,0.2), 0 24px 70px -20px rgba(124,58,237,0.55)",
        "glow-cyan": "0 0 0 1px rgba(34,211,238,0.18), 0 16px 50px -16px rgba(34,211,238,0.45)",
        // Professional neutral elevation (Monday/Asana-style soft shadows).
        card: "0 1px 2px rgba(16,24,40,0.04), 0 4px 16px -6px rgba(16,24,40,0.10)",
        "card-lg": "0 10px 34px -10px rgba(16,24,40,0.20)",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #7c3aed 0%, #a855f7 45%, #f5b50a 130%)",
        // animated multi-stop brand sheen used by .brand-text
        "brand-sheen":
          "linear-gradient(110deg, #a855f7 0%, #22d3ee 30%, #f5b50a 55%, #a855f7 80%)",
        "brand-radial":
          "radial-gradient(900px 520px at 12% -12%, rgba(124,58,237,0.30), transparent 60%), radial-gradient(760px 520px at 100% 0%, rgba(34,211,238,0.16), transparent 55%), radial-gradient(700px 520px at 80% 110%, rgba(245,181,10,0.14), transparent 55%)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        // drifting aurora blobs
        aurora: {
          "0%, 100%": { transform: "translate(0px, 0px) scale(1)" },
          "33%": { transform: "translate(36px, -28px) scale(1.18)" },
          "66%": { transform: "translate(-28px, 22px) scale(0.92)" },
        },
        // moving sheen for gradient text / borders
        sheen: {
          "0%": { backgroundPosition: "0% center" },
          "100%": { backgroundPosition: "200% center" },
        },
        "pulse-glow": {
          "0%, 100%": { opacity: "0.55", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.06)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.7s cubic-bezier(0.22,1,0.36,1) forwards",
        float: "float 6s ease-in-out infinite",
        aurora: "aurora 20s ease-in-out infinite",
        sheen: "sheen 6s linear infinite",
        "pulse-glow": "pulse-glow 3.5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
