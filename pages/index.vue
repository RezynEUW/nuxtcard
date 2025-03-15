<!-- pages/index.vue -->
<template>
    <div class="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 class="mb-8 text-4xl font-bold text-casino-green-800">Card Games</h1>
      
      <div class="w-full max-w-md space-y-6">
        <NuxtLink to="/create" class="block w-full">
          <button class="w-full px-6 py-3 text-white transition rounded-lg bg-casino-green-600 hover:bg-casino-green-700">
            Create a Room
          </button>
        </NuxtLink>
        
        <NuxtLink to="/join" class="block w-full">
          <button class="w-full px-6 py-3 text-gray-800 transition bg-gray-200 rounded-lg hover:bg-gray-300">
            Join a Room
          </button>
        </NuxtLink>
      </div>
      
      <div class="flex justify-center mt-16">
        <div class="flex gap-4">
          <playing-card v-if="cardsLoaded" cid="Ah" class="transform -rotate-12"></playing-card>
          <playing-card v-if="cardsLoaded" cid="Kc" class="transform rotate-12"></playing-card>
        </div>
      </div>
    </div>
  </template>
  
  <script setup>
  import { ref, onMounted } from 'vue';
  
  const cardsLoaded = ref(false);
  
  onMounted(() => {
    // Check if CardMeister is loaded
    const checkCardsLoaded = setInterval(() => {
      if (typeof window !== 'undefined' && window.customElements && 
          window.customElements.get('playing-card')) {
        cardsLoaded.value = true;
        clearInterval(checkCardsLoaded);
      }
    }, 100);
    
    // Clear interval after 5 seconds even if not loaded
    setTimeout(() => clearInterval(checkCardsLoaded), 5000);
  });
  </script>