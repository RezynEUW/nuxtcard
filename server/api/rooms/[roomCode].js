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
    
    return {
      room,
      players: playersResult.rows
    };
  }
});