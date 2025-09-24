import { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';
import Stripe from 'stripe';
import { storage } from '../server/storage';

function auth(req: VercelRequest): string | null {
  const hdr = (req.headers.authorization || req.headers.Authorization) as string | undefined;
  const token = hdr && hdr.split(' ')[1];
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    return String(decoded?.userId || decoded?.id || '');
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  const userId = auth(req);
  if (!userId) return res.status(401).json({ message: 'User not authenticated' });

  try {
    if (!process.env.STRIPE_SECRET_KEY) return res.status(500).json({ message: 'Stripe not configured' });
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-07-30.basil' });

    const { paymentType } = (req.body || {}) as { paymentType?: string };
    const user = await storage.getUser(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    let customerId = (user as any).stripe_customer_id as string | undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        name: user.full_name || undefined,
        metadata: { appUserId: String(user.id) },
      });
      customerId = customer.id;
      await storage.updateUser(String(user.id), { stripe_customer_id: customerId });
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
      usage: 'off_session',
      metadata: { type: paymentType || 'trial', appUserId: String(user.id) }
    });

    return res.status(200).json({ customerId, clientSecret: setupIntent.client_secret, paymentType });
  } catch (error: any) {
    return res.status(500).json({ message: 'Error creating setup intent: ' + (error?.message || 'unknown') });
  }
}


