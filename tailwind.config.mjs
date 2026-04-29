/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Menlo', 'Consolas', 'monospace'],
      },
      colors: {
        forest: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          200: '#d8f3dc',
          300: '#52B788',
          400: '#40916C',
          500: '#2D6A4F',
          600: '#1B4332',
          700: '#143026',
        },
      },
      typography: {
        DEFAULT: {
          css: {
            '--tw-prose-headings': '#1B4332',
          },
        },
      },
    },
  },
  plugins: [],
};
