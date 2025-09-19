import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables if not already loaded
if (!process.env.DATABASE_URL) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const envPath = path.join(__dirname, '..', '.env');
  console.log('🔍 [DB ENV DEBUG] Loading .env from:', envPath);
  const result = dotenv.config({ path: envPath });
  console.log('🔍 [DB ENV DEBUG] Result:', result.error ? result.error.message : 'success');
  console.log('🔍 [DB ENV DEBUG] DATABASE_URL now available:', !!process.env.DATABASE_URL);
}

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema });