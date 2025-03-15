// server/api/games/[gameId]/dealer.js
import { getBlackjackService } from '../../../services/blackjack-service';
import { query } from '../../../db';

export default defineEventHandler(async (event) => {
  const method = getMethod(event);
  const gameId = getRouterParam(event, 'gameId');
  const blackjackService = getBlackjackService();
  
  // POST /api/games/:gameId/dealer - Play dealer's turn
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
    
    // Get dealer's hand
    const dealerHandResult = await query(
      'SELECT * FROM hands WHERE game_id = $1 AND is_dealer = true',
      [gameId]
    );
    
    if (dealerHandResult.rows.length === 0) {
      throw createError({
        statusCode: 404,
        message: 'Dealer hand not found'
      });
    }
    
    const dealerHand = dealerHandResult.rows[0];
    
    // Play dealer's turn
    const dealerResult = await blackjackService.playDealerTurn(gameId, dealerHand.hand_id);
    
    // Get player hands to determine winners
    const playerHandsResult = await query(
      `SELECT h.*, p.nickname, 
       (SELECT array_agg(c.* ORDER BY c.position) FROM cards c WHERE c.hand_id = h.hand_id) as cards
       FROM hands h
       JOIN players p ON h.player_id = p.player_id
       WHERE h.game_id = $1 AND h.is_dealer = false`,
      [gameId]
    );
    
    const playerHands = playerHandsResult.rows;
    
    // Determine winners (simplified version)
    const results = [];
    const dealerValue = dealerResult.handValue;
    const dealerBusted = dealerResult.busted;
    
    for (const hand of playerHands) {
      const cards = hand.cards || [];
      const handValue = blackjackService.cardService.calculateHandValue(cards);
      const isBlackjack = cards.length === 2 && handValue === 21;
      
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
      } else if (handValue > dealerValue) {
        result = 'win';
        payout = hand.bet_amount * 2; // 1:1 payout
      } else if (handValue === dealerValue) {
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
        handValue,
        result,
        payout
      });
    }
    
    return {
      dealer: dealerResult,
      results
    };
  }
});