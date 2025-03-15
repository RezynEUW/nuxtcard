// server/api/games/[gameId]/deck.js
import { getCardService } from '../../../services/card-service';
import { query } from '../../../db';

export default defineEventHandler(async (event) => {
  const method = getMethod(event);
  const gameId = getRouterParam(event, 'gameId');
  const cardService = getCardService();
  
  // POST /api/games/:gameId/deck - Create a new deck
  if (method === 'POST') {
    const body = await readBody(event);
    const { deckCount = 6, sessionId } = body;
    
    if (!sessionId) {
      throw createError({
        statusCode: 401,
        message: 'Unauthorized'
      });
    }
    
    // Verify game exists
    const gameResult = await query(
      'SELECT g.*, r.room_id FROM games g JOIN rooms r ON g.room_id = r.room_id WHERE g.game_id = $1',
      [gameId]
    );
    
    if (gameResult.rows.length === 0) {
      throw createError({
        statusCode: 404,
        message: 'Game not found'
      });
    }
    
    const game = gameResult.rows[0];
    
    // Verify player is in the game
    const playerResult = await query(
      'SELECT * FROM players WHERE room_id = $1 AND session_id = $2',
      [game.room_id, sessionId]
    );
    
    if (playerResult.rows.length === 0) {
      throw createError({
        statusCode: 403,
        message: 'Player not in this game'
      });
    }
    
    // Create the deck
    const deck = await cardService.createDeck(gameId, deckCount);
    
    // Update game with deck ID
    await query(
      'UPDATE games SET deck_id = $1 WHERE game_id = $2',
      [deck.deck_id, gameId]
    );
    
    return { deck };
  }
});