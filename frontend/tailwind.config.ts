import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./providers/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        monad: {
          purple: "#836EF9",
          black: "#0A0A0F",
          purpleDark: "#6B56E0",
        },
      },
      boxShadow: {
        stream: "0 0 40px rgba(131, 110, 249, 0.15)",
      },
      fontFamily: {
        sans: ["Arial", "Helvetica", "sans-serif"],
        mono: ["Consolas", "Monaco", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
