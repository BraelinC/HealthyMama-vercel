import { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';
import { storage } from '../../server/storage';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization || req.headers.Authorization as string | undefined;
    const token = authHeader && authHeader.toString().split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    let userId: string | null = null;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      userId = decoded?.userId || decoded?.id || null;
    } catch (e) {
      return res.status(403).json({ message: 'Invalid token' });
    }

    if (!userId) {
      return res.status(403).json({ message: 'Invalid token' });
    }

    const user = await storage.getUser(String(userId));
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { password_hash, ...userWithoutPassword } = user as any;
    return res.status(200).json({ user: userWithoutPassword });
  } catch (error: any) {
    return res.status(500).json({ message: 'Failed to get user', error: error?.message || 'unknown' });
  }
}


