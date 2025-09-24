export const runtime = 'nodejs';

import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json');

  try {
    // Test environment variables first
    const hasEnvVars = {
      DATABASE_URL: !!process.env.DATABASE_URL,
      JWT_SECRET: !!process.env.JWT_SECRET,
      STRIPE_SECRET_KEY: !!process.env.STRIPE_SECRET_KEY
    };

    if (!process.env.DATABASE_URL) {
      return res.status(500).json({
        success: false,
        message: 'DATABASE_URL not configured',
        env_check: hasEnvVars
      });
    }

    // Try to import and test database connection
    const { db } = await import('../../server/db');

    return res.status(200).json({
      success: true,
      message: 'Database connection test - import successful',
      env_check: hasEnvVars,
      db_imported: !!db
    });

  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Database test failed',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}