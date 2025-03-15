// server/utils/card-utils.js
/**
 * Generates a standard 52-card deck
 * @param {number} deckCount Number of decks to include
 * @returns {Array} Array of card codes (e.g., "AS", "2H", "KD")
 */
export function generateDeck(deckCount = 1) {
    const suits = ['S', 'H', 'D', 'C'];
    const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'J', 'Q', 'K'];
    
    let cards = [];
    for (let d = 0; d < deckCount; d++) {
      for (const suit of suits) {
        for (const value of values) {
          cards.push(`${value}${suit}`);
        }
      }
    }
    
    return cards;
  }
  
  /**
   * Shuffles an array using Fisher-Yates algorithm
   * @param {Array} array Array to shuffle
   * @returns {Array} Shuffled array
   */
  export function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  }
  
  /**
   * Calculate the value of a Blackjack hand
   * @param {Array} cards Array of card codes
   * @returns {number} Hand value
   */
  export function calculateHandValue(cards) {
    let value = 0;
    let aces = 0;
    
    for (const card of cards) {
      const cardValue = card.charAt(0);
      if (cardValue === 'A') {
        aces += 1;
        value += 11;
      } else if (['K', 'Q', 'J', '0'].includes(cardValue)) {
        value += 10;
      } else {
        value += parseInt(cardValue);
      }
    }
    
    // Adjust for aces
    while (value > 21 && aces > 0) {
      value -= 10;
      aces -= 1;
    }
    
    return value;
  }
  
  /**
   * Check if a hand is a blackjack (21 with 2 cards)
   * @param {Array} cards Array of card codes
   * @returns {boolean} True if blackjack
   */
  export function isBlackjack(cards) {
    return cards.length === 2 && calculateHandValue(cards) === 21;
  }
  
  /**
   * Check if a hand is busted (over 21)
   * @param {Array} cards Array of card codes
   * @returns {boolean} True if busted
   */
  export function isBusted(cards) {
    return calculateHandValue(cards) > 21;
  }