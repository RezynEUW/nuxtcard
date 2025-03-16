// server/api/games/[gameId]/deck.js
import { getDeckApiService } from '../../../services/deck-api-service';
import { query } from '../../../db';

export default defineEventHandler(async (event) => {
  const method = getMethod(event);
  const gameId = getRouterParam(event, 'gameId');
  const deckApiService = getDeckApiService();
  
  console.log(`[deck] Processing deck request for game ${gameId}, method ${method}`);
  
  // POST /api/games/:gameId/deck - Create a new deck
  if (method === 'POST') {
    const body = await readBody(event);
    const { deckCount = 6, sessionId } = body;
    
    if (!sessionId) {
      console.log(`[deck] No sessionId provided`);
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
      console.log(`[deck] Game not found: ${gameId}`);
      throw createError({
        statusCode: 404,
        message: 'Game not found'
      });
    }
    
    const game = gameResult.rows[0];
    console.log(`[deck] Found game with room_id ${game.room_id}`);
    
    // Verify player is in the game
    const playerResult = await query(
      'SELECT * FROM players WHERE room_id = $1 AND session_id = $2',
      [game.room_id, sessionId]
    );
    
    if (playerResult.rows.length === 0) {
      console.log(`[deck] Player with sessionId ${sessionId} not found in room ${game.room_id}`);
      throw createError({
        statusCode: 403,
        message: 'Not authorized to create deck'
      });
    }
    
    console.log(`[deck] Player authorized: ${playerResult.rows[0].player_id}`);
    
    try {
      // Create the deck using external API
      console.log(`[deck] Creating deck with external API, deckCount: ${deckCount}`);
      const deckResult = await deckApiService.createDeck(deckCount);
      
      // Store deck info in our database
      const deck = await query(
        'INSERT INTO decks (game_id, deck_id, remaining_cards) VALUES ($1, $2, $3) RETURNING *',
        [gameId, deckResult.deckId, JSON.stringify([])]
      );
      
      // Update game with deck ID
      await query(
        'UPDATE games SET deck_id = $1 WHERE game_id = $2',
        [deck.rows[0].deck_id, gameId]
      );
      
      console.log(`[deck] Created deck ${deck.rows[0].deck_id} for game ${gameId}`);
      
      return { 
        deck: {
          deck_id: deck.rows[0].deck_id,
          remaining: deckResult.remaining,
          shuffled: deckResult.shuffled
        } 
      };
    } catch (error) {
      console.error(`[deck] Error creating deck:`, error);
      throw createError({
        statusCode: 500,
        message: `Error creating deck: ${error.message}`
      });
    }
  }
});