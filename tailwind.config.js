/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          0: '#0a0a0f',
          1: '#0f0f17',
          2: '#14141e',
          3: '#1a1a26',
          4: '#22222f',
        },
        accent: {
          red: '#e94560',
          teal: '#16a085',
          amber: '#f39c12',
          blue: '#7c8cf8',
        },
        company: {
          aperture: '#e94560',
          rentals: '#16a085',
          diyp: '#0096FF',
          personal: '#7c8cf8',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
