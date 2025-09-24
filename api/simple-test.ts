export const runtime = 'nodejs';

import { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json');

  return res.status(200).json({
    success: true,
    message: 'Simple test endpoint working - no imports',
    timestamp: new Date().toISOString(),
    method: req.method,
    env_check: {
      DATABASE_URL: !!process.env.DATABASE_URL,
      JWT_SECRET: !!process.env.JWT_SECRET,
      NODE_ENV: process.env.NODE_ENV
    }
  });
}