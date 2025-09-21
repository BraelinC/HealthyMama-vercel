// DEPRECATED: This is a minimal API server for basic development testing
// For full development, use: npm run dev (which runs server/index.ts with Vite integration)
// This file is kept for testing auth endpoints in isolation if needed

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { db } from './server/db';
import { users } from './shared/schema';
import { eq } from 'drizzle-orm';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 5005;

// Enable CORS
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || "healthy-mama-jwt-secret-key-2025-production";

// JWT middleware for authentication
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Simple health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Development API server with real database running' });
});

// Real user registration
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, full_name, phone } = req.body;

    if (!email || !password || !full_name) {
      return res.status(400).json({ error: 'Email, password, and full_name are required' });
    }

    // Check if user already exists
    const existingUser = await db.select().from(users).where(eq(users.email, email));
    if (existingUser.length > 0) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Insert new user with generated UUID
    const userId = randomUUID();
    const [newUser] = await db.insert(users).values({
      id: userId,
      email,
      password_hash: hashedPassword,
      full_name,
      phone: phone || ''
    }).returning();

    // Generate JWT token
    const token = jwt.sign(
      { userId: newUser.id, email: newUser.email },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.full_name
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed', details: error.message });
  }
});

// Real user login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const [user] = await db.select().from(users).where(eq(users.email, email));

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.full_name
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed', details: error.message });
  }
});

// Get current user (protected route)
app.get('/api/auth/user', authenticateToken, async (req, res) => {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, req.user.userId));

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      email: user.email,
      name: user.full_name,
      phone: user.phone,
      createdAt: user.createdAt,
      preferences: []
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user data', details: error.message });
  }
});

// For all other API routes, return a helpful message
app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: 'API endpoint not implemented in development server',
    message: 'Add more endpoints as needed for development',
    endpoint: req.path
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Development API server running on http://localhost:${PORT}`);
  console.log(`📝 Note: This is a minimal API server for development.`);
  console.log(`🔧 For full functionality, start the complete backend server.`);
});
