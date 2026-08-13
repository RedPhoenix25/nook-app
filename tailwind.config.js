/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./lib/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        cream: "#FDFBF7",
        terracotta: "#E06D53",
        "terracotta-light": "#F0907C",
        "terracotta-dark": "#C55840",
        sage: "#7C9A7E",
        "sage-light": "#A5BCA7",
        "sage-dark": "#5A7A5C",
        charcoal: "#2C2C2C",
        "charcoal-light": "#4A4A4A",
        "charcoal-muted": "#6B6B6B",
        parchment: "#F5F0E8",
        "border-soft": "rgba(0,0,0,0.08)",
      },
      fontFamily: {
        serif: ["DMSerifDisplay_400Regular"],
        sans: ["Inter_400Regular"],
        "sans-semibold": ["Inter_600SemiBold"],
      },
      borderRadius: {
        "4xl": "2rem",
        "5xl": "2.5rem",
      },
    },
  },
  plugins: [],
};
