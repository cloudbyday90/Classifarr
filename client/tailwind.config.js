/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#1a1d24',
        sidebar: '#12141a',
        card: '#242731',
        primary: '#3b82f6',
        success: '#22c55e',
        warning: '#f59e0b',
        error: '#ef4444',
        text: '#e5e7eb',
        'text-muted': '#9ca3af',
      },
    },
  },
  plugins: [],
}
