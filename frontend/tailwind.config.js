// /frontend/tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#070A12",
        surface: "#0B1220",
        surface2: "#0F1A2E",
        border: "rgba(255,255,255,0.10)",
        neon: { cyan: "#22D3EE", deep: "#0891B2" },
        accent: {
          gold: "#F5C542",
          green: "#22C55E",
          amber: "#F59E0B",
          rose: "#FB7185",
        },
        text: {
          primary: "#E5E7EB",
          secondary: "rgba(229,231,235,0.70)",
          muted: "rgba(229,231,235,0.50)",
        },
      },
      fontFamily: {
        display: ["Space Grotesk", "sans-serif"],
        body: ["Inter", "sans-serif"],
      },
      boxShadow: {
        neon: "0 0 10px rgba(34, 211, 238, 0.3)",
        "neon-hover": "0 0 20px rgba(34, 211, 238, 0.5)",
      },
      keyframes: {
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in-up": "fade-in-up 250ms ease-out",
      },
    },
  },
  plugins: [],
};
