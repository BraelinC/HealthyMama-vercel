import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables if not already loaded
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '..', '.env');

// Always load .env to ensure we have the latest values
console.log('🔍 [DB ENV DEBUG] Loading .env from:', envPath);
const result = dotenv.config({ path: envPath, override: true });
console.log('🔍 [DB ENV DEBUG] Result:', result.error ? result.error.message : 'success');
console.log('🔍 [DB ENV DEBUG] DATABASE_URL now available:', !!process.env.DATABASE_URL);

if (process.env.DATABASE_URL) {
  console.log('🔍 [DB ENV DEBUG] DATABASE_URL preview:', process.env.DATABASE_URL.substring(0, 50) + '...');
}

neonConfig.webSocketConstructor = ws;

let pool: any;
let db: any;

if (!process.env.DATABASE_URL) {
  console.log('⚠️  [DB WARNING] DATABASE_URL not set. Using memory storage for development.');
  // Create dummy objects to prevent import errors
  pool = {} as any;
  db = {} as any;
} else {
  console.log('✅ [DB SUCCESS] DATABASE_URL found, initializing database connection...');

  try {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    db = drizzle({ client: pool, schema });

    console.log('✅ [DB SUCCESS] Database pool created successfully');

    // Test the connection
    pool.connect().then((client: any) => {
      console.log('✅ [DB SUCCESS] Database connection test successful');
      client.release();
    }).catch((error: any) => {
      console.error('❌ [DB ERROR] Database connection test failed:', error.message);
    });

  } catch (error: any) {
    console.error('❌ [DB ERROR] Failed to initialize database:', error.message);
    // Fall back to dummy objects
    pool = {} as any;
    db = {} as any;
  }
}

export { pool, db };