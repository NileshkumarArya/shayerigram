/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink:     { DEFAULT: '#0d0d1a', 50: '#1a1a2e', 100: '#16213e' },
        violet:  { DEFAULT: '#7c3aed', dark: '#5b21b6', glow: '#8b5cf6', soft: '#a78bfa' },
        gold:    { DEFAULT: '#f59e0b', light: '#fbbf24', pale: '#fde68a' },
        rose:    { DEFAULT: '#f43f5e', soft: '#fb7185' },
        glass:   { DEFAULT: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.08)' },
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        body:    ['"DM Sans"', 'sans-serif'],
        urdu:    ['"Noto Nastaliq Urdu"', 'serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
      },
      animation: {
        'fade-in':    'fadeIn 0.4s ease forwards',
        'slide-up':   'slideUp 0.4s ease forwards',
        'slide-in':   'slideIn 0.3s ease forwards',
        'pulse-glow': 'pulseGlow 2s infinite',
        'float':      'float 3s ease-in-out infinite',
        'shimmer':    'shimmer 1.5s infinite',
      },
      keyframes: {
        fadeIn:    { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp:   { from: { opacity: 0, transform: 'translateY(20px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        slideIn:   { from: { opacity: 0, transform: 'translateX(-20px)' }, to: { opacity: 1, transform: 'translateX(0)' } },
        pulseGlow: { '0%,100%': { boxShadow: '0 0 10px rgba(124,58,237,0.3)' }, '50%': { boxShadow: '0 0 30px rgba(124,58,237,0.7)' } },
        float:     { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
        shimmer:   { from: { backgroundPosition: '-200% 0' }, to: { backgroundPosition: '200% 0' } },
      },
      backdropBlur: { xs: '2px' },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'noise': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.05'/%3E%3C/svg%3E\")",
      },
    },
  },
  plugins: [],
};
