import { DatabaseStorage } from "./dbStorage";
import { MemStorage } from "./memStorage";

// Use memory storage for development when DATABASE_URL is not available
// Use database storage for production when DATABASE_URL is set
export const storage = process.env.DATABASE_URL
  ? new DatabaseStorage()
  : new MemStorage();
