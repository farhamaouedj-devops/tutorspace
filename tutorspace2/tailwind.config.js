/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
      },
      colors: {
        ink: '#0f0e0b',
        paper: '#faf7f0',
        amber: { DEFAULT: '#e8a030', light: '#f5c060', dark: '#b87a18' },
        slate: { mid: '#3d4a5c', light: '#566070' },
      },
    },
  },
  plugins: [],
}
