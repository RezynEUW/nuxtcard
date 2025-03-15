// server/api/games/[gameId]/hands/[handId]/stand.js
import { getCardService } from '../../../../../services/card-service';
import { query } from '../../../../../db';

export default defineEventHandler(async (event) => {
  const method = getMethod(event);
  const gameId = getRouterParam(event, 'gameId');
  const handId = getRouterParam(event, 'handId');
  
  // POST /api/games/:gameId/hands/:handId/stand - Stand (end turn)
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
    
    // Update hand status to stand
    await query(
      'UPDATE hands SET status = $1 WHERE hand_id = $2',
      ['stand', handId]
    );
    
    // Find next player's turn
    // For now, we'll just return success
    // In a real implementation, you'd move to the next player or dealer's turn
    
    return {
      success: true,
      message: 'Player stands',
      hand: {
        ...hand,
        status: 'stand'
      }
    };
  }
});