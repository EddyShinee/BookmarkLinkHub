/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontSize: {
        'ui-xs': ['11px', { lineHeight: '1.35' }],
        'ui-sm': ['12px', { lineHeight: '1.4' }],
        'ui': ['13px', { lineHeight: '1.45' }],
        'ui-md': ['14px', { lineHeight: '1.4' }],
      },
      spacing: {
        'btn-y': '6px',
        'btn-x': '10px',
      },
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        main: 'var(--color-main, #0F172A)',
        sidebar: 'var(--color-sidebar, #1E293B)',
        card: 'rgba(30, 41, 59, 0.7)',
        'card-hover': 'rgba(51, 65, 85, 0.8)',
        accent: '#818CF8',
        'accent-glow': 'rgba(129, 140, 248, 0.3)',
        text: {
          primary: 'var(--color-text-primary, #F1F5F9)',
          secondary: 'var(--color-text-secondary, #94A3B8)',
          muted: 'var(--color-text-muted, #64748B)',
        },
        border: 'var(--color-border, rgba(255, 255, 255, 0.08))',
      },
      fontFamily: {
        display: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
        subtle: '0 2px 10px rgba(0,0,0,0.2)',
      },
    },
  },
  plugins: [],
};
