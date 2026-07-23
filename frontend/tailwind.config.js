/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          50: "#eef3fa",
          100: "#dbe6f3",
          200: "#b9cde7",
          300: "#8caed6",
          400: "#5d8ac2",
          500: "#2f66a8",
          600: "#1f4e8a",
          700: "#173d6e",
          800: "#102c52",
          900: "#0b1f3a",
          950: "#071527",
        },
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(11 31 58 / 0.06), 0 1px 3px 0 rgb(11 31 58 / 0.08)",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "Segoe UI", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};
