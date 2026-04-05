/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cosmos: {
          900: "#06090f",
          800: "#0d1525",
          700: "#111b32",
          500: "#3b82f6",
          300: "#7dd3fc"
        }
      },
      boxShadow: {
        panel: "0 20px 60px rgba(0, 0, 0, 0.35)"
      }
    }
  },
  plugins: []
};
