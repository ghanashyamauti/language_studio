/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'jspm-navy': '#1f4287',
        'jspm-blue': '#2563eb',
        'jspm-red':  '#e25162',
        'jspm-gold': '#f1c40f',
        'jspm-bg':   '#f6f7fb',
      },
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
}
