import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // LKS Systems brand palette, pulled from thelouispen.co.uk
        brand: {
          black: "#000000",
          ink: "#0A0A0C",
          off: "#F5F5F0",
          violet: {
            50: "#F5F3FF",
            100: "#EDE9FE",
            200: "#DDD6FE",
            300: "#C4B5FD",
            400: "#A78BFA",
            500: "#8B5CF6",
            600: "#7C3AED",
            700: "#6D28D9",
          },
        },
      },
      fontFamily: {
        sans: ["Inter", "Arial", "sans-serif"],
        display: ["Space Grotesk", "Inter", "Arial", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgba(0,0,0,0.05), 0 1px 3px 0 rgba(0,0,0,0.04)",
        soft: "0 2px 8px -2px rgba(24,24,27,0.08), 0 1px 2px -1px rgba(24,24,27,0.06)",
        lifted: "0 12px 32px -8px rgba(24,24,27,0.18), 0 4px 12px -4px rgba(24,24,27,0.10)",
        glow: "0 0 0 1px rgba(139,92,246,0.15), 0 8px 30px -6px rgba(139,92,246,0.35)",
      },
      keyframes: {
        "overlay-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "overlay-out": { from: { opacity: "1" }, to: { opacity: "0" } },
        "sheet-in": {
          from: { opacity: "0", transform: "translate(-50%, -48%) scale(0.96)" },
          to: { opacity: "1", transform: "translate(-50%, -50%) scale(1)" },
        },
        "sheet-out": {
          from: { opacity: "1", transform: "translate(-50%, -50%) scale(1)" },
          to: { opacity: "0", transform: "translate(-50%, -48%) scale(0.96)" },
        },
        "pop-in": {
          from: { opacity: "0", transform: "scale(0.95) translateY(-4px)" },
          to: { opacity: "1", transform: "scale(1) translateY(0)" },
        },
        "pop-out": {
          from: { opacity: "1", transform: "scale(1) translateY(0)" },
          to: { opacity: "0", transform: "scale(0.95) translateY(-4px)" },
        },
        "toast-in": {
          from: { opacity: "0", transform: "translateY(8px) scale(0.98)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "overlay-in": "overlay-in 180ms ease-out",
        "overlay-out": "overlay-out 150ms ease-in",
        "sheet-in": "sheet-in 220ms cubic-bezier(0.16,1,0.3,1)",
        "sheet-out": "sheet-out 150ms ease-in",
        "pop-in": "pop-in 160ms cubic-bezier(0.16,1,0.3,1)",
        "pop-out": "pop-out 120ms ease-in",
        "toast-in": "toast-in 220ms cubic-bezier(0.16,1,0.3,1)",
        shimmer: "shimmer 1.8s ease-in-out infinite",
      },
    },
  },
  plugins: [animate],
} satisfies Config;
