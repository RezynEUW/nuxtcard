<!-- pages/lobby/[roomCode].vue -->
<template>
  <div class="flex flex-col items-center justify-center min-h-screen p-4">
    <div v-if="roomStore.error" class="w-full max-w-4xl p-3 mb-4 text-red-800 bg-red-100 rounded-lg">
      {{ roomStore.error }}
    </div>
    
    <div class="w-full max-w-4xl p-6 bg-white rounded-lg shadow-lg">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-casino-green-800">
          Game Lobby: {{ roomCode }}
        </h1>
        
        <div class="flex items-center">
          <span v-if="connectionStatus === 'connected'" class="inline-block w-3 h-3 mr-2 bg-green-500 rounded-full"></span>
          <span v-else-if="connectionStatus === 'connecting'" class="inline-block w-3 h-3 mr-2 bg-yellow-500 rounded-full"></span>
          <span v-else class="inline-block w-3 h-3 mr-2 bg-red-500 rounded-full"></span>
          
          <button
            class="px-4 py-2 text-white transition rounded bg-casino-green-600 hover:bg-casino-green-700"
            :disabled="!roomStore.isHost || roomStore.players.length < 1 || !roomStore.allPlayersReady || roomStore.loading"
            @click="startGame"
          >
            {{ roomStore.loading ? 'Starting...' : 'Start Game' }}
          </button>
        </div>
      </div>
      
      <div class="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div class="md:col-span-2">
          <div class="p-4 rounded-lg bg-gray-50">
            <h2 class="mb-4 text-xl font-semibold">Players</h2>
            
            <div v-if="roomStore.loading" class="flex justify-center py-6">
              <div class="w-10 h-10 border-b-2 rounded-full animate-spin border-casino-green-600"></div>
            </div>
            
            <div v-else class="space-y-3">
              <div
                v-for="player in roomStore.players"
                :key="player.player_id"
                class="flex items-center justify-between p-3 bg-white border rounded"
              >
                <div class="flex items-center">
                  <div class="flex items-center justify-center w-10 h-10 font-bold rounded-full bg-casino-green-200 text-casino-green-800">
                    {{ player.nickname.charAt(0).toUpperCase() }}
                  </div>
                  <span class="ml-3 font-medium">{{ player.nickname }}</span>
                  <span 
                    v-if="player.is_host" 
                    class="ml-2 text-xs bg-gray-200 px-2 py-0.5 rounded"
                  >
                    Host
                  </span>
                  <span 
                    v-if="player.player_id === currentPlayerId" 
                    class="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded"
                  >
                    You
                  </span>
                </div>
                
                <div>
                  <span 
                    :class="[
                      'px-2 py-1 rounded text-sm',
                      player.is_ready ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    ]"
                  >
                    {{ player.is_ready ? 'Ready' : 'Not Ready' }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div>
          <div class="p-4 rounded-lg bg-gray-50">
            <h2 class="mb-4 text-xl font-semibold">Game Settings</h2>
            
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <span class="text-gray-700">Game Type:</span>
                <span class="font-medium">{{ roomStore.currentRoom?.game_type || 'Blackjack' }}</span>
              </div>
              
              <div class="flex items-center justify-between">
                <span class="text-gray-700">Starting Chips:</span>
                <span class="font-medium">1000</span>
              </div>
              
              <div class="flex items-center justify-between">
                <span class="text-gray-700">Connection:</span>
                <span class="font-medium">{{ connectionStatus }}</span>
              </div>
            </div>
            
            <div class="mt-6">
              <button
                class="w-full px-4 py-2 text-center text-white rounded"
                :class="currentPlayer?.is_ready ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-green-500 hover:bg-green-600'"
                :disabled="roomStore.loading"
                @click="toggleReady"
              >
                {{ currentPlayer?.is_ready ? 'Not Ready' : 'Ready' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoomStore } from '~/stores/room';

const route = useRoute();
const router = useRouter();
const roomStore = useRoomStore();

const roomCode = route.params.roomCode;
const currentPlayerId = ref(localStorage.getItem('playerId') || '');
const webSocket = ref(null);
const connectionStatus = ref('disconnected');

// Watch for changes in room status
watch(() => roomStore.currentRoom?.status, (newStatus) => {
  if (newStatus === 'active') {
    console.log('Game started, redirecting to game room');
    router.push(`/game/${roomCode}`);
  }
});

const currentPlayer = computed(() => {
  return roomStore.players.find(p => p.player_id === currentPlayerId.value);
});

function setupWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/api/socket`;
  
  connectionStatus.value = 'connecting';
  webSocket.value = new WebSocket(wsUrl);
  
  webSocket.value.onopen = () => {
    connectionStatus.value = 'connected';
    console.log('WebSocket connected');
    
    // Join the room
    webSocket.value.send(JSON.stringify({
      type: 'join_room',
      payload: { roomCode }
    }));
  };
  
  webSocket.value.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log('WebSocket message:', data);
      
      // Handle different message types
      switch (data.type) {
        case 'room_joined':
          console.log(`Joined room ${data.payload.roomCode}`);
          break;
        
        case 'player_joined':
          roomStore.fetchRoomDetails(roomCode);
          break;
        
        case 'player_updated':
          roomStore.fetchRoomDetails(roomCode);
          break;
          
        case 'room_updated':
          roomStore.fetchRoomDetails(roomCode);
          break;
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
    }
  };
  
  webSocket.value.onclose = () => {
    connectionStatus.value = 'disconnected';
    console.log('WebSocket disconnected');
    
    // Try to reconnect in 2 seconds
    setTimeout(setupWebSocket, 2000);
  };
  
  webSocket.value.onerror = (error) => {
    connectionStatus.value = 'error';
    console.error('WebSocket error:', error);
  };
}

onMounted(async () => {
  try {
    await roomStore.fetchRoomDetails(roomCode);
    
    // Check if game is already active
    if (roomStore.currentRoom?.status === 'active') {
      console.log('Game already active, redirecting to game room');
      router.push(`/game/${roomCode}`);
      return;
    }
    
    // Set up WebSocket connection
    setupWebSocket();
    
  } catch (error) {
    console.error('Error loading room details:', error);
  }
});

onUnmounted(() => {
  // Close WebSocket connection
  if (webSocket.value && webSocket.value.readyState === WebSocket.OPEN) {
    webSocket.value.close();
  }
});

async function toggleReady() {
  if (!currentPlayer.value) return;
  
  try {
    await roomStore.toggleReady(
      currentPlayer.value.player_id, 
      !currentPlayer.value.is_ready
    );
  } catch (error) {
    console.error('Error toggling ready state:', error);
  }
}

async function startGame() {
  try {
    const result = await roomStore.startGame();
    router.push(`/game/${roomCode}`);
  } catch (error) {
    console.error('Error starting game:', error);
  }
}
</script>