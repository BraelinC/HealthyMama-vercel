import { DatabaseStorage } from "./dbStorage";

// For Vercel production, always use database storage
// DATABASE_URL is required for production deployment
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required for production deployment');
}

console.log('🔍 [STORAGE] Initializing DatabaseStorage for production');
export const storage = new DatabaseStorage();
