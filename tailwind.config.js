/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
      "./components/**/*.{js,vue,ts}",
      "./layouts/**/*.vue",
      "./pages/**/*.vue",
      "./plugins/**/*.{js,ts}",
      "./app.vue",
    ],
    theme: {
      extend: {
        colors: {
          'casino-green': {
            50: '#f0f9f1',
            100: '#dcf1e0',
            200: '#bbe3c4',
            300: '#8acf9c',
            400: '#5ab672',
            500: '#3c9d53',
            600: '#2a7f3f',
            700: '#246635',
            800: '#20522d',
            900: '#1d4428',
            950: '#0c2615',
          },
        },
      },
    },
    plugins: [],
  }