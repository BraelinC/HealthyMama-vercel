export const config = { runtime: "nodejs18.x" };

import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set proper headers for JSON response
  res.setHeader('Content-Type', 'application/json');

  try {
    return res.status(200).json({
      message: 'Test endpoint working',
      method: req.method,
      timestamp: new Date().toISOString(),
      env_check: {
        DATABASE_URL: !!process.env.DATABASE_URL,
        JWT_SECRET: !!process.env.JWT_SECRET,
        STRIPE_SECRET_KEY: !!process.env.STRIPE_SECRET_KEY
      }
    });
  } catch (error: any) {
    console.error('[TEST ERROR]', error.message);
    return res.status(500).json({
      message: 'Test endpoint error',
      error: error.message
    });
  }
}