// server/services/card-service.js
import { query } from '../db';
import { generateDeck, shuffleArray } from '../utils/card-utils';

export class CardService {
  /**
   * Create a new deck for a game
   * @param {string} gameId Game ID
   * @param {number} deckCount Number of decks to use
   * @returns {Promise<Object>} Created deck
   */
  async createDeck(gameId, deckCount = 6) {
    // Generate cards
    const cards = generateDeck(deckCount);
    
    // Shuffle cards
    const shuffledCards = shuffleArray(cards);
    
    // Save to database
    const result = await query(
      'INSERT INTO decks (game_id, remaining_cards) VALUES ($1, $2) RETURNING *',
      [gameId, JSON.stringify(shuffledCards)]
    );
    
    return result.rows[0];
  }
  
  /**
   * Shuffle an existing deck
   * @param {string} deckId Deck ID
   * @returns {Promise<Object>} Updated deck
   */
  async shuffleDeck(deckId) {
    // Get current deck
    const deckResult = await query(
      'SELECT * FROM decks WHERE deck_id = $1',
      [deckId]
    );
    
    if (deckResult.rows.length === 0) {
      throw new Error('Deck not found');
    }
    
    const deck = deckResult.rows[0];
    const cards = shuffleArray(deck.remaining_cards);
    
    // Update in database
    const result = await query(
      'UPDATE decks SET remaining_cards = $1, updated_at = NOW() WHERE deck_id = $2 RETURNING *',
      [JSON.stringify(cards), deckId]
    );
    
    return result.rows[0];
  }
  
  /**
   * Draw cards from a deck
   * @param {string} deckId Deck ID
   * @param {number} count Number of cards to draw
   * @returns {Promise<Array>} Drawn cards
   */
  async drawCards(deckId, count = 1) {
    // Get current deck
    const deckResult = await query(
      'SELECT * FROM decks WHERE deck_id = $1',
      [deckId]
    );
    
    if (deckResult.rows.length === 0) {
      throw new Error('Deck not found');
    }
    
    const deck = deckResult.rows[0];
    const remainingCards = [...deck.remaining_cards];
    
    if (remainingCards.length < count) {
      throw new Error('Not enough cards remaining in the deck');
    }
    
    // Draw from the top of the deck
    const drawnCards = remainingCards.splice(0, count);
    
    // Update the deck
    await query(
      'UPDATE decks SET remaining_cards = $1, updated_at = NOW() WHERE deck_id = $2',
      [JSON.stringify(remainingCards), deckId]
    );
    
    return drawnCards;
  }
  
  /**
   * Deal initial cards for a blackjack game
   * @param {string} gameId Game ID
   * @returns {Promise<Object>} Deal result with hands
   */
  async dealInitialBlackjackHands(gameId) {
    // Get game and players
    const gameResult = await query(
      'SELECT * FROM games WHERE game_id = $1',
      [gameId]
    );
    
    if (gameResult.rows.length === 0) {
      throw new Error('Game not found');
    }
    
    const game = gameResult.rows[0];
    
    // Get players in the game
    const playersResult = await query(
      'SELECT * FROM players WHERE room_id = $1 AND is_ready = TRUE',
      [game.room_id]
    );
    
    const players = playersResult.rows;
    
    // Create a deck if needed
    let deckId;
    if (!game.deck_id) {
      const deck = await this.createDeck(gameId, 6); // Use 6 decks for blackjack
      deckId = deck.deck_id;
      
      // Update game with deck ID
      await query(
        'UPDATE games SET deck_id = $1 WHERE game_id = $2',
        [deckId, gameId]
      );
    } else {
      deckId = game.deck_id;
    }
    
    // Create a hand for each player
    const playerHands = [];
    for (const player of players) {
      const handResult = await query(
        'INSERT INTO hands (game_id, player_id) VALUES ($1, $2) RETURNING *',
        [gameId, player.player_id]
      );
      
      playerHands.push(handResult.rows[0]);
    }
    
    // Create a dealer hand
    const dealerHandResult = await query(
      'INSERT INTO hands (game_id, is_dealer) VALUES ($1, TRUE) RETURNING *',
      [gameId]
    );
    
    const dealerHand = dealerHandResult.rows[0];
    
    // Deal two cards to each player (including dealer)
    for (let round = 0; round < 2; round++) {
      // Deal to players first
      for (const hand of playerHands) {
        const [cardCode] = await this.drawCards(deckId, 1);
        await query(
          'INSERT INTO cards (hand_id, card_code, position, is_face_up) VALUES ($1, $2, $3, $4)',
          [hand.hand_id, cardCode, round, true]
        );
      }
      
      // Deal to dealer
      const [cardCode] = await this.drawCards(deckId, 1);
      await query(
        'INSERT INTO cards (hand_id, card_code, position, is_face_up) VALUES ($1, $2, $3, $4)',
        [dealerHand.hand_id, cardCode, round, round === 0] // Second card face down
      );
    }
    
    // Set first player's turn
    if (playerHands.length > 0) {
      await query(
        'UPDATE games SET current_turn = $1, status = $2 WHERE game_id = $3',
        [playerHands[0].player_id, 'active', gameId]
      );
    }
    
    // Get the hands with their cards
    const handsWithCards = await this.getHandsWithCards(gameId);
    
    return {
      gameId,
      deckId,
      hands: handsWithCards
    };
  }
  
  /**
   * Get all hands for a game with their cards
   * @param {string} gameId Game ID
   * @returns {Promise<Array>} Hands with cards
   */
  async getHandsWithCards(gameId) {
    const handsResult = await query(
      'SELECT * FROM hands WHERE game_id = $1',
      [gameId]
    );
    
    const hands = handsResult.rows;
    
    // Get cards for each hand
    for (const hand of hands) {
      const cardsResult = await query(
        'SELECT * FROM cards WHERE hand_id = $1 ORDER BY position',
        [hand.hand_id]
      );
      
      hand.cards = cardsResult.rows;
    }
    
    return hands;
  }
}