// server/api/games/[gameId]/hands/[handId]/hit.js
import { getCardService } from '../../../../../services/card-service';
import { query } from '../../../../../db';

export default defineEventHandler(async (event) => {
  const method = getMethod(event);
  const gameId = getRouterParam(event, 'gameId');
  const handId = getRouterParam(event, 'handId');
  const cardService = getCardService();
  
  // POST /api/games/:gameId/hands/:handId/hit - Draw a card (hit)
  if (method === 'POST') {
    const body = await readBody(event);
    const { sessionId } = body;
    
    if (!sessionId) {
      throw createError({
        statusCode: 401,
        message: 'Unauthorized'
      });
    }
    
    // Verify hand belongs to game
    const handResult = await query(
      `SELECT h.*, g.deck_id, g.current_turn, p.session_id, p.player_id 
       FROM hands h 
       JOIN games g ON h.game_id = g.game_id 
       LEFT JOIN players p ON h.player_id = p.player_id 
       WHERE h.hand_id = $1 AND h.game_id = $2`,
      [handId, gameId]
    );
    
    if (handResult.rows.length === 0) {
      throw createError({
        statusCode: 404,
        message: 'Hand not found'
      });
    }
    
    const hand = handResult.rows[0];
    
    // Verify it's the player's turn and they own the hand
    if (hand.current_turn !== hand.player_id || hand.session_id !== sessionId) {
      throw createError({
        statusCode: 403,
        message: 'Not your turn or not your hand'
      });
    }
    
    // Draw a card
    const [card] = await cardService.drawCards(hand.deck_id, 1);
    
    // Get current position
    const positionResult = await query(
      'SELECT COALESCE(MAX(position), -1) + 1 as next_pos FROM cards WHERE hand_id = $1',
      [handId]
    );
    
    const position = positionResult.rows[0].next_pos;
    
    // Add card to hand
    const cardResult = await query(
      'INSERT INTO cards (hand_id, card_code, position, is_face_up) VALUES ($1, $2, $3, $4) RETURNING *',
      [handId, card, position, true]
    );
    
    const drawnCard = cardResult.rows[0];
    
    // Get all cards in hand
    const cardsResult = await query(
      'SELECT * FROM cards WHERE hand_id = $1 ORDER BY position',
      [handId]
    );
    
    const cards = cardsResult.rows;
    
    // Calculate hand value
    const handValue = cardService.calculateHandValue(cards);
    
    // Check for bust
    if (handValue > 21) {
      // Update hand status to busted
      await query(
        'UPDATE hands SET status = $1 WHERE hand_id = $2',
        ['busted', handId]
      );
      
      // Move to next player (functionality to be implemented)
      // For now, just return the busted status
      
      return {
        card: drawnCard,
        handValue,
        busted: true,
        hand: {
          ...hand,
          status: 'busted'
        }
      };
    }
    
    return {
      card: drawnCard,
      handValue,
      busted: false
    };
  }
});