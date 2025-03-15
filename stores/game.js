// stores/game.js
import { defineStore } from 'pinia';
import { apiRequest } from '~/utils/api';

export const useGameStore = defineStore('game', {
  state: () => ({
    currentGame: null,
    dealerHand: null,
    playerHands: {},
    currentTurn: null,
    status: 'waiting',
    deckId: null,
    loading: false,
    error: null,
  }),
  
  getters: {
    isMyTurn: (state) => {
      const playerId = localStorage.getItem('playerId');
      return state.currentTurn === playerId;
    },
    
    myHand: (state) => {
      const playerId = localStorage.getItem('playerId');
      return state.playerHands[playerId] || null;
    }
  },
  
  actions: {
    async initializeGame(gameId) {
      this.loading = true;
      this.error = null;
      
      try {
        const sessionId = localStorage.getItem('sessionId');
        
        // 1. Create a new deck
        const deckResult = await apiRequest(`games/${gameId}/deck`, {
          method: 'POST',
          body: { sessionId, deckCount: 6 }
        });
        
        this.deckId = deckResult.deck.deck_id;
        
        // 2. Deal initial cards
        const dealResult = await apiRequest(`games/${gameId}/blackjack/deal`, {
          method: 'POST',
          body: { sessionId }
        });
        
        this.dealerHand = dealResult.dealerHand;
        
        // Transform playerHands array to object with player_id as key
        const playerHandsMap = {};
        dealResult.playerHands.forEach(hand => {
          playerHandsMap[hand.player_id] = hand;
        });
        
        this.playerHands = playerHandsMap;
        this.currentGame = { game_id: gameId };
        this.status = 'playing';
        
        return dealResult;
      } catch (error) {
        this.error = error.message;
        throw error;
      } finally {
        this.loading = false;
      }
    },
    
    async hit(handId) {
      this.loading = true;
      this.error = null;
      
      try {
        const sessionId = localStorage.getItem('sessionId');
        const playerId = localStorage.getItem('playerId');
        
        const result = await apiRequest(`games/${this.currentGame.game_id}/hands/${handId}/hit`, {
          method: 'POST',
          body: { sessionId }
        });
        
        // Add the new card to the hand
        if (this.playerHands[playerId]) {
          if (!this.playerHands[playerId].cards) {
            this.playerHands[playerId].cards = [];
          }
          this.playerHands[playerId].cards.push(result.card);
          
          // Update hand status if busted
          if (result.busted) {
            this.playerHands[playerId].status = 'busted';
          }
        }
        
        return result;
      } catch (error) {
        this.error = error.message;
        throw error;
      } finally {
        this.loading = false;
      }
    },
    
    async stand(handId) {
      this.loading = true;
      this.error = null;
      
      try {
        const sessionId = localStorage.getItem('sessionId');
        const playerId = localStorage.getItem('playerId');
        
        const result = await apiRequest(`games/${this.currentGame.game_id}/hands/${handId}/stand`, {
          method: 'POST',
          body: { sessionId }
        });
        
        // Update hand status
        if (this.playerHands[playerId]) {
          this.playerHands[playerId].status = 'stand';
        }
        
        return result;
      } catch (error) {
        this.error = error.message;
        throw error;
      } finally {
        this.loading = false;
      }
    },
    
    async playDealerTurn() {
      this.loading = true;
      this.error = null;
      
      try {
        const sessionId = localStorage.getItem('sessionId');
        
        const result = await apiRequest(`games/${this.currentGame.game_id}/dealer`, {
          method: 'POST',
          body: { sessionId }
        });
        
        // Update dealer hand
        this.dealerHand.cards = result.dealer.dealerCards;
        
        // Update game status
        this.status = 'completed';
        
        return result;
      } catch (error) {
        this.error = error.message;
        throw error;
      } finally {
        this.loading = false;
      }
    },
    
    resetGame() {
      this.currentGame = null;
      this.dealerHand = null;
      this.playerHands = {};
      this.currentTurn = null;
      this.status = 'waiting';
      this.deckId = null;
      this.error = null;
    }
  }
});