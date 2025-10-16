/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}","./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: { colors: { brand: "#00e0ff", bg: "#0f172a" } }
  },
  plugins: [],
}
