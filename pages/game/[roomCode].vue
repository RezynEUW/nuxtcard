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
      
      <!-- Debug Controls -->
      <div class="p-2 mb-4 bg-gray-200 rounded">
        <button class="px-2 py-1 mr-2 text-sm text-white bg-blue-500 rounded" @click="logGameState">Log Game State</button>
        <button class="px-2 py-1 text-sm text-white bg-green-500 rounded" @click="refreshGame">Refresh Game</button>
      </div>
      
      <!-- Game Board -->
      <div class="bg-casino-green-800 rounded-xl shadow-xl p-8 min-h-[70vh] relative">
        <div v-if="isLoading" class="absolute inset-0 z-10 flex items-center justify-center bg-black bg-opacity-50">
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
            <div v-if="dealerCards.length === 0" class="text-gray-400">No cards dealt yet</div>
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
            <div v-if="playerCards.length === 0" class="text-gray-400">No cards dealt yet</div>
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

      <!-- Game Status -->
      <div class="p-3 mt-4 bg-white rounded shadow">
        <h3 class="font-bold">Game Status</h3>
        <p>Current Turn: {{ currentTurnPlayerName }}</p>
        <p>Your Status: {{ myHandStatus }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
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
const isLoading = ref(true);
const initAttempts = ref(0);
const maxAttempts = 3;

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

// Additional computed properties for display
const currentTurnPlayerName = computed(() => {
  const currentTurnId = gameStore.currentTurn;
  if (!currentTurnId) return 'No active turn';
  if (currentTurnId === playerId.value) return 'Your Turn!';
  
  const player = roomStore.players.find(p => p.player_id === currentTurnId);
  return player ? `${player.nickname}'s Turn` : 'Unknown Player';
});

const myHandStatus = computed(() => {
  const status = gameStore.myHand?.status;
  if (!status) return 'Waiting';
  
  switch(status) {
    case 'active': return 'Active - Make your move!';
    case 'stand': return 'Standing';
    case 'busted': return 'Busted!';
    default: return status;
  }
});

// Function to log state for debugging
function logGameState() {
  console.log('Game State:', {
    playerId: playerId.value,
    dealerHand: gameStore.dealerHand,
    playerHands: gameStore.playerHands,
    dealerCards: dealerCards.value,
    playerCards: playerCards.value,
    myHand: gameStore.myHand,
    isMyTurn: gameStore.isMyTurn,
    currentTurn: gameStore.currentTurn,
    status: gameStore.status,
    error: gameStore.error
  });
}

async function initializeGame() {
  try {
    isLoading.value = true;
    initAttempts.value++;
    
    // Fetch room and check if game is started
    const roomDetails = await roomStore.fetchRoomDetails(roomCode);
    
    if (roomDetails.room.status !== 'active') {
      router.push(`/lobby/${roomCode}`);
      return;
    }
    
    // Get current game from roomDetails
    const gameId = roomDetails.room?.options?.current_game_id || 
                  roomDetails.room?.current_game_id || 
                  roomDetails.currentGame?.game_id;
    
    if (!gameId) {
      console.error('No game ID available');
      gameStore.error = 'No active game found for this room.';
      
      // If we haven't reached max attempts, try again in 2 seconds
      if (initAttempts.value < maxAttempts) {
        setTimeout(initializeGame, 2000);
      }
      return;
    }
    
    console.log(`Initializing game with ID: ${gameId}`);
    
    // Initialize game
    await gameStore.initializeGame(gameId);
    logGameState();
    
  } catch (error) {
    console.error('Error initializing game:', error);
    gameStore.error = 'Failed to initialize game: ' + error.message;
    
    // If we haven't reached max attempts, try again in 2 seconds
    if (initAttempts.value < maxAttempts) {
      setTimeout(initializeGame, 2000);
    }
  } finally {
    isLoading.value = false;
  }
}

// Refresh game function
async function refreshGame() {
  isLoading.value = true;
  gameStore.resetGame();
  await initializeGame();
}

onMounted(() => {
  initializeGame();
});

// Watch for game status changes for debugging
watch(() => gameStore.status, (newStatus, oldStatus) => {
  console.log(`Game status changed from ${oldStatus} to ${newStatus}`);
  logGameState();
});

async function hit() {
  try {
    if (!gameStore.myHand) return;
    await gameStore.hit(gameStore.myHand.hand_id);
    logGameState();
  } catch (error) {
    console.error('Error performing hit:', error);
  }
}

async function stand() {
  try {
    if (!gameStore.myHand) return;
    
    const result = await gameStore.stand(gameStore.myHand.hand_id);
    logGameState();
    
    // If this was the last player, play dealer's turn
    if (result && result.lastPlayer) {
      await gameStore.playDealerTurn();
      logGameState();
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