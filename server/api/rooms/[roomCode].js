// server/api/rooms/[roomCode].js
import { query } from '../../db';

export default defineEventHandler(async (event) => {
  const method = getMethod(event);
  const roomCode = getRouterParam(event, 'roomCode');
  
  // GET /api/rooms/:roomCode - Get room details
  if (method === 'GET') {
    const roomResult = await query(
      'SELECT * FROM rooms WHERE room_code = $1',
      [roomCode.toUpperCase()]
    );
    
    if (roomResult.rows.length === 0) {
      throw createError({
        statusCode: 404,
        message: 'Room not found'
      });
    }
    
    const room = roomResult.rows[0];
    
    // Get players in the room
    const playersResult = await query(
      'SELECT player_id, nickname, is_host, is_ready, created_at FROM players WHERE room_id = $1 ORDER BY created_at',
      [room.room_id]
    );
    
    // Get current active game if room is active
    let currentGame = null;
    if (room.status === 'active') {
      // Try to get game ID from options first
      const currentGameId = room.options?.current_game_id;
      
      if (currentGameId) {
        const gameResult = await query(
          'SELECT * FROM games WHERE game_id = $1',
          [currentGameId]
        );
        
        if (gameResult.rows.length > 0) {
          currentGame = gameResult.rows[0];
        }
      }
      
      // If not found, get the most recent game
      if (!currentGame) {
        const gameResult = await query(
          'SELECT * FROM games WHERE room_id = $1 ORDER BY created_at DESC LIMIT 1',
          [room.room_id]
        );
        
        if (gameResult.rows.length > 0) {
          currentGame = gameResult.rows[0];
        }
      }
    }
    
    return {
      room: {
        ...room,
        current_game_id: currentGame?.game_id
      },
      players: playersResult.rows,
      currentGame
    };
  }
});