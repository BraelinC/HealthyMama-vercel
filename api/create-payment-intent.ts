import { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';
import Stripe from 'stripe';
import { storage } from '../server/storage';

function authenticate(req: VercelRequest): { userId: string } | null {
  const authHeader = (req.headers.authorization || req.headers.Authorization) as string | undefined;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    return { userId: String(decoded?.userId || decoded?.id) };
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const auth = authenticate(req);
  if (!auth) {
    return res.status(401).json({ message: 'User not authenticated' });
  }

  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ message: 'Stripe not configured' });
    }
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-07-30.basil' });

    const { amount, paymentType } = req.body as { amount?: number; paymentType?: string };

    const user = await storage.getUser(auth.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    let cents: number;
    let description: string;
    if (paymentType === 'founders') {
      cents = 10000;
      description = 'Healthy Mama Founders Offer - Lifetime Access';
    } else if (paymentType === 'monthly') {
      cents = 2000;
      description = 'Healthy Mama Monthly Subscription';
    } else if (paymentType === 'trial') {
      cents = 0;
      description = 'Healthy Mama 21-Day Premium Trial Setup';
    } else {
      cents = Math.max(0, Math.round((amount || 0) * 100));
      description = 'Healthy Mama Payment';
    }

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

    const pi = await stripe.paymentIntents.create({
      amount: cents,
      currency: 'usd',
      customer: customerId,
      description,
      metadata: { paymentType: paymentType || 'general' }
    });

    return res.status(200).json({ clientSecret: pi.client_secret, amount: cents / 100 });
  } catch (error: any) {
    return res.status(500).json({ message: 'Error creating payment intent: ' + (error?.message || 'unknown') });
  }
}


