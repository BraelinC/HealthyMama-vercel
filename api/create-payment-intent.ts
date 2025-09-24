export const config = { runtime: "nodejs18.x" };

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
  // Set proper headers for JSON response
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Check authentication
    const auth = authenticate(req);
    if (!auth) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    // Check Stripe configuration
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error('[PAYMENT ERROR] STRIPE_SECRET_KEY not configured');
      return res.status(500).json({ message: 'Payment system not configured' });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-07-30.basil',
      timeout: 10000, // 10 second timeout
    });

    const { amount, paymentType } = req.body as { amount?: number; paymentType?: string };

    // Add timeout for user lookup
    const userPromise = storage.getUser(auth.userId);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Database timeout')), 5000)
    );

    const user = await Promise.race([userPromise, timeoutPromise]);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Determine payment amount and description
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

    // Handle Stripe customer creation/lookup
    let customerId = (user as any).stripe_customer_id as string | undefined;
    if (!customerId) {
      console.log('[PAYMENT] Creating new Stripe customer for user:', auth.userId);
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        name: user.full_name || undefined,
        metadata: { appUserId: String(user.id) },
      });
      customerId = customer.id;

      // Update user with customer ID
      const updatePromise = storage.updateUser(String(user.id), { stripe_customer_id: customerId });
      const updateTimeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Database timeout')), 5000)
      );
      await Promise.race([updatePromise, updateTimeoutPromise]);
    }

    // Create payment intent
    console.log('[PAYMENT] Creating payment intent:', { paymentType, cents, customerId });
    const pi = await stripe.paymentIntents.create({
      amount: cents,
      currency: 'usd',
      customer: customerId,
      description,
      metadata: { paymentType: paymentType || 'general' }
    });

    return res.status(200).json({ clientSecret: pi.client_secret, amount: cents / 100 });
  } catch (error: any) {
    console.error('[PAYMENT ERROR] Handler failed:', error.message);

    // Handle specific error types
    if (error.message === 'Database timeout') {
      return res.status(504).json({ message: 'Database connection timeout' });
    }

    if (error.type === 'StripeError') {
      return res.status(400).json({ message: 'Payment processing error', error: error.message });
    }

    // Ensure we always return JSON even on error
    return res.status(500).json({
      message: 'Error creating payment intent',
      error: process.env.NODE_ENV === 'development' ? error?.message : 'Internal server error'
    });
  }
}


