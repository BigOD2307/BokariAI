import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';
import headlessui from '@headlessui/tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Instrument Serif', 'Georgia', 'serif'],
        // Bokari Canvas playful display + handwritten accents
        display: ['Chewy', 'system-ui', 'cursive'],
        hand: ['"Patrick Hand"', 'Comic Sans MS', 'cursive'],
      },
      colors: {
        // shadcn CSS variable colors
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: { DEFAULT: 'var(--card)', foreground: 'var(--card-foreground)' },
        popover: { DEFAULT: 'var(--popover)', foreground: 'var(--popover-foreground)' },
        primary: { DEFAULT: 'var(--primary)', foreground: 'var(--primary-foreground)' },
        secondary: { DEFAULT: 'var(--secondary)', foreground: 'var(--secondary-foreground)' },
        muted: { DEFAULT: 'var(--muted)', foreground: 'var(--muted-foreground)' },
        accent: { DEFAULT: 'var(--accent)', foreground: 'var(--accent-foreground)' },
        destructive: { DEFAULT: 'var(--destructive)' },
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        // Brand
        bokari: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
        sand: {
          100: '#faf6ee',
          200: '#f0e6d0',
          300: '#e6cfa7',
          400: '#d4b483',
          500: '#c49a5c',
          600: '#a67c3d',
        },
        // Surfaces
        light: {
          primary: '#ffffff',
          secondary: '#f9fafb',
          50: '#ffffff',
          100: '#f9fafb',
          200: '#f3f4f6',
          300: '#e5e7eb',
        },
        dark: {
          primary: '#0a0a0a',
          secondary: '#111111',
          50: '#0a0a0a',
          100: '#111111',
          200: '#1a1a1a',
          300: '#262626',
        },
      },
      borderColor: {
        light: {
          50: '#ffffff',
          100: '#f9fafb',
          200: '#e5e7eb',
          300: '#d1d5db',
        },
        dark: {
          50: '#0a0a0a',
          100: '#111111',
          200: '#1a1a1a',
          300: '#262626',
        },
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        'soft': '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)',
        'medium': '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -2px rgba(0,0,0,0.03)',
        'elevated': '0 10px 25px -5px rgba(0,0,0,0.06), 0 8px 10px -6px rgba(0,0,0,0.04)',
        'glow-teal': '0 0 20px rgba(20,184,166,0.1)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'float-orb': {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%': { transform: 'translate(20px, -20px) scale(1.03)' },
          '66%': { transform: 'translate(-15px, 15px) scale(0.97)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'spin-slow': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out',
        'slide-up': 'slide-up 0.5s ease-out',
        'float-orb': 'float-orb 25s ease-in-out infinite',
        shimmer: 'shimmer 1.5s infinite',
        'spin-slow': 'spin-slow 3s linear infinite',
      },
    },
  },
  plugins: [
    typography,
    headlessui({ prefix: 'headless' }),
  ],
};
export default config;
