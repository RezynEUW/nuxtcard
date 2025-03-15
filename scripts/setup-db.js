import { promises as fs } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// Replace with your actual connection string or load from .env
const connectionString = process.env.NEON_DB_URL;

async function setupDatabase() {
  // Read the schema SQL file
  const schemaPath = join(__dirname, '..', 'schema.sql');
  const schemaSql = await fs.readFile(schemaPath, 'utf-8');
  
  // Connect to the database
  const client = new pg.Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });
  
  try {
    await client.connect();
    console.log('Connected to database');
    
    // Execute the schema SQL
    await client.query(schemaSql);
    console.log('Database schema created successfully');
    
  } catch (error) {
    console.error('Error setting up database:', error);
  } finally {
    await client.end();
  }
}

setupDatabase();