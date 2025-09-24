import { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json');

  return res.status(200).json({
    success: true,
    message: 'Minimal endpoint working',
    timestamp: new Date().toISOString()
  });
}