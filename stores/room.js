// stores/room.js
import { defineStore } from 'pinia';
import { apiRequest } from '~/utils/api';

export const useRoomStore = defineStore('room', {
  state: () => ({
    currentRoom: null,
    roomCode: null,
    players: [],
    loading: false,
    error: null,
  }),
  
  getters: {
    isHost: (state) => {
      const playerId = localStorage.getItem('playerId');
      // Use player_id instead of session_id since we don't return session_id from the API
      const player = state.players.find(p => p.player_id === playerId);
      return player?.is_host || false;
    },
    
    allPlayersReady: (state) => {
      return state.players.length > 0 && state.players.every(p => p.is_ready);
    }
  },
  
  actions: {
    async createRoom(nickname, gameType = 'blackjack') {
      this.loading = true;
      this.error = null;
      
      try {
        const result = await apiRequest('rooms', {
          method: 'POST',
          body: { nickname, gameType }
        });
        
        this.currentRoom = result.room;
        this.roomCode = result.room.room_code;
        this.players = [result.player];
        
        // Save session ID in local storage
        localStorage.setItem('sessionId', result.sessionId);
        localStorage.setItem('playerId', result.player.player_id);
        localStorage.setItem('roomCode', result.room.room_code);
        
        return result;
      } catch (error) {
        this.error = error.message;
        throw error;
      } finally {
        this.loading = false;
      }
    },
    
    async joinRoom(roomCode, nickname) {
      this.loading = true;
      this.error = null;
      
      try {
        const result = await apiRequest(`rooms/${roomCode}/join`, {
          method: 'POST',
          body: { nickname }
        });
        
        this.currentRoom = result.room;
        this.roomCode = result.room.room_code;
        this.players = await this.fetchPlayers(roomCode);
        
        // Save session ID in local storage
        localStorage.setItem('sessionId', result.sessionId);
        localStorage.setItem('playerId', result.player.player_id);
        localStorage.setItem('roomCode', result.room.room_code);
        
        return result;
      } catch (error) {
        this.error = error.message;
        throw error;
      } finally {
        this.loading = false;
      }
    },
    
    async fetchRoomDetails(roomCode) {
      this.loading = true;
      this.error = null;
      
      try {
        const result = await apiRequest(`rooms/${roomCode}`);
        
        this.currentRoom = result.room;
        this.roomCode = result.room.room_code;
        this.players = result.players;
        
        return result;
      } catch (error) {
        this.error = error.message;
        throw error;
      } finally {
        this.loading = false;
      }
    },
    
    async fetchPlayers(roomCode) {
      try {
        const result = await apiRequest(`rooms/${roomCode}`);
        return result.players;
      } catch (error) {
        console.error('Error fetching players:', error);
        return [];
      }
    },
    
    async toggleReady(playerId, isReady) {
      this.loading = true;
      this.error = null;
      
      try {
        const sessionId = localStorage.getItem('sessionId');
        
        const result = await apiRequest(`players/${playerId}/ready`, {
          method: 'POST',
          body: { sessionId, isReady }
        });
        
        // Update player in players array
        const index = this.players.findIndex(p => p.player_id === playerId);
        if (index !== -1) {
          this.players[index] = result.player;
        }
        
        return result;
      } catch (error) {
        this.error = error.message;
        throw error;
      } finally {
        this.loading = false;
      }
    },
    
    async startGame() {
      this.loading = true;
      this.error = null;
      
      try {
        const sessionId = localStorage.getItem('sessionId');
        
        const result = await apiRequest(`rooms/${this.roomCode}/start`, {
          method: 'POST',
          body: { sessionId }
        });
        
        return result;
      } catch (error) {
        this.error = error.message;
        throw error;
      } finally {
        this.loading = false;
      }
    },
    
    resetRoom() {
      this.currentRoom = null;
      this.roomCode = null;
      this.players = [];
      this.error = null;
    }
  }
});