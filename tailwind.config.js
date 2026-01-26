/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#E8F4F8',
          100: '#D1E9F1',
          200: '#A3D3E3',
          300: '#75BDD5',
          400: '#47A7C7',
          500: '#1A73A8',
          600: '#156090',
          700: '#104D78',
          800: '#0B3A60',
          900: '#062748',
        },
        success: {
          50: '#E6F7EF',
          100: '#CDEFDF',
          200: '#9BDFBF',
          300: '#69CF9F',
          400: '#37BF7F',
          500: '#30B27A',
          600: '#268E62',
          700: '#1D6B4A',
          800: '#134732',
          900: '#0A241A',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
