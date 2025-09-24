import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { storage } from "./storage";
import { generateToken } from "./auth";
import type { User } from "@shared/schema";

// Get credentials from environment variables
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

// Dynamic callback URL that works with Vercel preview/production
const GOOGLE_CALLBACK_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}/api/auth/google/callback`
  : process.env.GOOGLE_CALLBACK_URL || "http://localhost:5000/api/auth/google/callback";

// Check if Google OAuth is configured
const isGoogleOAuthConfigured = GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET;

if (isGoogleOAuthConfigured) {
  console.log("Google OAuth configured:", GOOGLE_CLIENT_SECRET?.substring(0, 10) + "...");
  console.log("GOOGLE_CLIENT_ID:", GOOGLE_CLIENT_ID ? "Set" : "Not set");
  console.log("GOOGLE_CLIENT_SECRET:", GOOGLE_CLIENT_SECRET ? "Set" : "Not set");
  console.log("Callback URL:", GOOGLE_CALLBACK_URL);
}

// Serialize user for session
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await storage.getUser(Number(id));
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Configure Google OAuth2 strategy only if credentials are provided
if (isGoogleOAuthConfigured) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID!,
        clientSecret: GOOGLE_CLIENT_SECRET!,
        callbackURL: GOOGLE_CALLBACK_URL,
        scope: ["profile", "email"],
      },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Extract email from profile
        const email = profile.emails?.[0]?.value;
        if (!email) {
          return done(new Error("No email found in Google profile"), false);
        }

        // Check if user exists
        let user = await storage.getUserByEmail(email);

        if (!user) {
          // Create new user
          user = await storage.createUser({
            email,
            full_name: profile.displayName || email.split("@")[0],
            password_hash: null, // No password for OAuth users
            phone: "", // Optional for OAuth users
            google_id: profile.id,
          });
        } else if (!user.google_id) {
          // Link existing account with Google
          await storage.updateUserGoogleId(user.id, profile.id);
          user.google_id = profile.id;
        }

        return done(null, user);
      } catch (error) {
        console.error("Google OAuth error:", error);
        return done(error as Error, false);
      }
    }
  )
);
} else {
  console.log("Google OAuth not configured - skipping Google strategy setup");
}

export { passport, isGoogleOAuthConfigured };

// Helper function to handle Google OAuth callback
export async function handleGoogleCallback(user: User) {
  // Generate JWT token for the user
  const token = generateToken(user.id.toString());
  const { password_hash, ...userWithoutPassword } = user;
  
  return {
    user: userWithoutPassword,
    token,
  };
}