const path = require('path');

module.exports = {
  plugins: {
    tailwindcss: {
      content: [
        path.resolve(__dirname, './src/**/*.{js,ts,jsx,tsx}'),
        path.resolve(__dirname, './src/styles.css'),
      ],
      theme: {
        extend: {
          colors: {
            border: 'hsl(214.3 31.8% 91.4%)',
            background: 'hsl(0 0% 100%)',
            foreground: 'hsl(222.2 84% 4.9%)',
            card: { DEFAULT: 'hsl(0 0% 100%)', foreground: 'hsl(222.2 84% 4.9%)' },
            popover: { DEFAULT: 'hsl(0 0% 100%)', foreground: 'hsl(222.2 84% 4.9%)' },
            primary: { DEFAULT: 'hsl(221.2 83.2% 53.3%)', foreground: 'hsl(210 40% 98%)' },
            secondary: { DEFAULT: 'hsl(210 40% 96.1%)', foreground: 'hsl(222.2 47.4% 11.2%)' },
            muted: { DEFAULT: 'hsl(210 40% 96.1%)', foreground: 'hsl(215.4 16.3% 46.9%)' },
            accent: { DEFAULT: 'hsl(210 40% 96.1%)', foreground: 'hsl(222.2 47.4% 11.2%)' },
            destructive: { DEFAULT: 'hsl(0 84.2% 60.2%)', foreground: 'hsl(210 40% 98%)' },
            input: 'hsl(214.3 31.8% 91.4%)',
            ring: 'hsl(221.2 83.2% 53.3%)',
            'markdown-pre-border': 'hsl(210 40% 96.1%)',
            'markdown-inline-border': 'hsl(210 40% 96.1%)',
          },
          borderRadius: {
            lg: '0.75rem',
          },
        },
      },
      plugins: [require('@tailwindcss/typography')],
    },
    autoprefixer: {},
  },
};