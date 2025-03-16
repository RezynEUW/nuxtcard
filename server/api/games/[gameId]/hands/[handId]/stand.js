// server/api/games/[gameId]/hands/[handId]/stand.js
import { query } from '../../../../../db';

export default defineEventHandler(async (event) => {
  const method = getMethod(event);
  const gameId = getRouterParam(event, 'gameId');
  const handId = getRouterParam(event, 'handId');
  
  console.log(`[stand] Processing stand request for hand ${handId} in game ${gameId}`);
  
  // POST /api/games/:gameId/hands/:handId/stand - Stand (end turn)
  if (method === 'POST') {
    const body = await readBody(event);
    const { sessionId } = body;
    
    if (!sessionId) {
      console.log(`[stand] No sessionId provided`);
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
      console.log(`[stand] Hand not found: ${handId}`);
      throw createError({
        statusCode: 404,
        message: 'Hand not found'
      });
    }
    
    const hand = handResult.rows[0];
    
    // Verify it's the player's turn and they own the hand
    if (hand.current_turn !== hand.player_id || hand.session_id !== sessionId) {
      console.log(`[stand] Not player's turn or not their hand. Current turn: ${hand.current_turn}, Player: ${hand.player_id}`);
      throw createError({
        statusCode: 403,
        message: 'Not your turn or not your hand'
      });
    }
    
    try {
      // Update hand status to stand
      await query(
        'UPDATE hands SET status = $1 WHERE hand_id = $2',
        ['stand', handId]
      );
      
      console.log(`[stand] Player ${hand.player_id} stands`);
      
      // Find the next player's turn
      // This is simplified - in a full implementation, you would check for other active hands
      const nextPlayerResult = await query(
        `SELECT p.player_id FROM players p
         JOIN hands h ON p.player_id = h.player_id
         WHERE h.game_id = $1 AND h.status = 'active' AND p.player_id != $2
         ORDER BY p.created_at
         LIMIT 1`,
        [gameId, hand.player_id]
      );
      
      let lastPlayer = false;
      
      if (nextPlayerResult.rows.length > 0) {
        const nextPlayerId = nextPlayerResult.rows[0].player_id;
        await query(
          'UPDATE games SET current_turn = $1 WHERE game_id = $2',
          [nextPlayerId, gameId]
        );
        console.log(`[stand] Next turn: ${nextPlayerId}`);
      } else {
        // All players have played, dealer's turn
        await query(
          'UPDATE games SET current_turn = NULL WHERE game_id = $1',
          [gameId]
        );
        lastPlayer = true;
        console.log(`[stand] All players done, dealer's turn next`);
      }
      
      return {
        success: true,
        message: 'Player stands',
        hand: {
          ...hand,
          status: 'stand'
        },
        lastPlayer
      };
    } catch (error) {
      console.error(`[stand] Error standing hand:`, error);
      throw createError({
        statusCode: 500,
        message: `Error standing hand: ${error.message}`
      });
    }
  }
});