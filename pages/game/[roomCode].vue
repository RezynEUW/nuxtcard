<!-- pages/game/[roomCode].vue -->
<template>
    <div class="min-h-screen bg-gray-100">
      <div class="p-4 mx-auto max-w-7xl">
        <div class="flex items-center justify-between mb-4">
          <h1 class="text-2xl font-bold text-casino-green-800">
            Room: {{ roomCode }}
          </h1>
          
          <div v-if="gameStore.error" class="px-4 py-2 text-red-800 bg-red-100 rounded">
            {{ gameStore.error }}
          </div>
          
          <div>
            <button 
              class="px-4 py-2 text-white transition bg-red-600 rounded hover:bg-red-700"
              @click="leaveGame"
            >
              Leave Game
            </button>
          </div>
        </div>
        
        <!-- Game Board -->
        <div class="bg-casino-green-800 rounded-xl shadow-xl p-8 min-h-[70vh] relative">
          <div v-if="gameStore.loading" class="absolute inset-0 z-10 flex items-center justify-center bg-black bg-opacity-50">
            <div class="w-16 h-16 border-b-4 border-white rounded-full animate-spin"></div>
          </div>
          
          <!-- Dealer Area -->
          <div class="mb-12">
            <div class="mb-2 text-lg text-white">Dealer</div>
            <div class="flex gap-2">
              <Card 
                v-for="(card, index) in dealerCards" 
                :key="index"
                :card-code="card.card_code"
                :face-up="card.is_face_up"
                :animation-class="index === dealerCards.length - 1 ? 'animate-deal' : ''"
              />
            </div>
          </div>
          
          <!-- Player Area -->
          <div>
            <div class="mb-2 text-lg text-white">Your Hand</div>
            <div class="flex gap-2 mb-6">
              <Card 
                v-for="(card, index) in playerCards" 
                :key="index"
                :card-code="card.card_code"
                :face-up="true"
                :animation-class="index === playerCards.length - 1 ? 'animate-deal' : ''"
              />
            </div>
            
            <!-- Action Buttons -->
            <div class="flex gap-3 mt-6">
              <button 
                class="px-6 py-2 font-medium transition bg-white rounded text-casino-green-800 hover:bg-gray-100"
                :disabled="!canAct || gameStore.loading"
                @click="hit"
              >
                Hit
              </button>
              <button 
                class="px-6 py-2 font-medium transition bg-white rounded text-casino-green-800 hover:bg-gray-100"
                :disabled="!canAct || gameStore.loading"
                @click="stand"
              >
                Stand
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </template>
  
  <script setup>
  import { ref, computed, onMounted } from 'vue';
  import Card from '~/components/game/Card.vue';
  import { useRoomStore } from '~/stores/room';
  import { useGameStore } from '~/stores/game';
  
  const route = useRoute();
  const router = useRouter();
  const roomStore = useRoomStore();
  const gameStore = useGameStore();
  
  const roomCode = route.params.roomCode;
  const sessionId = ref(localStorage.getItem('sessionId') || '');
  const playerId = ref(localStorage.getItem('playerId') || '');
  
  const dealerCards = computed(() => {
    return gameStore.dealerHand?.cards || [];
  });
  
  const playerCards = computed(() => {
    return gameStore.playerHands[playerId.value]?.cards || [];
  });
  
  const canAct = computed(() => {
    // If it's my turn and my hand status is 'active'
    return gameStore.isMyTurn && 
           gameStore.myHand?.status === 'active' && 
           gameStore.status === 'playing';
  });
  
  onMounted(async () => {
    try {
      // Fetch room and check if game is started
      const roomDetails = await roomStore.fetchRoomDetails(roomCode);
      
      if (roomDetails.room.status !== 'active') {
        router.push(`/lobby/${roomCode}`);
        return;
      }
      
      // Get current game
      const gameId = roomDetails.room.current_game_id;
      
      if (!gameId) {
        console.error('No game ID available');
        return;
      }
      
      // Initialize game
      await gameStore.initializeGame(gameId);
      
    } catch (error) {
      console.error('Error initializing game:', error);
    }
  });
  
  async function hit() {
    try {
      if (!gameStore.myHand) return;
      await gameStore.hit(gameStore.myHand.hand_id);
    } catch (error) {
      console.error('Error performing hit:', error);
    }
  }
  
  async function stand() {
    try {
      if (!gameStore.myHand) return;
      
      const result = await gameStore.stand(gameStore.myHand.hand_id);
      
      // If this was the last player, play dealer's turn
      if (result && result.lastPlayer) {
        await gameStore.playDealerTurn();
      }
    } catch (error) {
      console.error('Error performing stand:', error);
    }
  }
  
  function leaveGame() {
    router.push('/');
    gameStore.resetGame();
    roomStore.resetRoom();
  }
  </script>
  
  <style>
  .animate-deal {
    animation: deal-animation 0.5s ease-out;
  }
  
  @keyframes deal-animation {
    0% {
      transform: translateY(-100px);
      opacity: 0;
    }
    100% {
      transform: translateY(0);
      opacity: 1;
    }
  }
  </style>