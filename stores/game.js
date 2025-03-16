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
        console.log(`Initializing game ${gameId}...`);
        const sessionId = localStorage.getItem('sessionId');
        const playerId = localStorage.getItem('playerId');
        
        // 1. Create a new deck
        console.log('Creating deck...');
        const deckResult = await apiRequest(`games/${gameId}/deck`, {
          method: 'POST',
          body: { sessionId, deckCount: 6 }
        });
        
        this.deckId = deckResult.deck.deck_id;
        console.log(`Deck created with ID: ${this.deckId}`);
        
        // 2. Deal initial cards
        console.log('Dealing cards...');
        const dealResult = await apiRequest(`games/${gameId}/blackjack/deal`, {
          method: 'POST',
          body: { sessionId }
        });
        
        console.log('Deal result:', dealResult);
        
        // Store dealer hand
        this.dealerHand = dealResult.dealerHand;
        
        // Transform playerHands array to object with player_id as key
        const playerHandsMap = {};
        
        // Ensure playerHands is an array
        if (Array.isArray(dealResult.playerHands)) {
          dealResult.playerHands.forEach(hand => {
            if (hand && hand.player_id) {
              playerHandsMap[hand.player_id] = hand;
            }
          });
        } else {
          console.warn('Expected playerHands to be an array but got:', dealResult.playerHands);
        }
        
        console.log('Player hands map:', playerHandsMap);
        console.log('Current player ID:', playerId);
        
        this.playerHands = playerHandsMap;
        this.currentGame = { game_id: gameId };
        this.status = 'playing';
        
        // Get current turn from dealResult 
        this.currentTurn = dealResult.currentTurn;
        
        // If dealer doesn't have cards assigned, try to fix
        if (this.dealerHand && (!this.dealerHand.cards || this.dealerHand.cards.length === 0)) {
          console.warn('Dealer hand has no cards, this should not happen');
        }
        
        // If player hand doesn't have cards assigned, try to fix
        if (playerHandsMap[playerId] && (!playerHandsMap[playerId].cards || playerHandsMap[playerId].cards.length === 0)) {
          console.warn('Player hand has no cards, this should not happen');
        }
        
        return dealResult;
      } catch (error) {
        console.error('Error initializing game:', error);
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
        
        console.log(`Player ${playerId} hitting hand ${handId}`);
        
        const result = await apiRequest(`games/${this.currentGame.game_id}/hands/${handId}/hit`, {
          method: 'POST',
          body: { sessionId }
        });
        
        console.log('Hit result:', result);
        
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
        console.error('Error performing hit:', error);
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
        
        console.log(`Player ${playerId} standing on hand ${handId}`);
        
        const result = await apiRequest(`games/${this.currentGame.game_id}/hands/${handId}/stand`, {
          method: 'POST',
          body: { sessionId }
        });
        
        console.log('Stand result:', result);
        
        // Update hand status
        if (this.playerHands[playerId]) {
          this.playerHands[playerId].status = 'stand';
        }
        
        return result;
      } catch (error) {
        console.error('Error performing stand:', error);
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
        
        console.log('Playing dealer turn');
        
        const result = await apiRequest(`games/${this.currentGame.game_id}/dealer`, {
          method: 'POST',
          body: { sessionId }
        });
        
        console.log('Dealer result:', result);
        
        // Update dealer hand
        if (result.dealer && result.dealer.dealerCards) {
          this.dealerHand.cards = result.dealer.dealerCards;
        }
        
        // Update game status
        this.status = 'completed';
        
        return result;
      } catch (error) {
        console.error('Error in dealer turn:', error);
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