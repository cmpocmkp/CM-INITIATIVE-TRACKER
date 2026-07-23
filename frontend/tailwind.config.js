/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // CMPO brand blue — anchored on the logo cyan (#00AEEF)
        navy: {
          50: "#eef9fe",
          100: "#d8f1fc",
          200: "#b0e4f9",
          300: "#7dd3f4",
          400: "#38bdf0",
          500: "#00aeef",
          600: "#0092cd",
          700: "#0076a9",
          800: "#0a5f86",
          900: "#0d4a68",
          950: "#082f43",
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
