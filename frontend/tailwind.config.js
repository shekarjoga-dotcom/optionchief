/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        darkBg: "#0B0F19",     // Deep midnight blue
        cardBg: "#111827",     // Slate dark gray
        cardBgLight: "#1F2937",// Lighter card elements
        borderClr: "#374151",  // Slate border
        greenBrand: "#10B981", // Emerald green (credits / PnL profits)
        redBrand: "#EF4444",   // Rose red (debits / PnL losses)
        accentBrand: "#6366F1",// Indigo accent
        accentCyan: "#06B6D4"  // Cyan accent
      }
    },
  },
  plugins: [],
}
