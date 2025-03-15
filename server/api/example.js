// server/api/example.js
import { query } from '../db';

export default defineEventHandler(async (event) => {
  try {
    const result = await query('SELECT NOW()');
    return { timestamp: result.rows[0].now };
  } catch (error) {
    console.error('API error:', error);
    return { error: 'Database error' };
  }
});