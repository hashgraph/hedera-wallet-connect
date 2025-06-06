const { fontFamily } = require('tailwindcss/defaultTheme')

/** @type {import('tailwindcss').Config} */
module.exports = {
  corePlugins: {
    preflight: false,
    container: false,
  },
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./src/**/*.{jsx,tsx,html}'],
  theme: {
    extend: {
      borderRadius: {
        sm: '4px',
      },
      screens: {
        sm: '0px',
        lg: '997px',
      },
    },
  },
  plugins: [],
}
