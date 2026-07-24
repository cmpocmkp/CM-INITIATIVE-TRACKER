/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Glassmorphic dark theme: the old light-mode "navy" text/tint scale is
        // inverted into white-alpha so navy-900 (was near-black text) renders
        // near-white on the dark glass, and navy-50 (was a light tint) renders
        // as a faint translucent wash.
        navy: {
          50: "#ffffff0d",
          100: "#ffffff14",
          200: "#ffffff21",
          300: "#ffffff33",
          400: "#ffffff59",
          500: "#ffffff80",
          600: "#ffffffa3",
          700: "#ffffffbf",
          800: "#ffffffd9",
          900: "#fffffff2",
          950: "#ffffff",
        },
      },
      boxShadow: {
        card: "inset 0 1px 0 rgba(255,255,255,.09), 0 18px 44px rgba(0,0,0,.38)",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "Segoe UI", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};
