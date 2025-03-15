// server/api/games/[gameId]/blackjack/deal.js
import { getCardService } from '../../../../services/card-service';
import { query } from '../../../../db';

export default defineEventHandler(async (event) => {
  const method = getMethod(event);
  const gameId = getRouterParam(event, 'gameId');
  const cardService = getCardService();
  
  // POST /api/games/:gameId/blackjack/deal - Deal initial cards for blackjack
  if (method === 'POST') {
    const body = await readBody(event);
    const { sessionId } = body;
    
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
    
    // Verify player is in the game and is host
    const playerResult = await query(
      'SELECT * FROM players WHERE room_id = $1 AND session_id = $2 AND is_host = true',
      [game.room_id, sessionId]
    );
    
    if (playerResult.rows.length === 0) {
      throw createError({
        statusCode: 403,
        message: 'Only the host can deal cards'
      });
    }
    
    // Get or create a deck
    let deckId = game.deck_id;
    
    if (!deckId) {
      // Create a new deck
      const deck = await cardService.createDeck(gameId);
      deckId = deck.deck_id;
      
      // Update game with deck ID
      await query(
        'UPDATE games SET deck_id = $1 WHERE game_id = $2',
        [deckId, gameId]
      );
    }
    
    // Deal initial cards
    const { dealerHand, playerHands } = await cardService.dealInitialBlackjackHands(gameId, deckId);
    
    // Get cards for each hand
    const dealerCardsResult = await query(
      'SELECT * FROM cards WHERE hand_id = $1 ORDER BY position',
      [dealerHand.hand_id]
    );
    
    const playerHandsWithCards = [];
    
    for (const hand of playerHands) {
      const cardsResult = await query(
        'SELECT * FROM cards WHERE hand_id = $1 ORDER BY position',
        [hand.hand_id]
      );
      
      playerHandsWithCards.push({
        ...hand,
        cards: cardsResult.rows
      });
    }
    
    return {
      dealerHand: {
        ...dealerHand,
        cards: dealerCardsResult.rows
      },
      playerHands: playerHandsWithCards
    };
  }
});