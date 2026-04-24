/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'cereal': '#D4A373',
        'cereal-dark': '#4A3B32',
      }
    },
  },
  plugins: [],
}
