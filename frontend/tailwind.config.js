/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // n8n-style ember accent
        accent: {
          DEFAULT: "#ff6d5a",
          hover: "#ff5640",
          soft: "#ff6d5a1a",
        },
        canvas: {
          light: "#f4f5f7",
          dark: "#1a1a24",
        },
        panel: {
          light: "#ffffff",
          dark: "#24242f",
        },
        edge: {
          light: "#e5e7eb",
          dark: "#34343f",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};
