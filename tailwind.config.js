/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // The app is a light source, so the palette is deliberately tiny:
        // true black to let the emitted ring dominate, and one signal colour.
        ink: {
          DEFAULT: '#000000',
          soft: '#0B0B0C',
          raised: '#141416',
          line: '#242427',
        },
        signal: {
          DEFAULT: '#FFD400', // the yellow from the reference hardware UI
          dim: '#8A7400',
        },
      },
      fontFamily: {
        // System faces only — no font files to load, no flash of unstyled text.
        sans: ['System'],
      },
    },
  },
  plugins: [],
};
