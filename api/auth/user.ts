export const runtime = 'nodejs';

import { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';
import { storage } from '../../server/storage';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set proper headers for JSON response
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Check for JWT_SECRET environment variable
    if (!process.env.JWT_SECRET) {
      console.error('[AUTH ERROR] JWT_SECRET not configured');
      return res.status(500).json({ message: 'Authentication not configured' });
    }

    const authHeader = req.headers.authorization || req.headers.Authorization as string | undefined;
    const token = authHeader && authHeader.toString().split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    let userId: string | null = null;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;
      userId = decoded?.userId || decoded?.id || null;
    } catch (e: any) {
      console.error('[AUTH ERROR] Token verification failed:', e.message);
      return res.status(403).json({ message: 'Invalid token' });
    }

    if (!userId) {
      return res.status(403).json({ message: 'Invalid token' });
    }

    // Add timeout handling for database operations
    const userPromise = storage.getUser(String(userId));
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Database timeout')), 5000)
    );

    const user = await Promise.race([userPromise, timeoutPromise]);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { password_hash, ...userWithoutPassword } = user as any;
    return res.status(200).json({ user: userWithoutPassword });
  } catch (error: any) {
    console.error('[AUTH ERROR] Handler failed:', error.message);

    // Ensure we always return JSON even on error
    if (error.message === 'Database timeout') {
      return res.status(504).json({ message: 'Database connection timeout' });
    }

    return res.status(500).json({
      message: 'Failed to get user',
      error: process.env.NODE_ENV === 'development' ? error?.message : 'Internal server error'
    });
  }
}


