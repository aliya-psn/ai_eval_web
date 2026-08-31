/** @type {import('tailwindcss').Config} */
const path = require('path');

module.exports = {
  content: [
    path.resolve(__dirname, './src/**/*.{js,ts,jsx,tsx}'),
    path.resolve(__dirname, './src/**/*.css'),
  ],
  theme: {
    extend: {
      colors: {
        border: { DEFAULT: 'rgb(226 232 240)' },
        background: { DEFAULT: 'rgb(255 255 255)' },
        foreground: { DEFAULT: 'rgb(15 23 42)' },
        card: { DEFAULT: 'rgb(255 255 255)', foreground: 'rgb(15 23 42)' },
        popover: { DEFAULT: 'rgb(255 255 255)', foreground: 'rgb(15 23 42)' },
        primary: { DEFAULT: 'rgb(59 130 246)', foreground: 'rgb(255 255 255)' },
        secondary: { DEFAULT: 'rgb(241 245 249)', foreground: 'rgb(15 23 42)' },
        muted: { DEFAULT: 'rgb(241 245 249)', foreground: 'rgb(100 116 139)' },
        accent: { DEFAULT: 'rgb(241 245 249)', foreground: 'rgb(15 23 42)' },
        destructive: { DEFAULT: 'rgb(239 68 68)', foreground: 'rgb(255 255 255)' },
        input: { DEFAULT: 'rgb(226 232 240)' },
        ring: { DEFAULT: 'rgb(59 130 246)' },
      },
      borderRadius: {
        lg: '0.75rem',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};