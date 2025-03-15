// server/api/rooms/[roomCode]/join.js
import { query } from '../../../db';

export default defineEventHandler(async (event) => {
  const method = getMethod(event);
  const roomCode = getRouterParam(event, 'roomCode');
  
  // POST /api/rooms/:roomCode/join - Join a room
  if (method === 'POST') {
    const body = await readBody(event);
    const { nickname } = body;
    
    if (!nickname) {
      throw createError({
        statusCode: 400,
        message: 'Nickname is required'
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
    
    // Check if nickname is already taken in this room
    const existingPlayerResult = await query(
      'SELECT * FROM players WHERE room_id = $1 AND nickname = $2',
      [room.room_id, nickname]
    );
    
    if (existingPlayerResult.rows.length > 0) {
      throw createError({
        statusCode: 400,
        message: 'Nickname already taken in this room'
      });
    }
    
    // Create session ID for player
    const sessionId = crypto.randomUUID();
    
    // Create the player
    const playerResult = await query(
      'INSERT INTO players (room_id, nickname, session_id) VALUES ($1, $2, $3) RETURNING *',
      [room.room_id, nickname, sessionId]
    );
    
    const player = playerResult.rows[0];
    
    return {
      room,
      player,
      sessionId
    };
  }
});