/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        heading: ['Instrument Serif', 'serif'],
        body: ['Barlow', 'sans-serif'],
        dirtyline: ['Dirtyline', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '9999px',
      },
      colors: {
        accent: {
          cyan: '#00d4ff',
          violet: '#7c3aed',
          emerald: '#10b981',
          amber: '#f59e0b',
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 8s linear infinite',
      },
    },
  },
  plugins: [],
}
