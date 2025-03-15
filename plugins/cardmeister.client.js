// plugins/cardmeister.client.js
export default defineNuxtPlugin((nuxtApp) => {
    // Only load in client-side context
    if (process.client) {
      const script = document.createElement('script');
      script.src = '/cardmeister/elements.cardmeister.full.js';
      script.async = true;
      document.head.appendChild(script);
    }
  });