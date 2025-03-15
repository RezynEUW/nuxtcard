// server/api/games/[gameId]/deck/[deckId]/shuffle.js
import { getCardService } from '../../../../../services/card-service';
import { query } from '../../../../../db';

export default defineEventHandler(async (event) => {
  const method = getMethod(event);
  const gameId = getRouterParam(event, 'gameId');
  const deckId = getRouterParam(event, 'deckId');
  const cardService = getCardService();
  
  // POST /api/games/:gameId/deck/:deckId/shuffle - Shuffle a deck
  if (method === 'POST') {
    const body = await readBody(event);
    const { sessionId } = body;
    
    if (!sessionId) {
      throw createError({
        statusCode: 401,
        message: 'Unauthorized'
      });
    }
    
    // Verify game and deck exist
    const gameResult = await query(
      `SELECT g.*, r.room_id FROM games g 
       JOIN rooms r ON g.room_id = r.room_id 
       JOIN decks d ON d.deck_id = $1 
       WHERE g.game_id = $2`,
      [deckId, gameId]
    );
    
    if (gameResult.rows.length === 0) {
      throw createError({
        statusCode: 404,
        message: 'Game or deck not found'
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
    
    // Shuffle the deck
    const shuffledDeck = await cardService.shuffleDeck(deckId);
    
    return { deck: shuffledDeck };
  }
});