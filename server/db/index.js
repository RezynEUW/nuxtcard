// server/db/index.js
import pg from 'pg';
const { Pool } = pg;

export const createPool = () => {
  const config = useRuntimeConfig();
  
  return new Pool({
    connectionString: config.dbUrl,
    ssl: {
      rejectUnauthorized: false // Required for some Neon connections
    }
  });
};

// Singleton pool instance
let pool;

export const getPool = () => {
  if (!pool) {
    pool = createPool();
  }
  return pool;
};

export const query = async (text, params) => {
  const pool = getPool();
  try {
    return await pool.query(text, params);
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};