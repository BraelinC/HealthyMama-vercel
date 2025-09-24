export const runtime = 'nodejs';

import { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json');

  try {
    // Test basic auth header parsing
    const authHeader = req.headers.authorization;
    const hasAuth = !!authHeader;

    // Test environment variables
    const hasJWT = !!process.env.JWT_SECRET;
    const hasDB = !!process.env.DATABASE_URL;
    const hasStripe = !!process.env.STRIPE_SECRET_KEY;

    return res.status(200).json({
      success: true,
      message: 'Debug endpoint working',
      auth: {
        hasAuthHeader: hasAuth,
        authHeaderPreview: authHeader ? authHeader.substring(0, 20) + '...' : null
      },
      env: {
        hasJWT,
        hasDB,
        hasStripe
      },
      request: {
        method: req.method,
        url: req.url
      }
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
}