/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/pages/HealingWingsHome.tsx',
    './src/components/hw/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Cause-driven palette
        hw: {
          purple:  '#6B21A8',
          purpleLight: '#7C3AED',
          teal:    '#0D9488',
          tealDark: '#0F766E',
          navy:    '#1E3A5F',
          navyAlt: '#1E40AF',
          magenta: '#E11D74',
          magentaHover: '#BE185D',
          magentaAlt: '#DB2777',
          bg:      '#FAFAF9',
          muted:   '#F5F5F4',
          lavender: '#F5F3FF',
          dark:    '#1C1917',
        },
        teal: {
          300: '#5eead4',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
        },
        purple: {
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#d8b4fe',
          600: '#9333ea',
          700: '#7C3AED',
          800: '#6B21A8',
          900: '#581c87',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Poppins', 'system-ui', 'sans-serif'],
        serif: ['Georgia', 'Times New Roman', 'serif'],
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.7s ease-out forwards',
        'fade-in': 'fadeIn 0.6s ease-out forwards',
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
