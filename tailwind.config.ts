import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // PeakEstimator brand palette
        navy: {
          DEFAULT: '#1C2B5C',
          50:  '#EEF0F8',
          100: '#D3D8EF',
          200: '#A8B1DF',
          300: '#7D8ACF',
          400: '#5263BF',
          500: '#2E449F',
          600: '#1C2B5C',
          700: '#162249',
          800: '#101937',
          900: '#0A1024',
        },
        copper: {
          DEFAULT: '#C07840',
          50:  '#FAF2E9',
          100: '#F4E4D2',
          200: '#E9C8A6',
          300: '#DDAD79',
          400: '#D2914C',
          500: '#C07840',
          600: '#9F6133',
          700: '#7F4B26',
          800: '#5E361A',
          900: '#3D210E',
        },
        // Keep slate for neutrals
        dark: '#0A1024',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        inter: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      boxShadow: {
        'navy':  '0 10px 30px -5px rgba(28, 43, 92, 0.35)',
        'copper': '0 10px 30px -5px rgba(192, 120, 64, 0.35)',
        'card':  '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06)',
        'glow-navy': '0 0 40px rgba(28, 43, 92, 0.25)',
        'glow-copper': '0 0 40px rgba(192, 120, 64, 0.3)',
      },
      backgroundImage: {
        'peak-hero': 'linear-gradient(135deg, #0A1024 0%, #1C2B5C 50%, #0A1024 100%)',
        'peak-copper': 'linear-gradient(135deg, #C07840, #D2914C)',
      },
      animation: {
        'fade-in':    'fadeIn 0.25s ease-out forwards',
        'scale-in':   'scaleIn 0.2s ease-out forwards',
        'slide-up':   'slideUp 0.35s ease-out forwards',
        'float':      'float 6s ease-in-out infinite',
        'shimmer':    'shimmer 2s linear infinite',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        scaleIn: { from: { opacity: '0', transform: 'scale(0.95)' },     to: { opacity: '1', transform: 'scale(1)' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(20px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        float:   { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
        shimmer: { from: { backgroundPosition: '-200% 0' }, to: { backgroundPosition: '200% 0' } },
      },
    },
  },
  plugins: [],
};

export default config;
