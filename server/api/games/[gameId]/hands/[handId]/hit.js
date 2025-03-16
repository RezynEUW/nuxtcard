// server/api/games/[gameId]/hands/[handId]/hit.js
import { query } from '../../../../../db';
import { getDeckApiService } from '../../../../../services/deck-api-service';

export default defineEventHandler(async (event) => {
  const method = getMethod(event);
  const gameId = getRouterParam(event, 'gameId');
  const handId = getRouterParam(event, 'handId');
  const deckApiService = getDeckApiService();
  
  console.log(`[hit] Processing hit request for hand ${handId} in game ${gameId}`);
  
  // POST /api/games/:gameId/hands/:handId/hit - Draw a card (hit)
  if (method === 'POST') {
    const body = await readBody(event);
    const { sessionId } = body;
    
    if (!sessionId) {
      console.log(`[hit] No sessionId provided`);
      throw createError({
        statusCode: 401,
        message: 'Unauthorized'
      });
    }
    
    // Verify hand belongs to game
    const handResult = await query(
      `SELECT h.*, g.options, g.current_turn, p.session_id, p.player_id 
       FROM hands h 
       JOIN games g ON h.game_id = g.game_id 
       LEFT JOIN players p ON h.player_id = p.player_id 
       WHERE h.hand_id = $1 AND h.game_id = $2`,
      [handId, gameId]
    );
    
    if (handResult.rows.length === 0) {
      console.log(`[hit] Hand not found: ${handId}`);
      throw createError({
        statusCode: 404,
        message: 'Hand not found'
      });
    }
    
    const hand = handResult.rows[0];
    
    // Verify it's the player's turn and they own the hand
    if (hand.current_turn !== hand.player_id || hand.session_id !== sessionId) {
      console.log(`[hit] Not player's turn or not their hand. Current turn: ${hand.current_turn}, Player: ${hand.player_id}`);
      throw createError({
        statusCode: 403,
        message: 'Not your turn or not your hand'
      });
    }
    
    try {
      // Get the external deck ID
      const externalDeckId = hand.options?.external_deck_id;
      
      if (!externalDeckId) {
        console.log(`[hit] No external deck ID found in game options`);
        throw createError({
          statusCode: 500,
          message: 'Deck not found'
        });
      }
      
      // Draw a card from the deck
      const drawResult = await deckApiService.drawCards(externalDeckId, 1);
      
      if (!drawResult.cards || drawResult.cards.length === 0) {
        console.log(`[hit] Failed to draw a card from deck ${externalDeckId}`);
        throw createError({
          statusCode: 500,
          message: 'Failed to draw a card'
        });
      }
      
      const card = drawResult.cards[0];
      console.log(`[hit] Drew card ${card.code} from deck ${externalDeckId}`);
      
      // Get current position
      const positionResult = await query(
        'SELECT COALESCE(MAX(position), -1) + 1 as next_pos FROM cards WHERE hand_id = $1',
        [handId]
      );
      
      const position = positionResult.rows[0].next_pos;
      
      // Add card to hand
      const cardResult = await query(
        'INSERT INTO cards (hand_id, card_code, position, is_face_up, image) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [handId, card.code, position, true, card.image]
      );
      
      const drawnCard = cardResult.rows[0];
      
      // Get all cards in hand
      const cardsResult = await query(
        'SELECT * FROM cards WHERE hand_id = $1 ORDER BY position',
        [handId]
      );
      
      const cards = cardsResult.rows;
      
      // Calculate hand value
      const handValue = calculateHandValue(cards);
      console.log(`[hit] Hand value after hit: ${handValue}`);
      
      // Check for bust
      if (handValue > 21) {
        console.log(`[hit] Player busted with ${handValue}`);
        // Update hand status to busted
        await query(
          'UPDATE hands SET status = $1 WHERE hand_id = $2',
          ['busted', handId]
        );
        
        // Find the next player's turn
        // This is simplified - in a full implementation, you would check for other active hands
        const nextPlayerResult = await query(
          `SELECT p.player_id FROM players p
           JOIN hands h ON p.player_id = h.player_id
           WHERE h.game_id = $1 AND h.status = 'active' AND p.player_id != $2
           ORDER BY p.created_at
           LIMIT 1`,
          [gameId, hand.player_id]
        );
        
        if (nextPlayerResult.rows.length > 0) {
          const nextPlayerId = nextPlayerResult.rows[0].player_id;
          await query(
            'UPDATE games SET current_turn = $1 WHERE game_id = $2',
            [nextPlayerId, gameId]
          );
          console.log(`[hit] Next turn: ${nextPlayerId}`);
        } else {
          // All players have played, dealer's turn
          await query(
            'UPDATE games SET current_turn = NULL WHERE game_id = $1',
            [gameId]
          );
          console.log(`[hit] All players done, dealer's turn next`);
        }
        
        return {
          card: drawnCard,
          handValue,
          busted: true,
          hand: {
            ...hand,
            status: 'busted'
          }
        };
      }
      
      return {
        card: drawnCard,
        handValue,
        busted: false
      };
    } catch (error) {
      console.error(`[hit] Error hitting hand:`, error);
      throw createError({
        statusCode: 500,
        message: `Error hitting hand: ${error.message}`
      });
    }
  }
});

// Helper function to calculate hand value
function calculateHandValue(cards) {
  let value = 0;
  let aceCount = 0;
  
  // Calculate initial value
  for (const card of cards) {
    // Extract the value from card code (first character, or first two for '10')
    const code = card.card_code;
    let cardValue;
    
    if (code.startsWith('0') || code.startsWith('10')) {
      cardValue = '10';
    } else {
      cardValue = code.charAt(0);
    }
    
    if (cardValue === 'A') {
      aceCount++;
      value += 11;
    } else if (['K', 'Q', 'J'].includes(cardValue)) {
      value += 10;
    } else {
      value += parseInt(cardValue, 10);
    }
  }
  
  // Adjust for aces
  while (value > 21 && aceCount > 0) {
    value -= 10;
    aceCount--;
  }
  
  return value;
}