// server/api/games/[gameId]/deck/[deckId]/shuffle.js
import { getDeckApiService } from '../../../../../services/deck-api-service';
import { query } from '../../../../../db';

export default defineEventHandler(async (event) => {
  const method = getMethod(event);
  const gameId = getRouterParam(event, 'gameId');
  const deckId = getRouterParam(event, 'deckId');
  const deckApiService = getDeckApiService();
  
  console.log(`[shuffle] Processing shuffle request for game ${gameId}, deck ${deckId}`);
  
  // POST /api/games/:gameId/deck/:deckId/shuffle - Shuffle a deck
  if (method === 'POST') {
    const body = await readBody(event);
    const { sessionId } = body;
    
    if (!sessionId) {
      console.log(`[shuffle] No sessionId provided`);
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
      console.log(`[shuffle] Game not found: ${gameId}`);
      throw createError({
        statusCode: 404,
        message: 'Game not found'
      });
    }
    
    const game = gameResult.rows[0];
    
    // Verify deck exists
    const deckResult = await query(
      'SELECT * FROM decks WHERE deck_id = $1 AND game_id = $2',
      [deckId, gameId]
    );
    
    if (deckResult.rows.length === 0) {
      console.log(`[shuffle] Deck not found: ${deckId}`);
      throw createError({
        statusCode: 404,
        message: 'Deck not found'
      });
    }
    
    // Get the stored API deck ID
    const apiDeckId = deckResult.rows[0].deck_id;
    
    // Verify player is in the game
    const playerResult = await query(
      'SELECT * FROM players WHERE room_id = $1 AND session_id = $2',
      [game.room_id, sessionId]
    );
    
    if (playerResult.rows.length === 0) {
      console.log(`[shuffle] Player with sessionId ${sessionId} not found in room ${game.room_id}`);
      throw createError({
        statusCode: 403,
        message: 'Not authorized to shuffle deck'
      });
    }
    
    try {
      // Shuffle the deck using external API
      console.log(`[shuffle] Shuffling deck with external API, deckId: ${apiDeckId}`);
      const shuffleResult = await deckApiService.shuffleDeck(apiDeckId);
      
      // Update deck info in our database
      await query(
        'UPDATE decks SET updated_at = NOW() WHERE deck_id = $1',
        [deckId]
      );
      
      console.log(`[shuffle] Shuffled deck ${deckId} for game ${gameId}`);
      
      return { 
        deck: {
          deck_id: deckId,
          remaining: shuffleResult.remaining,
          shuffled: shuffleResult.shuffled
        } 
      };
    } catch (error) {
      console.error(`[shuffle] Error shuffling deck:`, error);
      throw createError({
        statusCode: 500,
        message: `Error shuffling deck: ${error.message}`
      });
    }
  }
});