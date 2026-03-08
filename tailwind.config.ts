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
        brand: {
          DEFAULT: "#1e3a5f",
          hover: "#152a47",
          light: "#2d4a6f",
          subtle: "rgba(30, 58, 95, 0.08)",
        },
        paper: {
          DEFAULT: "#fafaf9",
          card: "#ffffff",
          border: "#eaeaea",
          muted: "#737373",
          ink: "#171717",
          inkLight: "#525252",
        },
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
