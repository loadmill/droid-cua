/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        shell: '#f1f4fb',
        rail: '#eaf0fb',
        line: '#cfd8ea',
        main: '#f6f8fe'
      }
    }
  },
  plugins: []
};
