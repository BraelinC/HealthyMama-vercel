import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "./schema";

// Vercel automatically provides environment variables - no dotenv needed
console.log('🔍 [DB ENV DEBUG] Environment check - DATABASE_URL available:', !!process.env.DATABASE_URL);

if (process.env.DATABASE_URL) {
  console.log('🔍 [DB ENV DEBUG] DATABASE_URL preview:', process.env.DATABASE_URL.substring(0, 50) + '...');
}

neonConfig.webSocketConstructor = ws;

let pool: any;
let db: any;

function initializeDatabase() {
  if (!process.env.DATABASE_URL) {
    console.log('⚠️  [DB WARNING] DATABASE_URL not set. Using memory storage for development.');
    // Create dummy objects to prevent import errors
    pool = {} as any;
    db = {} as any;
    return;
  }

  console.log('✅ [DB SUCCESS] DATABASE_URL found, initializing database connection...');

  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // Optimized for Vercel serverless functions
      max: 1, // Single connection per function
      idleTimeoutMillis: 0, // Don't timeout idle connections
      connectionTimeoutMillis: 3000, // 3 second connection timeout
    });

    db = drizzle({ client: pool, schema });
    console.log('✅ [DB SUCCESS] Database pool created for Vercel serverless');

  } catch (error: any) {
    console.error('❌ [DB ERROR] Failed to initialize database:', error.message);
    // Fall back to dummy objects
    pool = {} as any;
    db = {} as any;
  }
}

// Initialize database connection
initializeDatabase();

export { pool, db };