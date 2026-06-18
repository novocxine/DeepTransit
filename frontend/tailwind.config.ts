import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        space: {
          black: "#0d1117",
          dark: "#161b22",
          card: "#21262d",
          border: "#30363d",
          muted: "#8b949e",
          text: "#c9d1d9",
          accent: "#58a6ff",
          "accent-dim": "#1f6feb",
          planet: "#3fb950",
          eb: "#f85149",
          blend: "#e3b341",
          other: "#8b949e",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      backgroundImage: {
        "star-gradient": "radial-gradient(ellipse at 50% 0%, #1f6feb22 0%, transparent 60%)",
        "card-gradient": "linear-gradient(135deg, #161b22 0%, #0d1117 100%)",
        "hero-gradient": "radial-gradient(ellipse at center top, #1f6feb18 0%, transparent 65%)",
        "planet-glow": "radial-gradient(circle, #3fb95033 0%, transparent 70%)",
        "eb-glow": "radial-gradient(circle, #f8514933 0%, transparent 70%)",
      },
      boxShadow: {
        "accent-sm": "0 0 12px rgba(88, 166, 255, 0.15)",
        "accent-md": "0 0 24px rgba(88, 166, 255, 0.25)",
        "planet-sm": "0 0 12px rgba(63, 185, 80, 0.20)",
        "eb-sm": "0 0 12px rgba(248, 81, 73, 0.20)",
        "card": "0 1px 3px rgba(0,0,0,0.4), 0 0 0 1px rgba(48,54,61,0.6)",
        "card-hover": "0 4px 16px rgba(0,0,0,0.5), 0 0 0 1px rgba(88,166,255,0.2)",
      },
      animation: {
        "pulse-slow": "pulse 3s ease-in-out infinite",
        "twinkle": "twinkle 2s ease-in-out infinite",
        "scan": "scan 2s linear infinite",
        "float": "float 6s ease-in-out infinite",
        "glow-pulse": "glowPulse 2s ease-in-out infinite",
        "draw-line": "drawLine 1s ease forwards",
        "fade-up": "fadeUp 0.6s ease forwards",
        "slide-in": "slideIn 0.4s ease forwards",
      },
      keyframes: {
        twinkle: {
          "0%, 100%": { opacity: "0.3", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.2)" },
        },
        scan: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        glowPulse: {
          "0%, 100%": { boxShadow: "0 0 8px rgba(88,166,255,0.2)" },
          "50%": { boxShadow: "0 0 20px rgba(88,166,255,0.5)" },
        },
        drawLine: {
          "0%": { strokeDashoffset: "1" },
          "100%": { strokeDashoffset: "0" },
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideIn: {
          "0%": { opacity: "0", transform: "translateX(-20px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
