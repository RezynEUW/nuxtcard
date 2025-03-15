// server/api/rooms/index.js
import { query } from '../../db';

export default defineEventHandler(async (event) => {
  const method = getMethod(event);

  // GET /api/rooms - List rooms
  if (method === 'GET') {
    const result = await query(
      'SELECT room_id, room_code, game_type, status, created_at FROM rooms WHERE status = $1 ORDER BY created_at DESC LIMIT 10',
      ['waiting']
    );
    return { rooms: result.rows };
  }

  // POST /api/rooms - Create a new room
  if (method === 'POST') {
    const body = await readBody(event);
    const { nickname, gameType = 'blackjack' } = body;
    
    if (!nickname) {
      throw createError({
        statusCode: 400,
        message: 'Nickname is required'
      });
    }

    // Generate a random 6-character room code
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // Create the room
    const roomResult = await query(
      'INSERT INTO rooms (room_code, game_type) VALUES ($1, $2) RETURNING *',
      [roomCode, gameType]
    );
    
    const room = roomResult.rows[0];
    
    // Create session ID for player
    const sessionId = crypto.randomUUID();
    
    // Create the player as host
    const playerResult = await query(
      'INSERT INTO players (room_id, nickname, session_id, is_host) VALUES ($1, $2, $3, $4) RETURNING *',
      [room.room_id, nickname, sessionId, true]
    );
    
    const player = playerResult.rows[0];
    
    return {
      room,
      player,
      sessionId
    };
  }
});