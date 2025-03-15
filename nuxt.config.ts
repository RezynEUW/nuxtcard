// nuxt.config.ts
export default defineNuxtConfig({
  devtools: { enabled: true },
  css: ['~/assets/css/tailwind.css'],

  modules: [
    '@pinia/nuxt',
  ],

  runtimeConfig: {
    dbUrl: process.env.NEON_DB_URL,
    public: {
      websocketUrl: process.env.WEBSOCKET_URL || '',
    }
  },

  app: {
    head: {
      title: 'Card Games',
      meta: [
        { name: 'description', content: 'Multiplayer card games built with Nuxt.js' }
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }
      ]
    }
  },

  build: {
    transpile: ['gsap']
  },

  postcss: {
    plugins: {
      tailwindcss: {},
      autoprefixer: {}
    }
  },

  compatibilityDate: '2025-03-15'
})