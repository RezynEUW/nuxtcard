// server/api/rooms/[roomCode]/start.js
import { query } from '../../../db';

export default defineEventHandler(async (event) => {
  const method = getMethod(event);
  const roomCode = getRouterParam(event, 'roomCode');
  
  // POST /api/rooms/:roomCode/start - Start a game
  if (method === 'POST') {
    const body = await readBody(event);
    const { sessionId } = body;
    
    if (!sessionId) {
      throw createError({
        statusCode: 401,
        message: 'Unauthorized'
      });
    }
    
    // Get the room
    const roomResult = await query(
      'SELECT * FROM rooms WHERE room_code = $1 AND status = $2',
      [roomCode.toUpperCase(), 'waiting']
    );
    
    if (roomResult.rows.length === 0) {
      throw createError({
        statusCode: 404,
        message: 'Room not found or game already started'
      });
    }
    
    const room = roomResult.rows[0];
    
    // Verify player is host
    const hostResult = await query(
      'SELECT * FROM players WHERE room_id = $1 AND session_id = $2 AND is_host = TRUE',
      [room.room_id, sessionId]
    );
    
    if (hostResult.rows.length === 0) {
      throw createError({
        statusCode: 403,
        message: 'Only the host can start the game'
      });
    }
    
    // Get all players
    const playersResult = await query(
      'SELECT * FROM players WHERE room_id = $1',
      [room.room_id]
    );
    
    const players = playersResult.rows;
    
    // Need at least 1 player
    if (players.length < 1) {
      throw createError({
        statusCode: 400,
        message: 'Not enough players to start the game'
      });
    }
    
    // All players must be ready
    const notReadyPlayers = players.filter(p => !p.is_ready);
    if (notReadyPlayers.length > 0) {
      throw createError({
        statusCode: 400,
        message: 'All players must be ready to start the game'
      });
    }
    
    // Create a game
    const gameResult = await query(
      'INSERT INTO games (room_id) VALUES ($1) RETURNING *',
      [room.room_id]
    );
    
    const game = gameResult.rows[0];
    
    // Update room status and set current_game_id (this was missing!)
    const updatedRoomResult = await query(
      'UPDATE rooms SET status = $1, updated_at = NOW(), options = jsonb_set(options, \'{current_game_id}\', $2) WHERE room_id = $3 RETURNING *',
      ['active', `"${game.game_id}"`, room.room_id]
    );
    
    const updatedRoom = updatedRoomResult.rows[0];
    
    return {
      room: updatedRoom,
      game
    };
  }
});