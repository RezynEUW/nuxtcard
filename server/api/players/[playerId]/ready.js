// server/api/players/[playerId]/ready.js
import { query } from '../../../db';

export default defineEventHandler(async (event) => {
  const method = getMethod(event);
  const playerId = getRouterParam(event, 'playerId');
  
  // POST /api/players/:playerId/ready - Toggle ready status
  if (method === 'POST') {
    const body = await readBody(event);
    const { sessionId, isReady } = body;
    
    if (!sessionId) {
      throw createError({
        statusCode: 401,
        message: 'Unauthorized'
      });
    }
    
    // Verify player ownership with session ID
    const playerResult = await query(
      'SELECT * FROM players WHERE player_id = $1 AND session_id = $2',
      [playerId, sessionId]
    );
    
    if (playerResult.rows.length === 0) {
      throw createError({
        statusCode: 403,
        message: 'Forbidden'
      });
    }
    
    // Update player ready status
    const updateResult = await query(
      'UPDATE players SET is_ready = $1, updated_at = NOW() WHERE player_id = $2 RETURNING *',
      [isReady, playerId]
    );
    
    return {
      player: updateResult.rows[0]
    };
  }
});