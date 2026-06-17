/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Montserrat", "sans-serif"],
        secondary: ["'Be Vietnam Pro'", "sans-serif"],
        title: ["Anton", "sans-serif"],
      },
      colors: {
        "warm-bg": "#FFFBF5",
        "summer-blue": "#92ADEF",
        "summer-teal": "#8DD4DA",
        "summer-pink": "#F4C4DC",
        "summer-yellow": "#FDE49C",
        "summer-peach": "#ECC389",
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
      keyframes: {
        'matrix-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
      },
      animation: {
        'matrix-pulse': 'matrix-pulse 0.8s ease-in-out 2',
      },
    },
  },
  plugins: [],
};
