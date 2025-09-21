import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { type User } from "@shared/schema";
import { z } from "zod";

// Validation schemas
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const registerSchema = z.object({
  email: z.string().email(),
  phone: z.string().min(10).optional(),
  password: z.string().min(8),
  full_name: z.string().min(1)
});

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_EXPIRES_IN = "30d"; // Extended to 30 days for better persistence

// Support for old JWT secrets to handle rotation gracefully
const OLD_JWT_SECRETS = process.env.OLD_JWT_SECRETS 
  ? process.env.OLD_JWT_SECRETS.split(',') 
  : ["your-secret-key-change-in-production"]; // Add old secrets here

// Log JWT configuration (remove in production)
console.log("🔐 JWT Configuration:", {
  hasEnvSecret: !!process.env.JWT_SECRET,
  secretLength: JWT_SECRET.length,
  expiresIn: JWT_EXPIRES_IN,
  oldSecretsCount: OLD_JWT_SECRETS.length
});

export interface AuthRequest extends Request {
  user?: User;
}

// Hash password
export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 12);
}

// Verify password
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return await bcrypt.compare(password, hashedPassword);
}

// Generate JWT token with creator status
export function generateToken(userId: string, isCreator: boolean = false): string {
  return jwt.sign({ userId, isCreator }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// Verify JWT token with support for old secrets
export function verifyToken(token: string): { userId: string; needsRefresh?: boolean } | null {
  console.log(`🔍 [AUTH DEBUG] Attempting to verify token with current secret (length: ${JWT_SECRET.length})`);

  // First try with current secret
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    console.log(`✅ [AUTH DEBUG] Token verified with current secret for user:`, decoded.userId);
    return decoded;
  } catch (error: any) {
    console.log(`⚠️ [AUTH DEBUG] Current secret failed:`, {
      errorName: error.name,
      errorMessage: error.message,
      tokenPreview: token.substring(0, 50) + '...'
    });

    // Handle expired tokens
    if (error.name === 'TokenExpiredError') {
      console.log(`❌ [AUTH DEBUG] Token expired at:`, error.expiredAt);
      return null;
    }

    // Handle malformed tokens
    if (error.name === 'JsonWebTokenError' && error.message !== 'invalid signature') {
      console.log(`❌ [AUTH DEBUG] Malformed token:`, error.message);
      return null;
    }

    // Try with old secrets for signature errors
    console.log(`🔄 [AUTH DEBUG] Trying ${OLD_JWT_SECRETS.length} old secrets...`);
    for (let i = 0; i < OLD_JWT_SECRETS.length; i++) {
      const oldSecret = OLD_JWT_SECRETS[i];
      try {
        const decoded = jwt.verify(token, oldSecret) as { userId: string };
        console.log(`✅ [AUTH DEBUG] Token verified with old secret ${i} for user:`, decoded.userId);
        return { ...decoded, needsRefresh: true };
      } catch (oldError: any) {
        console.log(`⚠️ [AUTH DEBUG] Old secret ${i} failed:`, oldError.message);
      }
    }

    console.log(`❌ [AUTH DEBUG] All token verification attempts failed`);
    return null;
  }
}

// Auth middleware with automatic token refresh
export async function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  console.log(`🔍 [AUTH DEBUG] Authorization header:`, authHeader ? 'Present' : 'Missing');
  
  if (!token) {
    console.log(`❌ [AUTH DEBUG] No token found`);
    return res.status(401).json({ message: "Access token required" });
  }

  console.log(`🔍 [AUTH DEBUG] Token length:`, token.length);
  console.log(`🔍 [AUTH DEBUG] Token preview:`, token.substring(0, 20) + '...');
  
  const decoded = verifyToken(token);
  if (!decoded) {
    console.log(`❌ [AUTH DEBUG] Token verification failed`);
    return res.status(403).json({ message: "Invalid token" });
  }
  
  console.log(`✅ [AUTH DEBUG] Token verified for user:`, decoded.userId);

  try {
    const user = await storage.getUser(decoded.userId);
    if (!user) {
      return res.status(403).json({ message: "User not found" });
    }
    
    req.user = user;
    
    // If token needs refresh, add new token to response header
    if (decoded.needsRefresh) {
      const newToken = generateToken(decoded.userId, user.is_creator || false);
      res.setHeader('X-New-Token', newToken);
      res.setHeader('Access-Control-Expose-Headers', 'X-New-Token');
      console.log(`🔄 Auto-refreshed token for user ${decoded.userId}`);
    }
    
    next();
  } catch (error) {
    return res.status(500).json({ message: "Authentication error" });
  }
}

// Flexible authentication middleware that supports JWT and session fallback
export async function authenticateFlexible(req: AuthRequest, res: Response, next: NextFunction) {
  // First try JWT authentication
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      try {
        const user = await storage.getUser(decoded.userId);
        if (user) {
          req.user = user;
          
          // If token needs refresh, add new token to response header
          if (decoded.needsRefresh) {
            const newToken = generateToken(decoded.userId, user.is_creator || false);
            res.setHeader('X-New-Token', newToken);
            res.setHeader('Access-Control-Expose-Headers', 'X-New-Token');
            console.log(`🔄 Auto-refreshed token for user ${decoded.userId}`);
          }
          
          return next();
        }
      } catch (error) {
        console.error('JWT user lookup error:', error);
      }
    }
  }
  
  // Fall back to session authentication
  if (req.session && req.session.userId) {
    try {
      const user = await storage.getUser(req.session.userId);
      if (user) {
        req.user = user;
        
        // Generate a new JWT token for the session user
        const newToken = generateToken(user.id.toString(), user.is_creator || false);
        res.setHeader('X-New-Token', newToken);
        res.setHeader('Access-Control-Expose-Headers', 'X-New-Token');
        console.log(`🔐 Generated new token for session user ${user.id}`);
        
        return next();
      }
    } catch (error) {
      console.error('Session user lookup error:', error);
    }
  }
  
  // No valid authentication found
  return res.status(401).json({ message: "Authentication required" });
}

// Register user
export async function registerUser(req: Request, res: Response) {
  try {
    const validatedData = registerSchema.parse(req.body);
    
    // Check if user already exists
    const existingUser = await storage.getUserByEmail(validatedData.email);
    if (existingUser) {
      return res.status(400).json({ message: "User already exists with this email" });
    }

    // Hash password
    const hashedPassword = await hashPassword(validatedData.password);

    // Calculate trial end date (30 days from now)
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 30);

    // Create user with free trial
    const user = await storage.createUser({
      email: validatedData.email,
      phone: validatedData.phone || '',
      password_hash: hashedPassword,
      full_name: validatedData.full_name,
      account_type: 'free_trial',
      trial_ends_at: trialEndsAt,
      subscription_status: 'active',
    });

    // Generate token with creator status
    const token = generateToken(user.id.toString(), user.is_creator || false);

    // Return user data (without password) and token (including is_creator)
    const { password_hash, ...userWithoutPassword } = user;
    res.status(201).json({
      user: userWithoutPassword,
      token,
      message: "User registered successfully"
    });

  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ 
        message: "Validation error", 
        errors: error.errors 
      });
    }
    
    console.error("Registration error:", error);
    res.status(500).json({ message: "Registration failed" });
  }
}

// Login user with session support
export async function loginUser(req: Request, res: Response) {
  try {
    console.log(`🔍 [LOGIN DEBUG] Login attempt for email:`, req.body.email);
    const validatedData = loginSchema.parse(req.body);

    // Find user by email
    console.log(`🔍 [LOGIN DEBUG] Looking up user by email:`, validatedData.email);
    const user = await storage.getUserByEmail(validatedData.email);
    if (!user) {
      console.log(`❌ [LOGIN DEBUG] User not found for email:`, validatedData.email);
      return res.status(401).json({ message: "Invalid email or password" });
    }

    console.log(`✅ [LOGIN DEBUG] User found:`, { id: user.id, email: user.email, hasPassword: !!user.password_hash });

    // Verify password
    if (!user.password_hash) {
      console.log(`❌ [LOGIN DEBUG] User has no password hash`);
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const passwordValid = await verifyPassword(validatedData.password, user.password_hash);
    console.log(`🔍 [LOGIN DEBUG] Password verification result:`, passwordValid);

    if (!passwordValid) {
      console.log(`❌ [LOGIN DEBUG] Password verification failed`);
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Generate token with creator status
    const token = generateToken(user.id.toString(), user.is_creator || false);
    console.log(`✅ [LOGIN DEBUG] Generated token for user:`, user.id);

    // Also store user ID in session as fallback
    if (req.session) {
      (req.session as any).userId = user.id;
      req.session.save((err) => {
        if (err) console.error('❌ [LOGIN DEBUG] Session save error:', err);
        else console.log(`✅ [LOGIN DEBUG] Session created for user ${user.id}`);
      });
    }

    // Return user data (without password) and token (including is_creator)
    const { password_hash, ...userWithoutPassword } = user;
    console.log(`✅ [LOGIN DEBUG] Login successful for user:`, user.id);
    res.json({
      user: userWithoutPassword,
      token,
      message: "Login successful"
    });

  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ 
        message: "Validation error", 
        errors: error.errors 
      });
    }
    
    console.error("Login error:", error);
    res.status(500).json({ message: "Login failed" });
  }
}

// Get current user
export async function getCurrentUser(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      console.log("🔍 [getCurrentUser] No user in request");
      return res.status(401).json({ message: "User not authenticated" });
    }

    console.log("🔍 [getCurrentUser] Token user object from req.user:");
    console.log("🔍 [getCurrentUser] Token User ID:", req.user.id);
    console.log("🔍 [getCurrentUser] Token User is_creator:", req.user.is_creator);

    // IMPORTANT: Fetch fresh user data from database instead of using token data
    // This ensures we get the most up-to-date creator status and other fields
    const freshUser = await storage.getUser(req.user.id);

    if (!freshUser) {
      console.log("🔍 [getCurrentUser] User not found in database");
      return res.status(404).json({ message: "User not found" });
    }

    console.log("🔍 [getCurrentUser] Fresh user data from database:");
    console.log("🔍 [getCurrentUser] DB User ID:", freshUser.id);
    console.log("🔍 [getCurrentUser] DB User Email:", freshUser.email);
    console.log("🔍 [getCurrentUser] DB User is_creator:", freshUser.is_creator);
    console.log("🔍 [getCurrentUser] DB User full_name:", freshUser.full_name);

    const { password_hash, ...userWithoutPassword } = freshUser;

    console.log("🔍 [getCurrentUser] Sending back fresh user object:");
    console.log("🔍 [getCurrentUser] Fresh userWithoutPassword.is_creator:", userWithoutPassword.is_creator);
    console.log("🔍 [getCurrentUser] Complete fresh response object:", JSON.stringify({ user: userWithoutPassword }, null, 2));

    res.json({ user: userWithoutPassword });
  } catch (error) {
    console.error("Get current user error:", error);
    res.status(500).json({ message: "Failed to get user" });
  }
}