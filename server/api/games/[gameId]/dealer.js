// server/api/games/[gameId]/dealer.js
import { getDeckApiService } from '../../../services/deck-api-service';
import { query } from '../../../db';

export default defineEventHandler(async (event) => {
  const method = getMethod(event);
  const gameId = getRouterParam(event, 'gameId');
  const deckApiService = getDeckApiService();
  
  console.log(`[dealer] Processing dealer turn for game ${gameId}`);
  
  // POST /api/games/:gameId/dealer - Play dealer's turn
  if (method === 'POST') {
    const body = await readBody(event);
    const { sessionId } = body;
    
    if (!sessionId) {
      console.log(`[dealer] No sessionId provided`);
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
      console.log(`[dealer] Game not found: ${gameId}`);
      throw createError({
        statusCode: 404,
        message: 'Game not found'
      });
    }
    
    const game = gameResult.rows[0];
    
    // Get the deck
    const deckResult = await query(
      'SELECT * FROM decks WHERE deck_id = $1',
      [game.deck_id]
    );
    
    if (deckResult.rows.length === 0) {
      console.log(`[dealer] Deck not found: ${game.deck_id}`);
      throw createError({
        statusCode: 404,
        message: 'Deck not found'
      });
    }
    
    const deck = deckResult.rows[0];
    const apiDeckId = deck.deck_id;
    
    // Verify player is in the game
    const playerResult = await query(
      'SELECT * FROM players WHERE room_id = $1 AND session_id = $2',
      [game.room_id, sessionId]
    );
    
    if (playerResult.rows.length === 0) {
      console.log(`[dealer] Player with sessionId ${sessionId} not found in room ${game.room_id}`);
      throw createError({
        statusCode: 403,
        message: 'Player not in this game'
      });
    }
    
    // Get dealer's hand
    const dealerHandResult = await query(
      'SELECT * FROM hands WHERE game_id = $1 AND is_dealer = true',
      [gameId]
    );
    
    if (dealerHandResult.rows.length === 0) {
      console.log(`[dealer] Dealer hand not found for game ${gameId}`);
      throw createError({
        statusCode: 404,
        message: 'Dealer hand not found'
      });
    }
    
    const dealerHand = dealerHandResult.rows[0];
    
    try {
      // Reveal dealer's hole card
      await query(
        'UPDATE cards SET is_face_up = true WHERE hand_id = $1',
        [dealerHand.hand_id]
      );
      
      // Get dealer's cards
      const dealerCardsResult = await query(
        'SELECT * FROM cards WHERE hand_id = $1 ORDER BY position',
        [dealerHand.hand_id]
      );
      
      let dealerCards = dealerCardsResult.rows;
      
      // Calculate dealer's hand value
      let handValue = calculateHandValue(dealerCards);
      console.log(`[dealer] Initial hand value: ${handValue}`);
      
      // Dealer must hit until 17 or higher
      while (handValue < 17) {
        // Draw a card from the API
        console.log(`[dealer] Drawing card from deck ${apiDeckId}`);
        const drawResult = await deckApiService.drawCards(apiDeckId, 1);
        const card = drawResult.cards[0];
        
        // Convert API card format to our format
        // Example: "AS" for Ace of Spades
        const cardCode = convertCardCode(card.code);
        
        // Get next position
        const position = dealerCards.length;
        
        // Add card to dealer's hand
        const cardResult = await query(
          'INSERT INTO cards (hand_id, card_code, position, is_face_up) VALUES ($1, $2, $3, $4) RETURNING *',
          [dealerHand.hand_id, cardCode, position, true]
        );
        
        const newCard = cardResult.rows[0];
        dealerCards.push(newCard);
        
        // Recalculate hand value
        handValue = calculateHandValue(dealerCards);
        console.log(`[dealer] New hand value after hit: ${handValue}`);
      }
      
      // Update game status to completed
      await query(
        'UPDATE games SET status = $1, ended_at = NOW() WHERE game_id = $2',
        ['completed', gameId]
      );
      
      // Get player hands to determine winners
      const playerHandsResult = await query(
        `SELECT h.*, p.nickname, p.player_id, 
         (SELECT array_agg(c.* ORDER BY c.position) FROM cards c WHERE c.hand_id = h.hand_id) as cards
         FROM hands h
         JOIN players p ON h.player_id = p.player_id
         WHERE h.game_id = $1 AND h.is_dealer = false`,
        [gameId]
      );
      
      const playerHands = playerHandsResult.rows;
      
      // Determine winners
      const results = [];
      const dealerBusted = handValue > 21;
      
      for (const hand of playerHands) {
        const cards = hand.cards || [];
        const playerHandValue = calculateHandValue(cards);
        const isBlackjack = cards.length === 2 && playerHandValue === 21;
        
        let result;
        let payout = 0;
        
        if (hand.status === 'busted') {
          result = 'lose';
        } else if (isBlackjack) {
          result = 'blackjack';
          payout = hand.bet_amount * 2.5; // 3:2 payout for blackjack
        } else if (dealerBusted) {
          result = 'win';
          payout = hand.bet_amount * 2; // 1:1 payout
        } else if (playerHandValue > handValue) {
          result = 'win';
          payout = hand.bet_amount * 2; // 1:1 payout
        } else if (playerHandValue === handValue) {
          result = 'push';
          payout = hand.bet_amount; // Return bet on push
        } else {
          result = 'lose';
        }
        
        // Update player balance
        if (payout > 0) {
          await query(
            'UPDATE players SET balance = balance + $1 WHERE player_id = $2',
            [payout, hand.player_id]
          );
        }
        
        results.push({
          hand_id: hand.hand_id,
          player_id: hand.player_id,
          nickname: hand.nickname,
          bet: hand.bet_amount,
          handValue: playerHandValue,
          result,
          payout
        });
      }
      
      console.log(`[dealer] Completed dealer turn for game ${gameId}`);
      
      return {
        dealer: {
          dealerCards,
          handValue,
          busted: dealerBusted
        },
        results
      };
    } catch (error) {
      console.error(`[dealer] Error playing dealer turn:`, error);
      throw createError({
        statusCode: 500,
        message: `Error playing dealer turn: ${error.message}`
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
    // Handle both card objects from DB and simple card code strings
    const cardCode = card.card_code || card;
    
    // Extract the first character (or two for '10')
    let cardValue;
    if (cardCode.startsWith('10') || cardCode.startsWith('0')) {
      cardValue = '10';
    } else {
      cardValue = cardCode.charAt(0);
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

// Convert cards API format to our format
function convertCardCode(apiCode) {
  // The API uses format like "AS" for Ace of Spades
  // Our code might need conversion depending on your format
  return apiCode;
}