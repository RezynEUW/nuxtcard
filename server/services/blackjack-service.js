// server/services/blackjack-service.js
import { query } from '../db';
import { getCardService } from './card-service';

export class BlackjackService {
  constructor() {
    this.cardService = getCardService();
  }
  
  /**
   * Moves to the next player's turn or dealer's turn if all players are done
   * @param {string} gameId - Game ID
   * @returns {Promise<Object>} Result of turn change
   */
  async moveToNextTurn(gameId) {
    // Get game info
    const gameResult = await query(
      'SELECT * FROM games WHERE game_id = $1',
      [gameId]
    );
    
    if (gameResult.rows.length === 0) {
      throw new Error('Game not found');
    }
    
    const game = gameResult.rows[0];
    
    // Get all active player hands (not busted, not stand)
    const activeHandsResult = await query(
      `SELECT h.*, p.player_id 
       FROM hands h
       JOIN players p ON h.player_id = p.player_id 
       WHERE h.game_id = $1 AND h.is_dealer = false AND h.status = 'active'
       ORDER BY p.created_at`,
      [gameId]
    );
    
    // If there are still active hands, move to the next player
    if (activeHandsResult.rows.length > 0) {
      const nextHand = activeHandsResult.rows[0];
      
      await query(
        'UPDATE games SET current_turn = $1 WHERE game_id = $2',
        [nextHand.player_id, gameId]
      );
      
      return {
        nextTurn: nextHand.player_id,
        dealerTurn: false
      };
    } else {
      // All players are done, move to dealer's turn
      await query(
        'UPDATE games SET current_turn = NULL WHERE game_id = $1',
        [gameId]
      );
      
      // Get dealer hand
      const dealerHandResult = await query(
        'SELECT * FROM hands WHERE game_id = $1 AND is_dealer = true',
        [gameId]
      );
      
      if (dealerHandResult.rows.length === 0) {
        throw new Error('Dealer hand not found');
      }
      
      const dealerHand = dealerHandResult.rows[0];
      
      // Play dealer's turn (this could also be triggered by a separate API call)
      const dealerResult = await this.playDealerTurn(gameId, dealerHand.hand_id);
      
      return {
        nextTurn: null,
        dealerTurn: true,
        dealerResult
      };
    }
  }
  
  /**
   * Plays the dealer's turn according to blackjack rules
   * @param {string} gameId - Game ID
   * @param {string} handId - Dealer's hand ID
   * @returns {Promise<Object>} Result of dealer's play
   */
  async playDealerTurn(gameId, handId) {
    // Get game info
    const gameResult = await query(
      'SELECT * FROM games WHERE game_id = $1',
      [gameId]
    );
    
    if (gameResult.rows.length === 0) {
      throw new Error('Game not found');
    }
    
    const game = gameResult.rows[0];
    
    // Reveal dealer's hole card
    await query(
      'UPDATE cards SET is_face_up = true WHERE hand_id = $1',
      [handId]
    );
    
    // Get dealer's cards
    const dealerCardsResult = await query(
      'SELECT * FROM cards WHERE hand_id = $1 ORDER BY position',
      [handId]
    );
    
    let dealerCards = dealerCardsResult.rows;
    
    // Calculate dealer's hand value
    let handValue = this.cardService.calculateHandValue(dealerCards);
    
    // Dealer must hit until 17 or higher
    while (handValue < 17) {
      // Draw a card
      const [card] = await this.cardService.drawCards(game.deck_id, 1);
      
      // Get next position
      const position = dealerCards.length;
      
      // Add card to dealer's hand
      const cardResult = await query(
        'INSERT INTO cards (hand_id, card_code, position, is_face_up) VALUES ($1, $2, $3, $4) RETURNING *',
        [handId, card, position, true]
      );
      
      const newCard = cardResult.rows[0];
      dealerCards.push(newCard);
      
      // Recalculate hand value
      handValue = this.cardService.calculateHandValue(dealerCards);
    }
    
    // Update game status to completed
    await query(
      'UPDATE games SET status = $1, ended_at = NOW() WHERE game_id = $2',
      ['completed', gameId]
    );
    
    // Determine winners (this would be more complex in a full implementation)
    // For now, just return the dealer's final hand
    
    return {
      dealerCards,
      handValue,
      busted: handValue > 21
    };
  }
}

// Create singleton instance
let blackjackService;

export const getBlackjackService = () => {
  if (!blackjackService) {
    blackjackService = new BlackjackService();
  }
  return blackjackService;
};