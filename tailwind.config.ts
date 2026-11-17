import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Master Brand Identity Palette
        navy: {
          DEFAULT: "#0B1F3A",
          900: "#061224",
          800: "#0B1F3A",
          700: "#102B4E",
          600: "#153864",
        },
        primary: {
          DEFAULT: "#1557A6",
          dark: "#0B1F3A",
          light: "#2878C8",
          50: "#EEF5FB",
          100: "#D9E9F7",
          200: "#B3D3EF",
          500: "#1557A6",
          600: "#104789",
          700: "#0C3669",
        },
        secondary: {
          DEFAULT: "#2878C8",
          light: "#5297DB",
          dark: "#1B5D9E",
        },
        accent: {
          DEFAULT: "#F59E0B",
          gold: "#F59E0B",
          light: "#FDBA3B",
          50: "#FFFBEB",
          100: "#FEF3C7",
          500: "#F59E0B",
          600: "#D97706",
        },
        surface: {
          DEFAULT: "#F7F9FC",
          soft: "#EEF5FB",
          card: "#FFFFFF",
          border: "#D9E2EC",
        },
        content: {
          primary: "#101828",
          secondary: "#344054",
          muted: "#667085",
        },
        status: {
          success: "#12B76A",
          warning: "#F79009",
          error: "#D92D20",
        },
        // Backward-compatible Brand map
        brand: {
          dark: "#0B1F3A",          // Deep Navy
          darkHover: "#102B4E",     // Rich Navy Hover
          primary: "#1557A6",       // Primary Blue
          secondary: "#2878C8",     // Secondary Blue
          accent: "#F59E0B",        // Orange / Gold
          accentHover: "#FDBA3B",   // Light Gold Hover
          surface: "#F7F9FC",       // Off-white / Soft Grey Background
          surfaceSoft: "#EEF5FB",   // Soft Blue Surface
          border: "#D9E2EC",        // Clean Border
          white: "#FFFFFF",
          text: "#101828",
          textMuted: "#667085",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "sans-serif",
        ],
      },
      boxShadow: {
        subtle: "0 1px 3px 0 rgba(11, 31, 58, 0.04), 0 1px 2px 0 rgba(11, 31, 58, 0.02)",
        card: "0 2px 6px -1px rgba(11, 31, 58, 0.06), 0 2px 4px -2px rgba(11, 31, 58, 0.04)",
        cardHover: "0 10px 25px -5px rgba(11, 31, 58, 0.08), 0 8px 10px -6px rgba(11, 31, 58, 0.04)",
        navy: "0 10px 30px -5px rgba(11, 31, 58, 0.25)",
      },
    },
  },
  plugins: [],
};

export default config;
