// server/api/games/[gameId]/blackjack/deal.js
import { query } from '../../../../db';
import { getDeckApiService } from '../../../../services/deck-api-service';

export default defineEventHandler(async (event) => {
  const method = getMethod(event);
  const gameId = getRouterParam(event, 'gameId');
  const deckApiService = getDeckApiService();
  
  console.log(`[deal] Processing deal request for game ${gameId}, method ${method}`);
  
  // POST /api/games/:gameId/blackjack/deal - Deal initial cards for blackjack
  if (method === 'POST') {
    const body = await readBody(event);
    const { sessionId } = body;
    
    if (!sessionId) {
      console.log(`[deal] No sessionId provided`);
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
      console.log(`[deal] Game not found: ${gameId}`);
      throw createError({
        statusCode: 404,
        message: 'Game not found'
      });
    }
    
    const game = gameResult.rows[0];
    console.log(`[deal] Found game with room_id ${game.room_id}`);
    
    // Verify player is in the game
    const playerResult = await query(
      'SELECT * FROM players WHERE room_id = $1 AND session_id = $2',
      [game.room_id, sessionId]
    );
    
    if (playerResult.rows.length === 0) {
      console.log(`[deal] Player with sessionId ${sessionId} not found in room ${game.room_id}`);
      throw createError({
        statusCode: 403,
        message: 'Not authorized to deal cards'
      });
    }
    
    console.log(`[deal] Player authorized: ${playerResult.rows[0].player_id}`);
    
    // Check if deck already exists for this game
    let deckId = game.deck_id;
    let externalDeckId = game.options?.external_deck_id;
    
    if (!externalDeckId) {
      console.log(`[deal] No external deck found, creating a new one`);
      // Create a new deck with the Deck of Cards API
      const deckResult = await deckApiService.createDeck(6); // Use 6 decks for blackjack
      externalDeckId = deckResult.deckId;
      
      // Update game with deck ID
      await query(
        'UPDATE games SET options = jsonb_set(COALESCE(options, \'{}\')::jsonb, \'{external_deck_id}\', $1::jsonb) WHERE game_id = $2',
        [JSON.stringify(externalDeckId), gameId]
      );
      console.log(`[deal] Created external deck ${externalDeckId}`);
    } else {
      console.log(`[deal] Using existing external deck ${externalDeckId}`);
    }
    
    try {
      // Get players in the game
      const playersResult = await query(
        'SELECT * FROM players WHERE room_id = $1',
        [game.room_id]
      );
      
      const players = playersResult.rows;
      console.log(`[deal] Found ${players.length} players in the game`);
      
      // Create a dealer hand
      const dealerHandResult = await query(
        'INSERT INTO hands (game_id, is_dealer) VALUES ($1, true) RETURNING *',
        [gameId]
      );
      
      const dealerHand = dealerHandResult.rows[0];
      console.log(`[deal] Created dealer hand: ${dealerHand.hand_id}`);
      
      // Create player hands
      const playerHands = [];
      for (const player of players) {
        const handResult = await query(
          'INSERT INTO hands (game_id, player_id) VALUES ($1, $2) RETURNING *',
          [gameId, player.player_id]
        );
        
        playerHands.push(handResult.rows[0]);
      }
      console.log(`[deal] Created ${playerHands.length} player hands`);
      
      // Draw 2 cards for each player
      const totalCardsNeeded = (playerHands.length + 1) * 2; // +1 for dealer
      const drawResult = await deckApiService.drawCards(externalDeckId, totalCardsNeeded);
      
      if (!drawResult.cards || drawResult.cards.length < totalCardsNeeded) {
        throw new Error(`Failed to draw ${totalCardsNeeded} cards, only got ${drawResult.cards?.length || 0}`);
      }
      
      console.log(`[deal] Drew ${drawResult.cards.length} cards from deck`);
      
      let cardIndex = 0;
      
      // Deal first card to each player
      for (const hand of playerHands) {
        const card = drawResult.cards[cardIndex++];
        await query(
          'INSERT INTO cards (hand_id, card_code, position, is_face_up) VALUES ($1, $2, $3, $4)',
          [hand.hand_id, card.code, 0, true]
        );
      }
      
      // Deal first card to dealer
      const dealerCard1 = drawResult.cards[cardIndex++];
      await query(
        'INSERT INTO cards (hand_id, card_code, position, is_face_up) VALUES ($1, $2, $3, $4)',
        [dealerHand.hand_id, dealerCard1.code, 0, true]
      );
      
      // Deal second card to each player
      for (const hand of playerHands) {
        const card = drawResult.cards[cardIndex++];
        await query(
          'INSERT INTO cards (hand_id, card_code, position, is_face_up) VALUES ($1, $2, $3, $4)',
          [hand.hand_id, card.code, 1, true]
        );
      }
      
      // Deal second card to dealer (face down)
      const dealerCard2 = drawResult.cards[cardIndex++];
      await query(
        'INSERT INTO cards (hand_id, card_code, position, is_face_up) VALUES ($1, $2, $3, $4)',
        [dealerHand.hand_id, dealerCard2.code, 1, false]
      );
      
      // Set first player's turn
      if (playerHands.length > 0) {
        await query(
          'UPDATE games SET current_turn = $1, status = $2 WHERE game_id = $3',
          [playerHands[0].player_id, 'playing', gameId]
        );
      }
      
      // Get all hands with their cards
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
      
      // Get current turn
      const updatedGameResult = await query(
        'SELECT current_turn FROM games WHERE game_id = $1',
        [gameId]
      );
      
      const currentTurn = updatedGameResult.rows[0]?.current_turn;
      console.log(`[deal] Current turn: ${currentTurn}`);
      
      const result = {
        dealerHand: {
          ...dealerHand,
          cards: dealerCardsResult.rows
        },
        playerHands: playerHandsWithCards,
        currentTurn
      };
      
      console.log(`[deal] Returning result with ${playerHandsWithCards.length} player hands and ${dealerCardsResult.rows.length} dealer cards`);
      return result;
    } catch (error) {
      console.error(`[deal] Error dealing cards:`, error);
      throw createError({
        statusCode: 500,
        message: `Error dealing cards: ${error.message}`
      });
    }
  }
});