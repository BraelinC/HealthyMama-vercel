export const runtime = 'nodejs';

import { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../../server/db';
import { users, insertProfileSchema } from '../../server/schema';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const validatedData = insertProfileSchema.parse(req.body);

    // Hash password
    const hashedPassword = await bcrypt.hash(validatedData.password, 10);

    // Insert user
    const [newUser] = await db.insert(users).values({
      ...validatedData,
      password: hashedPassword,
    }).returning();

    // Generate JWT token
    const token = jwt.sign(
      { userId: newUser.id, email: newUser.email },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(400).json({ error: 'Registration failed' });
  }
}
