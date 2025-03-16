// server/services/deck-api-service.js
import { $fetch } from 'ofetch';

const API_BASE_URL = 'https://deckofcardsapi.com/api/deck';

export class DeckApiService {
  /**
   * Create and shuffle a new deck
   * @param {number} deckCount Number of decks (1-6)
   * @returns {Promise<Object>} Created deck info
   */
  async createDeck(deckCount = 6) {
    try {
      const response = await $fetch(`${API_BASE_URL}/new/shuffle/?deck_count=${deckCount}`);
      return {
        deckId: response.deck_id,
        remaining: response.remaining,
        shuffled: response.shuffled,
        success: response.success
      };
    } catch (error) {
      console.error('Error creating deck:', error);
      throw new Error(`Failed to create deck: ${error.message}`);
    }
  }
  
  /**
   * Draw cards from a deck
   * @param {string} deckId Deck ID
   * @param {number} count Number of cards to draw
   * @returns {Promise<Object>} Drawn cards
   */
  async drawCards(deckId, count = 1) {
    try {
      const response = await $fetch(`${API_BASE_URL}/${deckId}/draw/?count=${count}`);
      
      if (!response.success) {
        throw new Error('API returned unsuccessful response');
      }
      
      return {
        cards: response.cards.map(card => ({
          code: card.code,
          value: card.value,
          suit: card.suit,
          image: card.image
        })),
        remaining: response.remaining
      };
    } catch (error) {
      console.error(`Error drawing cards from deck ${deckId}:`, error);
      throw new Error(`Failed to draw cards: ${error.message}`);
    }
  }
  
  /**
   * Shuffle an existing deck
   * @param {string} deckId Deck ID
   * @returns {Promise<Object>} Shuffle result
   */
  async shuffleDeck(deckId) {
    try {
      const response = await $fetch(`${API_BASE_URL}/${deckId}/shuffle/`);
      
      return {
        deckId: response.deck_id,
        remaining: response.remaining,
        shuffled: response.shuffled,
        success: response.success
      };
    } catch (error) {
      console.error(`Error shuffling deck ${deckId}:`, error);
      throw new Error(`Failed to shuffle deck: ${error.message}`);
    }
  }
}

// Singleton instance
let deckApiServiceInstance = null;

/**
 * Get deck API service instance
 * @returns {DeckApiService}
 */
export function getDeckApiService() {
  if (!deckApiServiceInstance) {
    deckApiServiceInstance = new DeckApiService();
  }
  return deckApiServiceInstance;
}