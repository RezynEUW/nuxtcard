<!-- pages/join.vue -->
<template>
    <div class="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 class="mb-8 text-3xl font-bold text-casino-green-800">Join a Game Room</h1>
      
      <div v-if="roomStore.error" class="w-full max-w-md p-3 mb-4 text-red-800 bg-red-100 rounded-lg">
        {{ roomStore.error }}
      </div>
      
      <div class="w-full max-w-md p-6 bg-white rounded-lg shadow">
        <form @submit.prevent="joinRoom">
          <div class="mb-4">
            <label class="block mb-2 text-gray-700" for="nickname">Your Nickname</label>
            <input
              id="nickname"
              v-model="nickname"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-casino-green-500"
              required
            />
          </div>
          
          <div class="mb-4">
            <label class="block mb-2 text-gray-700" for="roomCode">Room Code</label>
            <input
              id="roomCode"
              v-model="roomCode"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-casino-green-500"
              placeholder="ABCDEF"
              required
              maxlength="6"
              @input="formatRoomCode"
            />
          </div>
          
          <button
            type="submit"
            class="w-full px-6 py-3 text-white transition rounded-lg bg-casino-green-600 hover:bg-casino-green-700"
            :disabled="roomStore.loading"
          >
            {{ roomStore.loading ? 'Joining...' : 'Join Room' }}
          </button>
        </form>
      </div>
      
      <NuxtLink to="/" class="mt-6 text-casino-green-700 hover:underline">
        Back to Home
      </NuxtLink>
    </div>
  </template>
  
  <script setup>
  import { ref } from 'vue';
  import { useRoomStore } from '~/stores/room';
  
  const router = useRouter();
  const roomStore = useRoomStore();
  
  const nickname = ref('');
  const roomCode = ref('');
  
  function formatRoomCode() {
    // Convert to uppercase
    roomCode.value = roomCode.value.toUpperCase();
  }
  
  async function joinRoom() {
    try {
      await roomStore.joinRoom(roomCode.value, nickname.value);
      router.push(`/lobby/${roomCode.value}`);
    } catch (error) {
      // Error is already handled in the store
      console.error('Failed to join room:', error);
    }
  }
  </script>