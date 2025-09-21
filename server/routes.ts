import express, { type Express } from "express";
import { createServer, type Server } from "http";
import fetch from "node-fetch";
import jwt from "jsonwebtoken";
import { storage } from "./storage";
import { generateRecipeWithGrok } from "./grok";
import { createInstacartRecipePage } from "./instacart";
import { getRecipeFromYouTube, findBestRecipeVideo } from "./videoRecipeExtractor";
import { extractFoodNameForNutrition, getServingSizeMultiplier } from "./nutritionParser";
import { parseIngredientsWithGPT } from "./gptIngredientParser";
import { authenticateToken } from "./auth"; // Import JWT auth middleware
import { rateLimiter } from "./rateLimiter";
import { handleLogMealDetection } from "./logmealEndpoint";
import { communityService } from "./communityService";
import { communityCommentsService } from "./communityCommentsService";
import { creatorService } from "./creatorService";
import { mealPlanSharingService } from "./mealPlanSharingService";
import { groqValidator } from "./groqValidator";
import { recipeNutritionCalculator } from "./recipeNutritionCalculator";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";

import Stripe from "stripe";
import { 
  insertProfileSchema, 
  type InsertProfile, 
  users,
  communities,
  communityMembers,
  sharedMealPlans,
  creatorFollowers,
  communityMealCourses,
  communityMealCourseModules,
  communityMealLessons,
  communityPosts,
  communityMealLessonSections,
  userMealCourseProgress,
  type InsertCommunityMealCourse,
  type InsertCommunityMealCourseModule,
  type InsertCommunityMealLesson,
  type InsertCommunityMealLessonSection
} from "@shared/schema";
import { db } from "./db";
import { eq, and, isNull, desc } from "drizzle-orm";

// YouTube API utilities
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_API_BASE_URL = 'https://www.googleapis.com/youtube/v3';

// Stripe configuration
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-07-30.basil",
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware - Replit Auth disabled
  // await setupAuth(app);

  // Auth routes (Replit auth - commented out to use standard auth)
  // app.get('/api/auth/user', authenticateToken, async (req: any, res) => {
  //   try {
  //     // First try to get user by the stored database ID
  //     let replitUser;
  //     if (req.user.dbUserId) {
  //       console.log('🔍 Looking for user with stored DB ID:', req.user.dbUserId);
  //       replitUser = await storage.getUser(req.user.dbUserId);
  //     }
  //     
  //     // If not found, try by Replit ID
  //     if (!replitUser) {
  //       const userId = req.user.claims.sub;
  //       console.log('🔍 Looking for user with Replit ID:', userId);
  //       replitUser = await storage.getUser(userId);
  //     }
  //     
  //     // If still not found, try by email as last resort
  //     if (!replitUser && req.user.claims.email) {
  //       console.log('🔍 Looking for user by email:', req.user.claims.email);
  //       // Create a new user with the correct mapping since email already exists
  //       const userData = {
  //         id: req.user.claims.sub,
  //         email: req.user.claims.email,
  //         firstName: req.user.claims.first_name,
  //         lastName: req.user.claims.last_name,
  //         profileImageUrl: req.user.claims.profile_image_url,
  //       };
  //       replitUser = await storage.upsertUser(userData);
  //       console.log('🔍 Created/updated user via email lookup:', replitUser.id);
  //     }
  //     
  //     console.log('🔍 Found user in DB:', replitUser ? 'YES' : 'NO');
  //     
  //     if (!replitUser) {
  //       console.log('❌ User not found in database');
  //       return res.status(404).json({ message: "User not found" });
  //     }
  //     
  //     // Transform Replit user data to match app's expected format
  //     const transformedUser = {
  //       id: replitUser.id,
  //       email: replitUser.email || '',
  //       phone: '', // Replit doesn't provide phone, use empty string
  //       full_name: [replitUser.firstName, replitUser.lastName].filter(Boolean).join(' ') || replitUser.email?.split('@')[0] || 'User',
  //       created_at: replitUser.createdAt || new Date().toISOString(),
  //       updated_at: replitUser.updatedAt || new Date().toISOString(),
  //       profileImageUrl: replitUser.profileImageUrl
  //     };
  //     
  //     res.json({ user: transformedUser });
  //   } catch (error) {
  //     console.error("Error fetching user:", error);
  //     res.status(500).json({ message: "Failed to fetch user" });
  //   }
  // });

  // CORS test endpoint (no auth required)
  app.get("/api/test-cors", (_req, res) => {
    res.json({ 
      status: "CORS is working correctly!", 
      timestamp: new Date().toISOString(),
      message: "If you can see this from Whop, CORS is configured properly"
    });
  });

  // Standard email/password auth routes
  const { registerUser, loginUser, getCurrentUser, authenticateToken } = await import("./auth");
  
  app.post("/api/auth/register", registerUser);
  app.post("/api/auth/login", loginUser);
  app.get("/api/auth/user", authenticateToken, getCurrentUser);

  // Toggle creator status endpoint (for testing)
  app.post("/api/user/toggle-creator", authenticateToken, async (req: any, res) => {
    try {
      console.log(`🔍 [DEBUG] toggle-creator called`);
      console.log(`🔍 [DEBUG] Request headers:`, req.headers.authorization ? 'Auth header present' : 'No auth header');
      console.log(`🔍 [DEBUG] req.user:`, req.user);
      const userId = req.user?.id;
      if (!userId) {
        console.log(`❌ [DEBUG] No user ID in toggle-creator request`);
        return res.status(401).json({ message: "User not authenticated" });
      }

      // Get current user to check creator status
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Toggle is_creator status
      const newCreatorStatus = !(user.is_creator || false);
      await db.update(users).set({ 
        is_creator: newCreatorStatus,
        updatedAt: new Date() 
      }).where(eq(users.id, userId));

      // Generate new token with updated creator status
      const { generateToken } = await import("./auth");
      const newToken = generateToken(userId, newCreatorStatus);



      res.json({ 
        message: `Creator mode ${newCreatorStatus ? 'enabled' : 'disabled'}`,
        is_creator: newCreatorStatus,
        token: newToken
      });
    } catch (error) {
      console.error("Error toggling creator status:", error);
      res.status(500).json({ message: "Failed to toggle creator status" });
    }
  });

  // Google OAuth routes
  const { passport, isGoogleOAuthConfigured, handleGoogleCallback } = await import("./googleAuth");
  
  if (isGoogleOAuthConfigured) {
    // Initiate Google OAuth login
    app.get("/api/auth/google", (req, res, next) => {
      passport.authenticate("google", {
        scope: ["profile", "email"]
      })(req, res, next);
    });

    // Handle Google OAuth callback
    app.get("/api/auth/google/callback", 
      passport.authenticate("google", { session: false, failureRedirect: "/?error=google_auth_failed" }),
      async (req, res) => {
        try {
          const user = req.user as any;
          if (!user) {
            return res.redirect("/?error=no_user");
          }

          const { token, user: userWithoutPassword } = await handleGoogleCallback(user);
          
          // Redirect to frontend with token and user info
          const userData = encodeURIComponent(JSON.stringify(userWithoutPassword));
          res.redirect(`/?token=${token}&user=${userData}&success=google`);
        } catch (error) {
          res.redirect("/?error=callback_failed");
        }
      }
    );

    console.log("Google OAuth routes registered successfully");
  } else {
    console.log("Google OAuth not configured - routes not registered");
  }

  // Test user routes
  app.post("/api/auth/test-login", async (req, res) => {
    try {
      // Login with test user credentials
      const testEmail = "test@example.com";
      const testPassword = "testuser123";

      const user = await storage.getUserByEmail(testEmail);
      if (!user) {
        // Create test user if it doesn't exist
        const { hashPassword } = await import("./auth");
        const hashedPassword = await hashPassword(testPassword);
        
        const newUser = await storage.createUser({
          email: testEmail,
          phone: "555-TEST-USER",
          password_hash: hashedPassword,
          full_name: "Test User"
        });

        const { generateToken } = await import("./auth");
        const token = generateToken(newUser.id.toString());

        const { password_hash, ...userWithoutPassword } = newUser;
        return res.json({
          user: userWithoutPassword,
          token,
          message: "Test user created and logged in successfully"
        });
      }

      // User exists, generate token
      const { generateToken } = await import("./auth");
      const token = generateToken(user.id.toString());

      const { password_hash, ...userWithoutPassword } = user;
      res.json({
        user: userWithoutPassword,
        token,
        message: "Test user login successful"
      });

    } catch (error: any) {
      res.status(500).json({ message: "Test login failed" });
    }
  });

  app.post("/api/auth/reset-test-user", async (req, res) => {
    try {
      const testEmail = "test@example.com";
      
      // Check if test user exists
      const existingUser = await storage.getUserByEmail(testEmail);
      if (!existingUser) {
        return res.status(404).json({ message: "Test user not found" });
      }

      // Reset password to default
      const { hashPassword } = await import("./auth");
      const defaultPassword = "testuser123";
      const hashedPassword = await hashPassword(defaultPassword);

      // Update user password in database
      await storage.updateUser(existingUser.id, {
        password_hash: hashedPassword
      });
      
      res.json({ 
        message: "Test user reset successfully. Password is now 'testuser123'",
        email: testEmail 
      });

    } catch (error: any) {
      console.error("Test user reset error:", error);
      res.status(500).json({ message: "Failed to reset test user" });
    }
  });

  // Stripe payment routes
  app.get('/api/stripe-publishable-key', (req, res) => {
    try {
      const pk = process.env.STRIPE_PUBLISHABLE_KEY || '';
      if (!pk) {
        return res.status(404).json({ message: 'Publishable key not configured' });
      }
      return res.json({ publishableKey: pk });
    } catch (err) {
      return res.status(500).json({ message: 'Failed to retrieve publishable key' });
    }
  });

  app.post("/api/create-payment-intent", authenticateToken, async (req: any, res) => {
    try {
      const { amount, paymentType } = req.body;
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Set amount based on payment type
      let paymentAmount;
      let description;

      if (paymentType === 'founders') {
        paymentAmount = 10000; // $100.00 in cents
        description = "Healthy Mama Founders Offer - Lifetime Access";
      } else if (paymentType === 'monthly') {
        paymentAmount = 2000; // $20.00 in cents
        description = "Healthy Mama Monthly Subscription";
      } else if (paymentType === 'trial') {
        paymentAmount = 0; // $0 for trial setup
        description = "Healthy Mama 21-Day Premium Trial Setup";
      } else {
        paymentAmount = Math.round((amount || 0) * 100); // Convert to cents
        description = "Healthy Mama Payment";
      }

      // Ensure a Stripe customer and link it to this user
      let customerId = user.stripe_customer_id as string | undefined;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email || undefined,
          name: user.full_name || undefined,
          metadata: { appUserId: String(user.id) },
        });
        customerId = customer.id;
        await storage.updateUser(String(user.id), { stripe_customer_id: customerId });
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount: paymentAmount,
        currency: "usd",
        customer: customerId,
        description: description,
        metadata: {
          paymentType: paymentType || 'general'
        }
      });

      res.json({ 
        clientSecret: paymentIntent.client_secret,
        amount: paymentAmount / 100 // Send back amount in dollars
      });
    } catch (error: any) {
      res.status(500).json({ 
        message: "Error creating payment intent: " + error.message 
      });
    }
  });

  // Create monthly subscription ($20/month)
  app.post('/api/create-monthly-subscription', async (req, res) => {
    try {
      const { paymentMethodId, email, name } = req.body;

      if (!email || !paymentMethodId) {
        return res.status(400).json({ message: 'Email and payment method are required' });
      }

      // Create or retrieve customer
      const customer = await stripe.customers.create({
        email: email,
        name: name || '',
        payment_method: paymentMethodId,
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });

      // Create subscription for $20/month
      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Healthy Mama Monthly',
              description: 'Monthly subscription for meal planning',
            },
            unit_amount: 2000, // $20.00 in cents
            recurring: {
              interval: 'month',
            },
          },
        }],
        payment_settings: {
          payment_method_types: ['card'],
          save_default_payment_method: 'on_subscription',
        },
        expand: ['latest_invoice.payment_intent'],
      });

      res.json({
        subscriptionId: subscription.id,
        customerId: customer.id,
        clientSecret: (subscription.latest_invoice as any)?.payment_intent?.client_secret,
        message: 'Monthly subscription created successfully'
      });
    } catch (error: any) {
      console.error('Error creating monthly subscription:', error);
      res.status(500).json({ 
        message: "Error setting up monthly subscription: " + error.message 
      });
    }
  });

  // Create setup intent for collecting payment method (monthly or trial)
  app.post('/api/create-setup-intent', authenticateToken, async (req: any, res) => {
    try {
      const { paymentType } = req.body;
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Ensure customer exists for this user
      let customerId = user.stripe_customer_id as string | undefined;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email || undefined,
          name: user.full_name || undefined,
          metadata: { appUserId: String(user.id) }
        });
        customerId = customer.id;
        await storage.updateUser(String(user.id), { stripe_customer_id: customerId });
      }

      // Create setup intent for collecting payment method
      const setupIntent = await stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ['card'],
        usage: 'off_session',
        metadata: {
          type: paymentType || 'trial',
          appUserId: String(user.id)
        }
      });

      // If monthly, we'll create the subscription after payment method is confirmed
      // Store the plan details in metadata for later use
      if (paymentType === 'monthly') {
        await stripe.customers.update(customerId, {
          metadata: {
            paymentType: 'monthly',
            pendingSubscription: 'true',
            priceAmount: '2000', // $20 in cents
            appUserId: String(user.id)
          }
        });
      }

      res.json({
        customerId,
        clientSecret: setupIntent.client_secret,
        paymentType: paymentType,
        message: `${paymentType === 'monthly' ? 'Monthly subscription' : 'Trial'} setup created successfully`
      });
    } catch (error: any) {
      res.status(500).json({ 
        message: "Error creating setup intent: " + error.message 
      });
    }
  });

  // Create subscription for 21-day trial (sets up future billing)
  app.post('/api/create-trial-subscription', async (req, res) => {
    try {
      const { email, name } = req.body;

      if (!email) {
        return res.status(400).json({ message: 'Email is required' });
      }

      // Create customer
      const customer = await stripe.customers.create({
        email: email,
        name: name || '',
        metadata: {
          trialType: '21-day-premium'
        }
      });

      // Create setup intent for future payments (trial)
      const setupIntent = await stripe.setupIntents.create({
        customer: customer.id,
        payment_method_types: ['card'],
        usage: 'off_session',
        metadata: {
          type: '21-day-trial'
        }
      });

      res.json({
        customerId: customer.id,
        clientSecret: setupIntent.client_secret,
        message: 'Trial setup created successfully'
      });
    } catch (error: any) {
      res.status(500).json({ 
        message: "Error setting up trial: " + error.message 
      });
    }
  });

  // Stripe webhook handler
  app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    let event;

    try {
      const sig = req.headers['stripe-signature'] as string;
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      
      if (!webhookSecret) {
        console.log('Warning: Stripe webhook secret not configured');
        // In development, we can process without signature verification
        event = JSON.parse(req.body.toString());
      } else {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      }
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
      case 'setup_intent.succeeded':
        const setupIntent = event.data.object as any;
        console.log('SetupIntent succeeded:', setupIntent.id);
        
        // Check if this is for a monthly subscription
        if (setupIntent.metadata?.type === 'monthly') {
          try {
            // Get the customer
            const customer = await stripe.customers.retrieve(setupIntent.customer as string) as any;
            
            if (customer.metadata?.pendingSubscription === 'true') {
              // Create the subscription
              const subscription = await stripe.subscriptions.create({
                customer: customer.id,
                items: [{
                  price_data: {
                    currency: 'usd',
                    product_data: {
                      name: 'Healthy Mama Monthly',
                      description: 'Monthly subscription for meal planning',
                    },
                    unit_amount: 2000, // $20 in cents
                    recurring: {
                      interval: 'month',
                    },
                  },
                }],
                default_payment_method: setupIntent.payment_method,
              });
              
              console.log('Subscription created:', subscription.id);
              
              // Update customer metadata
              await stripe.customers.update(customer.id, {
                metadata: {
                  subscriptionId: subscription.id,
                  subscriptionStatus: 'active',
                  pendingSubscription: 'false'
                }
              });
            }
          } catch (error) {
            console.error('Error creating subscription from webhook:', error);
          }
        } else if (setupIntent.metadata?.type === 'trial') {
          // For trial, create subscription with 30-day trial
          try {
            const customer = await stripe.customers.retrieve(setupIntent.customer as string) as any;
            
            const subscription = await stripe.subscriptions.create({
              customer: customer.id,
              items: [{
                price_data: {
                  currency: 'usd',
                  product_data: {
                    name: 'Healthy Mama Monthly',
                    description: 'Monthly subscription after 30-day trial',
                  },
                  unit_amount: 2000, // $20 in cents
                  recurring: {
                    interval: 'month',
                  },
                },
              }],
              default_payment_method: setupIntent.payment_method,
              trial_period_days: 30, // 30-day free trial
            });
            
            console.log('Trial subscription created:', subscription.id);
            
            // Update customer metadata
            await stripe.customers.update(customer.id, {
              metadata: {
                subscriptionId: subscription.id,
                subscriptionStatus: 'trialing',
                trialEndsAt: new Date(subscription.trial_end! * 1000).toISOString()
              }
            });
          } catch (error) {
            console.error('Error creating trial subscription from webhook:', error);
          }
        }
        break;
        
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object as any;
        console.log('PaymentIntent succeeded:', paymentIntent.id);
        
        // Handle successful one-time payment (founders offer)
        if (paymentIntent.metadata?.paymentType === 'founders') {
          console.log('Founders payment successful for amount:', paymentIntent.amount / 100);
          // You could update user account type in database here
        }
        break;
        
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as any;
        console.log(`Subscription ${event.type}:`, subscription.id);
        const customerId = subscription.customer as string;
        try {
          const user = await storage.getUserByStripeCustomerId(customerId as string);
          if (user) {
            await storage.updateUser(String(user.id), {
              subscription_status: subscription.status,
            });
          }
        } catch (e) {
          console.error('Failed to persist subscription status:', e);
        }
        break;
      }
        
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
  });

  // Recipe generation API
  app.post("/api/recipes/generate", authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      const { 
        recipeType, 
        cuisine, 
        dietRestrictions, 
        cookingTime, 
        availableIngredients, 
        excludeIngredients, 
        description,
        difficulty,
        preferYouTube,
        generationMode,
        skipNutrition,
        skipVideoEnhancement
      } = req.body;

      if (!description) {
        return res.status(400).json({ message: "Recipe description is required" });
      }

      console.log(`Recipe generation request: ${description}`);
      console.log(`Generation mode: ${generationMode || 'legacy'}`);

      let recipe;

      if (generationMode === 'fast') {
        console.log("Fast mode: Finding YouTube video suggestion with Spoonacular time");

        try {
          // First get Spoonacular data for accurate cooking time
          let spoonacularTime = 30; // fallback

          if (process.env.SPOONACULAR_API_KEY) {
            try {
              const params = new URLSearchParams({
                apiKey: process.env.SPOONACULAR_API_KEY,
                query: description,
                number: '1',
                addRecipeInformation: 'true'
              });

              // Add filters to Spoonacular search
              if (cuisine && cuisine !== 'Any Cuisine') {
                params.append('cuisine', cuisine.toLowerCase());
              }
              if (dietRestrictions && dietRestrictions !== 'None') {
                params.append('diet', dietRestrictions.toLowerCase());
              }
              if (cookingTime && cookingTime !== 'Any Time') {
                const timeMap: Record<string, number> = {
                  'Under 15 min': 15,
                  'Under 30 min': 30,
                  'Under 1 hour': 60,
                  '1+ hours': 999
                };
                const maxTime = timeMap[cookingTime];
                if (maxTime) {
                  params.append('maxReadyTime', maxTime.toString());
                }
              }

              const spoonacularUrl = `https://api.spoonacular.com/recipes/complexSearch?${params.toString()}`;
              const response = await fetch(spoonacularUrl);
              const data = await response.json() as any;

              if (data.results && data.results.length > 0) {
                spoonacularTime = data.results[0].readyInMinutes || 30;
                console.log(`Using Spoonacular cooking time: ${spoonacularTime} minutes`);
              }
            } catch (spoonError) {
              console.log("Spoonacular lookup failed, using default time");
            }
          }

          // Fast mode: Just find a YouTube video without full recipe extraction
          const videoInfo = await findBestRecipeVideo(description, {
            cuisine,
            diet: dietRestrictions,
            cookingTime,
            availableIngredients,
            excludeIngredients
          }, spoonacularTime);

          if (videoInfo) {
            // Create a minimal recipe object with just video info and Spoonacular time
            recipe = {
              title: videoInfo.title,
              description: `Watch this video: "${videoInfo.title}" by ${videoInfo.channelTitle}`,
              image_url: videoInfo.thumbnailUrl,
              time_minutes: spoonacularTime, // Use Spoonacular time instead of default
              cuisine: cuisine || 'Any Cuisine',
              diet: dietRestrictions || 'None',
              ingredients: [`Watch the video for ingredients`],
              instructions: [`Follow along with the video: ${videoInfo.title}`],
              source_url: `https://www.youtube.com/watch?v=${videoInfo.id}`,
              source_name: videoInfo.channelTitle,
              video_id: videoInfo.id,
              video_title: videoInfo.title,
              video_channel: videoInfo.channelTitle,
              total_nutrition: {
                calories: 0,
                protein: 0,
                carbs: 0,
                fat: 0,
                fiber: 0,
                sugar: 0,
                sodium: 0
              }
            };
          } else {
            return res.status(404).json({ message: "No suitable video found for your query" });
          }
        } catch (error) {
          console.error("Fast mode video search failed:", error);
          return res.status(500).json({ message: "Failed to find video suggestion" });
        }
      } else {
        // Detailed mode: Full recipe generation with YouTube extraction
        console.log("Detailed mode: Generating complete recipe");

        try {
          // Get a complete recipe from YouTube video with enhanced filter-aware search
          const youtubeRecipe = await getRecipeFromYouTube(description, {
            cuisine,
            diet: dietRestrictions,
            cookingTime,
            availableIngredients,
            excludeIngredients
          });

          if (youtubeRecipe) {
            console.log("Successfully extracted recipe data from YouTube");
            console.log(`Recipe has ${youtubeRecipe.ingredients.length} ingredients and ${youtubeRecipe.instructions.length} instructions`);
            
            // Add any additional user preferences and ensure image URL is set
            youtubeRecipe.cuisine = cuisine || youtubeRecipe.cuisine;
            youtubeRecipe.diet = dietRestrictions || youtubeRecipe.diet;
            youtubeRecipe.image_url = youtubeRecipe.thumbnailUrl || youtubeRecipe.image_url;

            // If ingredients look like a placeholder (single string without measurements), try GROQ transcript extraction
            const lacksStructuredIngredients = Array.isArray(youtubeRecipe.ingredients)
              && youtubeRecipe.ingredients.length <= 2
              && youtubeRecipe.ingredients.every((ing: any) => typeof ing === 'string');

            if (lacksStructuredIngredients && (youtubeRecipe.transcript || youtubeRecipe.description)) {
              try {
                const { groqIngredientExtractor } = await import('./groqIngredientExtractor');
                const extracted = await groqIngredientExtractor.extractFromTranscript(
                  youtubeRecipe.transcript || youtubeRecipe.description,
                  youtubeRecipe.title
                );
                if (Array.isArray(extracted) && extracted.length > 0) {
                  console.log(`✅ [ING PARSER] Replaced loose ingredients with ${extracted.length} structured items from transcript`);
                  youtubeRecipe.ingredients = extracted;
                } else {
                  console.log('⚠️ [ING PARSER] Transcript extraction returned no items; keeping original list');
                }
              } catch (e) {
                console.error('[ING PARSER] transcript extraction failed:', e);
              }
            }

            // Ensure instructions are generated AFTER ingredient finalization
            if (!youtubeRecipe.instructions || (Array.isArray(youtubeRecipe.instructions) && youtubeRecipe.instructions.length === 0)) {
              try {
                const { groqInstructionGenerator } = await import('./groqInstructionGenerator');
                const textToUse = youtubeRecipe.transcript || youtubeRecipe.description || '';
                const ingredientNames = (youtubeRecipe.ingredients || []).map((ing: any) =>
                  typeof ing === 'string' ? ing : ing.name || ing.display_text
                );
                if (textToUse.length > 50) {
                  const generated = await groqInstructionGenerator.generateInstructionsFromTranscript(
                    textToUse,
                    youtubeRecipe.title,
                    ingredientNames
                  );
                  if (generated.length > 0) {
                    console.log(`✅ [INSTR GEN] Generated ${generated.length} instructions after ingredient finalization`);
                    youtubeRecipe.instructions = generated;
                  } else {
                    youtubeRecipe.instructions = [];
                  }
                }
              } catch (e) {
                console.error('[INSTR GEN] post-ingredient generation failed:', e);
                youtubeRecipe.instructions = youtubeRecipe.instructions || [];
              }
            }

            recipe = youtubeRecipe;
          } else {
            console.log("No suitable YouTube recipe found");
            return res.status(404).json({ message: "No suitable recipe found for your query. Please try a different search term." });
          }
        } catch (youtubeError) {
          console.error("YouTube recipe extraction failed:", youtubeError);
          return res.status(500).json({
            message: "Recipe generation failed. Please try again with a different search term.",
            error: youtubeError.message
          });
        }
      }

      // Save and return the recipe (for both fast and detailed modes)
      if (recipe) {
        // Optional ingredient normalization via Groq (local check, no Groq for checking)
        if (recipe.ingredients && recipe.ingredients.length > 0) {
          try {
            const threshold = parseInt(process.env.INGREDIENT_NORMALIZE_THRESHOLD || '20', 10);
            // Build raw strings from current ingredients
            const rawStringsForCheck = recipe.ingredients.map((ing: any) => {
              if (typeof ing === 'string') return ing;
              if (ing.display_text) return ing.display_text;
              if (ing.name) return String(ing.name);
              return '';
            }).filter((s: string) => s.trim().length > 0);

            const needsGroqNormalization = rawStringsForCheck.some((s: string) => s.trim().length > threshold);

            if (needsGroqNormalization) {
              console.log(`🧼 [ING NORM] Detected long ingredient lines (> ${threshold} chars). Normalizing with GPT-OSS-20B...`);
              const { groqIngredientParser } = await import('./groqIngredientParser');
              const parsed = await groqIngredientParser.parseIngredients(rawStringsForCheck);

              if (Array.isArray(parsed) && parsed.length > 0) {
                // Map parsed ingredients back to our structure
                const normalized = parsed.map((p: any) => {
                  const display = p.amount ? `${p.amount} ${p.ingredient}`.trim() : p.ingredient;
                  const measurements = [] as Array<{ quantity: number; unit: string }>;
                  if (typeof p.quantity === 'number' && p.quantity > 0) {
                    measurements.push({ quantity: p.quantity, unit: (p.unit || 'item').toString() });
                  }
                  return {
                    name: String(p.ingredient || '').toLowerCase(),
                    display_text: display,
                    measurements
                  };
                });

                // Only apply if normalization yields a reasonable list
                if (normalized.length >= Math.min(3, recipe.ingredients.length)) {
                  recipe.ingredients = normalized as any;
                  console.log(`✅ [ING NORM] Normalized ${normalized.length} ingredients with GPT-OSS-20B`);
                } else {
                  console.log('⚠️ [ING NORM] Normalization returned too few items; keeping original ingredients');
                }
              } else {
                console.log('⚠️ [ING NORM] Groq normalization returned empty; keeping original ingredients');
              }
            } else {
              console.log('🧼 [ING NORM] Ingredients look concise; skipping Groq normalization');
            }
          } catch (normError) {
            console.warn('⚠️ [ING NORM] Normalization step failed, continuing with original ingredients:', normError);
          }
        }

        // Add nutrition calculation using our new integrated calculator
        if (!skipNutrition && recipe.ingredients && recipe.ingredients.length > 0) {
          try {
            console.log('🍎 Starting nutrition calculation for recipe:', recipe.title);
            
            // Extract ingredient strings from recipe
            const ingredientStrings = recipe.ingredients.map((ing: any) => {
              if (typeof ing === 'string') {
                return ing;
              } else if (ing.display_text) {
                return ing.display_text;
              } else if (ing.measurements && ing.measurements.length > 0) {
                const measurement = ing.measurements[0];
                return `${measurement.quantity} ${measurement.unit} ${ing.name}`;
              }
              return ing.name || '';
            }).filter((s: string) => s.length > 0);

            console.log(`📝 Processing ${ingredientStrings.length} ingredients`);
            
            // Calculate nutrition using the new calculator
            const servings = recipe.servings || 4;
            const nutritionResult = await recipeNutritionCalculator.calculateRecipeNutrition(
              ingredientStrings,
              servings
            );

            if (nutritionResult) {
              // Add nutrition info to recipe
              recipe.nutrition_info = {
                // Per serving nutrition
                calories: nutritionResult.perServing.calories,
                protein_g: nutritionResult.perServing.protein,
                carbs_g: nutritionResult.perServing.carbs,
                fat_g: nutritionResult.perServing.fat,
                fiber_g: nutritionResult.perServing.fiber,
                sugar_g: nutritionResult.perServing.sugar,
                sodium_mg: nutritionResult.perServing.sodium,
                cholesterol_mg: nutritionResult.perServing.cholesterol,
                saturated_fat_g: nutritionResult.perServing.saturatedFat,
                trans_fat_g: nutritionResult.perServing.transFat,
                // Servings and totals
                servings: nutritionResult.servings,
                total_calories: nutritionResult.total.calories,
                total_protein_g: nutritionResult.total.protein,
                total_carbs_g: nutritionResult.total.carbs,
                total_fat_g: nutritionResult.total.fat,
                total_fiber_g: nutritionResult.total.fiber,
                total_sugar_g: nutritionResult.total.sugar,
                total_sodium_mg: nutritionResult.total.sodium,
                // Include the ingredient breakdown for transparency
                ingredient_nutrition: nutritionResult.ingredientBreakdown.map(item => ({
                  ingredient: item.ingredient,
                  amount: item.amount,
                  calories: item.nutrition.calories,
                  protein: item.nutrition.protein,
                  carbs: item.nutrition.carbs,
                  fat: item.nutrition.fat
                }))
              };

              console.log(`✅ Nutrition calculated successfully:`);
              console.log(`   Per serving: ${nutritionResult.perServing.calories} cal`);
              console.log(`   Macros: ${nutritionResult.perServing.protein}g protein, ${nutritionResult.perServing.carbs}g carbs, ${nutritionResult.perServing.fat}g fat`);
            } else {
              console.log('⚠️ Nutrition calculation returned null, proceeding without nutrition data');
            }
          } catch (nutritionError: any) {
            console.error('❌ Nutrition calculation failed:', nutritionError.message);
            console.log('Proceeding without nutrition data');
          }
        }

        // Debug: Check video data before saving
        console.log("Recipe video data before saving:", {
          video_id: recipe.video_id,
          video_title: recipe.video_title,
          video_channel: recipe.video_channel
        });

        // Ensure all required fields are included when saving
        const recipeToSave = {
          ...recipe,
          video_id: recipe.video_id || null,
          video_title: recipe.video_title || null,
          video_channel: recipe.video_channel || null,
          time_minutes: recipe.time_minutes || recipe.timeMinutes || 30, // Default to 30 min if not set
          image_url: recipe.image_url || recipe.imageUrl || `https://source.unsplash.com/800x600/?food,${encodeURIComponent(recipe.title.toLowerCase())},cooking,delicious`
        };

        // DISH NAME MAPPING: Map to familiar, recognizable names
        let familiarTitle = recipeToSave.title;
        try {
          const { mapToFamiliarDishName } = await import('./familiarDishNameMapper');
          const mapping = mapToFamiliarDishName(
            recipeToSave.title,
            'unknown', // default cuisine type if not available
            recipeToSave.ingredients
          );

          if (mapping.confidence > 0.6) {
            console.log(`📝 Dish name mapping: "${recipeToSave.title}" → "${mapping.familiarName}" (${mapping.cuisine}, confidence: ${mapping.confidence})`);
            familiarTitle = mapping.familiarName;
          }
        } catch (mappingError) {
          console.warn('Dish name mapping error:', mappingError);
          // Continue with original title
        }

        // INSTRUCTION VALIDATION: Validate instructions with GPT-OSS-20B
        console.log('🔍 [RECIPE GENERATION] Starting instruction validation for recipe:', recipeToSave.title);
        console.log('📝 [RECIPE GENERATION] Original instructions type:', typeof recipeToSave.instructions);
        console.log('📝 [RECIPE GENERATION] Original instructions:', 
          Array.isArray(recipeToSave.instructions) 
            ? `Array with ${recipeToSave.instructions.length} items: ${JSON.stringify(recipeToSave.instructions.slice(0, 2))}...`
            : typeof recipeToSave.instructions === 'string'
            ? recipeToSave.instructions.substring(0, 200) + '...' 
            : recipeToSave.instructions
        );
        
        const isInstructionsValid = await groqValidator.validateInstructions(recipeToSave.instructions);
        
        if (!isInstructionsValid) {
          console.log('❌ [RECIPE GENERATION] Instructions FAILED validation');
          
          // Try to generate proper instructions using GPT-OSS-20B
          if (recipeToSave.transcript || recipeToSave.description) {
            console.log('🤖 [RECIPE GENERATION] Attempting to generate instructions with GPT-OSS-20B');
            try {
              const { groqInstructionGenerator } = await import('./groqInstructionGenerator');
              const generatedInstructions = await groqInstructionGenerator.generateInstructionsFromTranscript(
                recipeToSave.transcript || recipeToSave.description || '',
                recipeToSave.title,
                recipeToSave.ingredients?.map((ing: any) => 
                  typeof ing === 'string' ? ing : ing.name || ing.display_text
                )
              );
              
              if (generatedInstructions.length > 0) {
                console.log(`✅ [RECIPE GENERATION] Generated ${generatedInstructions.length} instructions with GPT-OSS-20B`);
                recipeToSave.instructions = generatedInstructions;
              } else {
                console.log('⚠️ [RECIPE GENERATION] Could not generate instructions, using fallback message');
                recipeToSave.instructions = ["No instructions available"];
              }
            } catch (genError) {
              console.error('Error generating instructions:', genError);
              recipeToSave.instructions = ["No instructions available"];
            }
          } else {
            console.log('⚠️ [RECIPE GENERATION] No transcript/description available for generation');
            recipeToSave.instructions = ["No instructions available"];
          }
        } else {
          console.log('✅ [RECIPE GENERATION] Instructions PASSED validation');
          // If valid but empty array (shouldn't happen), fix it
          if (Array.isArray(recipeToSave.instructions) && recipeToSave.instructions.length === 0) {
            console.log('⚠️ [RECIPE GENERATION] Valid but empty array detected, replacing with message');
            recipeToSave.instructions = ["No instructions available"];
          }
        }
        
        console.log('📝 [RECIPE GENERATION] Final instructions:', recipeToSave.instructions);

        // DIETARY VALIDATION: Check recipe compliance before saving
        let finalRecipe = { ...recipeToSave, title: familiarTitle, user_id: userId };
        if (dietRestrictions) {
          try {
            const { validateRecipeDietaryCompliance, getSuggestedRecipeFixes } = await import('./dietaryValidationService');

            const validation = await validateRecipeDietaryCompliance(recipeToSave, [dietRestrictions]);
            console.log(`🔍 Dietary validation: ${validation.isCompliant ? 'PASS' : 'FAIL'} (${validation.violations.length} violations)`);

            if (!validation.isCompliant) {
              console.warn(`❌ Dietary violations detected for "${dietRestrictions}":`, validation.violations.map(v => v.ingredient));

              // Try to automatically fix the recipe
              const fixedRecipe = await getSuggestedRecipeFixes(recipeToSave, validation, [dietRestrictions]);

              // Re-validate the fixed recipe
              const revalidation = await validateRecipeDietaryCompliance(fixedRecipe, [dietRestrictions]);

              if (revalidation.isCompliant) {
                console.log(`✅ Recipe automatically fixed for dietary compliance`);
                finalRecipe = fixedRecipe;
              } else {
                console.warn(`⚠️ Could not fully fix recipe, serving with warnings`);
                // Add validation warnings to recipe metadata
                finalRecipe.dietary_warnings = validation.suggestions;
                finalRecipe.dietary_compliance_score = validation.confidence;
              }
            } else {
              console.log(`✅ Recipe passes dietary validation for "${dietRestrictions}"`);
            }
          } catch (validationError) {
            console.error('Dietary validation error:', validationError);
            // Continue without validation rather than failing
          }
        }

        const savedRecipe = await storage.createRecipe(finalRecipe);
        
        console.log("Returning recipe with video data:", {
          id: savedRecipe.id,
          title: savedRecipe.title,
          video_id: savedRecipe.video_id,
          video_title: savedRecipe.video_title,
          video_channel: savedRecipe.video_channel,
          dietary_validated: !!dietRestrictions
        });
        return res.json(savedRecipe);
      } else {
        return res.status(500).json({ message: "Failed to generate recipe" });
      }
    } catch (error) {
      console.error("Error generating recipe:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return res.status(500).json({ message: `Failed to generate recipe: ${errorMessage}` });
    }
  });

  // Get popular recipes
  app.get("/api/recipes/popular", async (_req, res) => {
    try {
      const recipes = await storage.getPopularRecipes();
      res.json(recipes);
    } catch (error) {
      console.error("Error fetching popular recipes:", error);
      res.status(500).json({ message: "Failed to fetch popular recipes" });
    }
  });

  // Get saved recipes
  app.get("/api/recipes/saved", authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }
      const recipes = await storage.getSavedRecipes(userId);
      res.json(recipes);
    } catch (error) {
      console.error("Error fetching saved recipes:", error);
      res.status(500).json({ message: "Failed to fetch saved recipes" });
    }
  });

  // Get generated recipes
  app.get("/api/recipes/generated", authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }
      const recipes = await storage.getGeneratedRecipes(userId);
      res.json(recipes);
    } catch (error) {
      console.error("Error fetching generated recipes:", error);
      res.status(500).json({ message: "Failed to fetch generated recipes" });
    }
  });

  // Create a new user recipe
  app.post("/api/recipes/create", authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      const {
        title,
        description,
        image_url,
        time_minutes,
        cuisine,
        diet,
        ingredients,
        instructions,
        nutrition_info
      } = req.body;

      if (!title?.trim()) {
        return res.status(400).json({ message: "Recipe title is required" });
      }

      if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
        return res.status(400).json({ message: "At least one ingredient is required" });
      }

      if (!instructions || !Array.isArray(instructions) || instructions.length === 0) {
        return res.status(400).json({ message: "At least one instruction is required" });
      }

      // Create user recipe in database
      const newRecipe = await storage.createUserRecipe({
        user_id: userId,
        title: title.trim(),
        description: description?.trim() || "",
        image_url: image_url || null,
        time_minutes: parseInt(time_minutes) || 0,
        cuisine: cuisine?.trim() || "homemade",
        diet: diet?.trim() || "",
        ingredients: ingredients,
        instructions: instructions,
        nutrition_info: nutrition_info || {}
      });

      console.log(`✅ Created user recipe ${newRecipe.id}: "${title}"`);
      res.json(newRecipe);
    } catch (error) {
      console.error("Error creating user recipe:", error);
      res.status(500).json({ message: "Failed to create recipe" });
    }
  });

  // Save recipe as meal plan for community display
  app.post("/api/community-recipes/save-as-meal-plan", authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const {
        title,
        description,
        image_url,
        time_minutes,
        cuisine,
        diet,
        ingredients,
        instructions,
        nutrition_info
      } = req.body;

      if (!title?.trim()) {
        return res.status(400).json({ message: "Recipe title is required" });
      }

      if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
        return res.status(400).json({ message: "At least one ingredient is required" });
      }

      if (!instructions || !Array.isArray(instructions) || instructions.length === 0) {
        return res.status(400).json({ message: "At least one instruction is required" });
      }

      // Transform recipe data to meal plan format
      const mealPlanData = {
        userId: userId,
        name: title.trim(),
        description: description?.trim() || `Delicious ${title.trim()} recipe`,
        mealPlan: {
          "Day 1": {
            "meal": {
              title: title.trim(),
              ingredients: ingredients,
              instructions: instructions,
              image_url: image_url || null,
              prep_time: parseInt(time_minutes) || 30,
              cook_time: parseInt(time_minutes) || 30,
              servings: 4,
              cuisine: cuisine?.trim() || "homemade",
              diet: diet?.trim() || "",
              nutrition_info: nutrition_info || {
                calories: 0,
                protein_g: 0,
                carbs_g: 0,
                fat_g: 0
              }
            }
          }
        },
        isAutoSaved: false
      };

      // Save using the existing meal plan save functionality
      const savedMealPlan = await storage.saveMealPlan(mealPlanData);

      console.log(`✅ Created meal plan from recipe "${title}" with ID: ${savedMealPlan.id}`);
      res.json({
        ...savedMealPlan,
        message: "Recipe saved as meal plan successfully"
      });
    } catch (error) {
      console.error("Error saving recipe as meal plan:", error);
      res.status(500).json({ message: "Failed to save recipe as meal plan" });
    }
  });

  // Get user's created recipes
  app.get("/api/recipes/user", authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      const userRecipes = await storage.getUserCreatedRecipes(userId);
      res.json(userRecipes);
    } catch (error) {
      console.error("Error fetching user recipes:", error);
      res.status(500).json({ message: "Failed to fetch user recipes" });
    }
  });

  // Delete a user's created recipe
  app.delete("/api/recipes/user/:id", authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      const recipeId = parseInt(req.params.id);
      if (isNaN(recipeId)) {
        return res.status(400).json({ message: "Invalid recipe ID" });
      }

      const success = await storage.deleteUserRecipe(recipeId, userId);
      if (success) {
        console.log(`✅ Deleted user recipe ${recipeId} for user ${userId}`);
        res.json({ success: true, message: "Recipe deleted successfully" });
      } else {
        res.status(404).json({ message: "Recipe not found or not owned by user" });
      }
    } catch (error) {
      console.error("Error deleting user recipe:", error);
      res.status(500).json({ message: "Failed to delete recipe" });
    }
  });

  // Save a recipe
  app.post("/api/recipes/:id/save", authenticateToken, async (req: any, res) => {
    try {
      const recipeId = parseInt(req.params.id);

      if (isNaN(recipeId)) {
        console.log(`Invalid recipe ID: ${req.params.id}`);
        return res.status(400).json({ message: "Invalid recipe ID" });
      }

      console.log(`Attempting to save recipe ${recipeId}`);

      // Check if recipe exists first
      const recipe = await storage.getRecipeById(recipeId);
      if (!recipe) {
        console.log(`Recipe ${recipeId} not found in database`);
        return res.status(404).json({ message: "Recipe not found" });
      }

      const savedRecipe = await storage.saveRecipe(recipeId);

      if (savedRecipe) {
        console.log(`Recipe ${recipeId} saved successfully:`, savedRecipe);
        res.json({ 
          message: "Recipe saved successfully",
          recipe: savedRecipe,
          success: true 
        });
      } else {
        console.log(`Failed to save recipe ${recipeId} - storage returned null`);
        res.status(500).json({ message: "Failed to save recipe - storage error" });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      console.error("Error saving recipe:", {
        recipeId: req.params.id,
        error: errorMessage,
        stack: errorStack
      });
      res.status(500).json({ 
        message: "Failed to save recipe", 
        error: errorMessage,
        success: false
      });
    }
  });

  // Unsave a recipe
  app.delete("/api/recipes/:id/save", authenticateToken, async (req: any, res) => {
    try {
      const recipeId = parseInt(req.params.id);

      if (isNaN(recipeId)) {
        console.log(`Invalid recipe ID for unsave: ${req.params.id}`);
        return res.status(400).json({ message: "Invalid recipe ID" });
      }

      console.log(`Attempting to unsave recipe ${recipeId}`);

      const result = await storage.unsaveRecipe(recipeId);

      console.log(`Recipe ${recipeId} unsaved successfully, result:`, result);
      res.json({ 
        message: "Recipe unsaved successfully",
        success: true
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      console.error("Error unsaving recipe:", {
        recipeId: req.params.id,
        error: errorMessage,
        stack: errorStack
      });
      res.status(500).json({ 
        message: "Failed to unsave recipe", 
        error: errorMessage,
        success: false
      });
    }
  });

  // Create shoppable recipe with Instacart
  app.post("/api/recipes/instacart", async (req, res) => {
    try {
      const recipe = req.body;

      if (!recipe || !recipe.title) {
        return res.status(400).json({ message: "Recipe data is required" });
      }

      const shoppableRecipe = await createInstacartRecipePage(recipe);
      res.json(shoppableRecipe);
    } catch (error) {
      console.error("Error creating shoppable recipe:", error);
      res.status(500).json({ message: "Failed to create shoppable recipe" });
    }
  });

  // Create Instacart shopping list (for Search page)
  app.post("/api/instacart/create-list", async (req, res) => {
    try {
      const { ingredients, recipeName } = req.body;

      if (!ingredients || !Array.isArray(ingredients) || !recipeName) {
        return res.status(400).json({ message: "Recipe ingredients and name are required" });
      }

      // Format ingredients for Instacart API
      const formattedIngredients = ingredients.map((ingredient: string, index: number) => ({
        name: ingredient,
        display_text: ingredient,
        measurements: [{
          quantity: 1,
          unit: "item"
        }]
      }));

      const recipeData = {
        title: recipeName,
        image_url: "", // Optional - can be empty
        link_type: "recipe",
        instructions: ["Follow the recipe instructions"],
        ingredients: formattedIngredients,
        landing_page_configuration: {
          partner_linkback_url: process.env.REPLIT_DOMAINS ? 
            `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : 
            "https://example.com",
          enable_pantry_items: true
        }
      };

      const shoppableRecipe: any = await createInstacartRecipePage(recipeData);

      // Return the shopping URL that the frontend expects
      res.json({ 
        shopping_url: shoppableRecipe?.products_link_url || shoppableRecipe?.link_url || shoppableRecipe?.url,
        ...shoppableRecipe 
      });
    } catch (error) {
      console.error("Error creating Instacart shopping list:", error);
      res.status(500).json({ message: "Failed to create shopping list" });
    }
  });
  
  // Create shopping list from meal plan (for Grocery List Panel)
  app.post("/api/create-shopping-list", authenticateToken, async (req: any, res) => {
    console.log("🛒 Create shopping list endpoint hit");
    console.log("Request body:", req.body);
    console.log("User:", req.user);
    
    try {
      const { mealPlanId } = req.body;
      const userId = req.user?.id;
      
      if (!userId) {
        console.log("❌ No user ID found");
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      if (!mealPlanId) {
        console.log("❌ No meal plan ID provided");
        return res.status(400).json({ message: "Meal plan ID is required" });
      }
      
      // Check if we have cached grocery list
      console.log("📦 Checking for cached grocery list:", mealPlanId);
      const cachedGroceryList = await storage.getGroceryListCache(mealPlanId, userId);
      
      if (cachedGroceryList) {
        console.log("✅ Using cached grocery list from database");
        console.log("   Cache created at:", cachedGroceryList.created_at);
        console.log("   Has Instacart URL:", !!cachedGroceryList.shopping_url);
        
        // If we have a cached Instacart URL, return it immediately
        if (cachedGroceryList.shopping_url) {
          return res.json({
            shoppingUrl: cachedGroceryList.shopping_url,
            consolidatedIngredients: cachedGroceryList.consolidated_ingredients,
            savings: cachedGroceryList.savings,
            recommendations: cachedGroceryList.recommendations,
            fromCache: true
          });
        }
        
        // We have cached ingredients but no Instacart URL yet
        // Generate the Instacart URL and update cache
        try {
          const { createInstacartRecipePage } = await import("./instacart");
          
          const recipeData = {
            title: `Meal Plan Shopping List`,
            description: `Shopping list for your meal plan`,
            ingredients: cachedGroceryList.consolidated_ingredients
          };
          
          const shoppableRecipe: any = await createInstacartRecipePage(recipeData);
          const shoppingUrl = shoppableRecipe?.products_link_url || shoppableRecipe?.link_url || shoppableRecipe?.url;
          
          // Update cache with the Instacart URL
          if (shoppingUrl) {
            await storage.saveGroceryListCache({
              meal_plan_id: mealPlanId,
              user_id: userId,
              consolidated_ingredients: cachedGroceryList.consolidated_ingredients,
              shopping_url: shoppingUrl,
              savings: cachedGroceryList.savings,
              recommendations: cachedGroceryList.recommendations,
              expires_at: cachedGroceryList.expires_at
            });
          }
          
          return res.json({
            shoppingUrl,
            consolidatedIngredients: cachedGroceryList.consolidated_ingredients,
            savings: cachedGroceryList.savings,
            recommendations: cachedGroceryList.recommendations,
            fromCache: true,
            ...shoppableRecipe
          });
        } catch (instacartError) {
          console.error("⚠️ Failed to generate Instacart URL, returning cached data:", instacartError);
          // Return cached data without Instacart URL
          return res.json({
            consolidatedIngredients: cachedGroceryList.consolidated_ingredients,
            savings: cachedGroceryList.savings,
            recommendations: cachedGroceryList.recommendations,
            fromCache: true
          });
        }
      }
      
      // No cache, proceed with normal flow
      console.log("📋 No cache found, fetching meal plan:", mealPlanId, "for user:", userId);
      const mealPlan = await storage.getMealPlan(mealPlanId, userId);
      if (!mealPlan) {
        console.log("❌ Meal plan not found");
        return res.status(404).json({ message: "Meal plan not found" });
      }
      console.log("✅ Meal plan found:", mealPlan.name);
      
      // Extract all ingredients from the meal plan
      const allIngredients: string[] = [];
      Object.entries(mealPlan.mealPlan).forEach(([day, dayMeals]: [string, any]) => {
        Object.entries(dayMeals).forEach(([mealType, meal]: [string, any]) => {
          if (meal && meal.ingredients) {
            allIngredients.push(...meal.ingredients);
          }
        });
      });
      
      // Intelligently consolidate ingredients using AI
      console.log("🤖 Consolidating ingredients with AI...");
      const { consolidateIngredientsWithAI, formatForInstacart } = await import("./intelligentGroceryListOptimizer");
      const consolidationResult = await consolidateIngredientsWithAI(allIngredients);
      
      console.log(`✅ Consolidated ${allIngredients.length} ingredients into ${consolidationResult.consolidatedIngredients.length} items`);
      console.log(`💰 Removed ${consolidationResult.savings.duplicatesRemoved} duplicates`);
      
      // Format ingredients for Instacart API
      const formattedIngredients = await formatForInstacart(consolidationResult.consolidatedIngredients);
      
      const recipeData = {
        title: `Grocery List for ${mealPlan.name}`,
        image_url: "",
        link_type: "recipe",
        instructions: ["Shop for ingredients"],
        ingredients: formattedIngredients,
        landing_page_configuration: {
          partner_linkback_url: process.env.REPLIT_DOMAINS ? 
            `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : 
            "https://example.com",
          enable_pantry_items: true
        }
      };
      
      // Check if Instacart API key is available
      console.log("🔑 Instacart API key status:", process.env.INSTACART_API_KEY ? "Available" : "Not found");
      if (!process.env.INSTACART_API_KEY) {
        throw new Error("Instacart API key is required. Set the INSTACART_API_KEY environment variable.");
      }
      
      const { createInstacartRecipePage } = await import("./instacart");
      const shoppableRecipe: any = await createInstacartRecipePage(recipeData);
      const shoppingUrl = shoppableRecipe?.products_link_url || shoppableRecipe?.link_url || shoppableRecipe?.url;
      
      // Save to cache for future use
      try {
        await storage.saveGroceryListCache({
          meal_plan_id: mealPlanId,
          user_id: userId,
          consolidated_ingredients: consolidationResult.consolidatedIngredients,
          shopping_url: shoppingUrl,
          savings: consolidationResult.savings,
          recommendations: consolidationResult.recommendations,
          expires_at: null // Will default to 7 days
        });
        console.log('✅ Grocery list cached for meal plan:', mealPlanId);
      } catch (cacheError) {
        console.error('⚠️ Failed to cache grocery list (non-critical):', cacheError);
      }
      
      // Return the shopping URL with consolidation info
      res.json({ 
        shoppingUrl,
        consolidatedIngredients: consolidationResult.consolidatedIngredients,
        savings: consolidationResult.savings,
        recommendations: consolidationResult.recommendations,
        ...shoppableRecipe 
      });
    } catch (error) {
      console.error("Error creating shopping list:", error);
      res.status(500).json({ message: "Failed to create shopping list" });
    }
  });

  // Meal plan CRUD operations
  app.get("/api/meal-plans/saved", authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const savedPlans = await storage.getSavedMealPlans(userId);
      console.log('Raw meal plans from DB:', JSON.stringify(savedPlans.slice(0, 1), null, 2));

      // CRITICAL FIX: Map database field (mealPlan) to frontend field (meal_plan)
      const formattedPlans = savedPlans.map(plan => {
        const { mealPlan, ...planWithoutMealPlan } = plan;
        return {
          ...planWithoutMealPlan,
          meal_plan: mealPlan // Map camelCase DB field to snake_case frontend field
        };
      });

      console.log('Formatted meal plans for frontend:', JSON.stringify(formattedPlans.slice(0, 1), null, 2));
      res.json(formattedPlans);
    } catch (error) {
      console.error("Error fetching saved meal plans:", error);
      res.status(500).json({ message: "Failed to fetch meal plans" });
    }
  });

  app.post("/api/meal-plans", authenticateToken, async (req: any, res) => {
    try {
      console.log('🔍 MEAL PLAN SAVE DEBUG:');
      console.log('   - Request headers:', req.headers.authorization ? 'Authorization Present' : 'No Auth Header');
      console.log('   - User from token:', req.user?.id || 'No user ID');
      console.log('   - Request body keys:', Object.keys(req.body));
      
      const userId = req.user?.id;
      if (!userId) {
        console.log('❌ SAVE FAILED: User not authenticated');
        return res.status(401).json({ message: "User not authenticated" });
      }

      const { name, description, meal_plan, is_auto_saved } = req.body;
      console.log('   - Plan name:', name);
      console.log('   - Meal plan exists:', !!meal_plan);
      console.log('   - Meal plan days:', meal_plan ? Object.keys(meal_plan) : 'none');

      if (!name || !meal_plan) {
        console.log('❌ SAVE FAILED: Missing required fields');
        return res.status(400).json({ message: "Name and meal plan are required" });
      }

      // Enhanced validation for meal plan structure
      if (typeof meal_plan !== 'object' || meal_plan === null) {
        console.log('❌ SAVE FAILED: meal_plan is not an object');
        return res.status(400).json({ message: "Invalid meal plan structure" });
      }

      const dayKeys = Object.keys(meal_plan);
      if (dayKeys.length === 0) {
        console.log('❌ SAVE FAILED: meal_plan has no days');
        return res.status(400).json({ message: "Meal plan must contain at least one day" });
      }

      // Validate each day has at least one meal
      for (const dayKey of dayKeys) {
        const dayMeals = meal_plan[dayKey];
        if (!dayMeals || typeof dayMeals !== 'object' || Object.keys(dayMeals).length === 0) {
          console.log(`❌ SAVE FAILED: ${dayKey} has no meals`);
          return res.status(400).json({ message: `Day ${dayKey} must contain at least one meal` });
        }
      }

      console.log('💾 Calling storage.saveMealPlan...');
      const savedPlan = await storage.saveMealPlan({
        userId: userId,
        name,
        description: description || "",
        mealPlan: meal_plan,
        isAutoSaved: is_auto_saved || false
      });

      console.log('✅ SAVE SUCCESS:', savedPlan?.id || 'unknown ID');
      
      // Auto-generate and cache the grocery list for this meal plan
      try {
        console.log('🛒 Auto-generating grocery list for saved meal plan:', savedPlan.id);
        
        // Import the consolidation function
        const { consolidateIngredients } = await import("./intelligentGroceryListOptimizer");
        
        // Consolidate the ingredients
        const consolidationResult = await consolidateIngredients(meal_plan);
        
        // Save to cache (without Instacart URL for now)
        await storage.saveGroceryListCache({
          meal_plan_id: savedPlan.id,
          user_id: userId,
          consolidated_ingredients: consolidationResult.consolidatedIngredients,
          shopping_url: null,
          savings: consolidationResult.savings,
          recommendations: consolidationResult.recommendations,
          expires_at: null // Will default to 7 days
        });
        
        console.log('✅ Grocery list cached for meal plan:', savedPlan.id);
      } catch (cacheError) {
        console.error('⚠️ Failed to cache grocery list (non-critical):', cacheError);
        // Don't fail the save operation if caching fails
      }
      
      // Check if this is the user's first meal plan for achievement tracking
      const allUserPlans = await storage.getSavedMealPlans(userId);
      const isFirstMealPlan = allUserPlans.length === 1; // Just saved their first one
      
      // Return achievement data for frontend to trigger notifications
      res.json({
        ...savedPlan,
        achievements: {
          firstMealPlan: isFirstMealPlan
        }
      });
    } catch (error) {
      console.error("❌ SAVE ERROR:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ message: "Failed to save meal plan", error: errorMessage });
    }
  });

  app.put("/api/meal-plans/:id", authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const planId = Number(req.params.id);
      const { name, description, meal_plan } = req.body;

      console.log('Update request - planId:', planId, 'name:', name, 'meal_plan exists:', !!meal_plan, 'meal_plan type:', typeof meal_plan);

      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      if (!name || !meal_plan) {
        return res.status(400).json({ message: "Name and meal plan are required" });
      }

      const updatedPlan = await storage.updateMealPlan(planId, userId, {
        name,
        description: description || "",
        mealPlan: meal_plan
      });

      if (!updatedPlan) {
        return res.status(404).json({ message: "Meal plan not found or unauthorized" });
      }

      console.log('Meal plan updated successfully:', updatedPlan.id);

      // Ensure we return valid JSON
      if (!updatedPlan) {
        return res.status(500).json({ message: "Update failed - no data returned" });
      }

      res.json(updatedPlan);
    } catch (error) {
      console.error("Error updating meal plan:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ message: "Failed to update meal plan", error: errorMessage });
    }
  });

  app.delete("/api/meal-plans/:id", authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const planId = Number(req.params.id);

      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const deleted = await storage.deleteMealPlan(planId, userId);

      if (!deleted) {
        return res.status(404).json({ message: "Meal plan not found or unauthorized" });
      }

      console.log('Meal plan deleted successfully:', planId);
      res.json({ message: "Meal plan deleted successfully", success: true });
    } catch (error) {
      console.error("Error deleting meal plan:", error);
      res.status(500).json({ message: "Failed to delete meal plan" });
    }
  });

  // Meal completion routes
  app.get("/api/meal-plans/:id/completions", authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const mealPlanId = Number(req.params.id);

      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const completions = await storage.getMealCompletions(userId, mealPlanId);
      res.json(completions);
    } catch (error) {
      console.error("Error fetching meal completions:", error);
      res.status(500).json({ message: "Failed to fetch meal completions" });
    }
  });

  app.post("/api/meal-plans/:id/completions/toggle", authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const mealPlanId = Number(req.params.id);
      const { dayKey, mealType } = req.body;

      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      if (!dayKey || !mealType) {
        return res.status(400).json({ message: "dayKey and mealType are required" });
      }

      const completion = await storage.toggleMealCompletion(userId, mealPlanId, dayKey, mealType);
      res.json(completion);
    } catch (error) {
      console.error("Error toggling meal completion:", error);
      res.status(500).json({ message: "Failed to toggle meal completion" });
    }
  });

  // Complete entire meal plan
  app.post("/api/meal-plans/:id/complete", authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const mealPlanId = Number(req.params.id);

      console.log(`🚀 ROUTE DEBUG: Complete plan request - userId: ${userId}, mealPlanId: ${mealPlanId}`);

      if (!userId) {
        console.log(`❌ ROUTE DEBUG: User not authenticated`);
        return res.status(401).json({ message: "User not authenticated" });
      }

      console.log(`✅ ROUTE DEBUG: User authenticated, calling storage.completeMealPlan`);

      // Mark the meal plan as completed by setting a completion flag
      const completedPlan = await storage.completeMealPlan(userId, mealPlanId);
      
      console.log(`📊 ROUTE DEBUG: Storage returned:`, completedPlan ? 'Plan object' : 'null');

      if (!completedPlan) {
        console.log(`❌ ROUTE DEBUG: No plan returned from storage, sending 404`);
        return res.status(404).json({ message: "Meal plan not found or unauthorized" });
      }

      console.log(`✅ ROUTE DEBUG: Plan completed successfully, sending response`);
      res.json({ message: "Meal plan completed successfully", plan: completedPlan });
    } catch (error) {
      console.error("❌ ROUTE DEBUG: Error completing meal plan:", error);
      res.status(500).json({ message: "Failed to complete meal plan" });
    }
  });

  app.get("/api/meal-plan/latest", async (req, res) => {
    try {
      // Disabled caching - return empty response for now
      return res.status(404).json({ message: "No recent meal plan found" });
    } catch (error) {
      console.error("Error fetching latest meal plan:", error);
      res.status(500).json({ message: "Failed to fetch latest meal plan" });
    }
  });

  // ============= FOOD TRACKING / CALORIE TRACKER ENDPOINTS =============
  
  // Create a new food log entry
  app.post("/api/food-logs", authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const { foods, imageUrl, mealType } = req.body;
      
      if (!foods || !Array.isArray(foods)) {
        return res.status(400).json({ message: "Foods array is required" });
      }

      // Calculate totals from included foods
      const totals = foods
        .filter((f: any) => f.included)
        .reduce((acc: any, f: any) => ({
          calories: acc.calories + (f.calories || 0),
          protein: acc.protein + (f.protein || 0),
          carbs: acc.carbs + (f.carbs || 0),
          fat: acc.fat + (f.fat || 0)
        }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

      // Save to database
      const foodLog = await storage.createFoodLog({
        user_id: userId,
        image_url: imageUrl,
        foods: foods,
        total_calories: totals.calories,
        total_protein: totals.protein,
        total_carbs: totals.carbs,
        total_fat: totals.fat,
        meal_type: mealType,
        logged_at: new Date()
      });

      res.json(foodLog);
    } catch (error) {
      console.error("Error creating food log:", error);
      res.status(500).json({ message: "Failed to create food log" });
    }
  });

  // Get today's food logs
  app.get("/api/food-logs/today", authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const logs = await storage.getFoodLogs(userId);
      
      // Calculate today's totals
      const totals = logs.reduce((acc, log) => ({
        totalCalories: acc.totalCalories + (log.total_calories || 0),
        totalProtein: acc.totalProtein + (log.total_protein || 0),
        totalCarbs: acc.totalCarbs + (log.total_carbs || 0),
        totalFat: acc.totalFat + (log.total_fat || 0)
      }), { totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0 });

      res.json({
        logs,
        ...totals
      });
    } catch (error) {
      console.error("Error fetching today's food logs:", error);
      res.status(500).json({ message: "Failed to fetch food logs" });
    }
  });

  // Get food logs for the last week
  app.get("/api/food-logs/week", authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);

      const logs = await storage.getFoodLogsByDateRange(userId, startDate, endDate);
      
      res.json(logs);
    } catch (error) {
      console.error("Error fetching week's food logs:", error);
      res.status(500).json({ message: "Failed to fetch food logs" });
    }
  });

  // Delete a food log
  app.delete("/api/food-logs/:id", authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const logId = parseInt(req.params.id);
      
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const success = await storage.deleteFoodLog(logId, userId);
      
      if (success) {
        res.json({ message: "Food log deleted successfully" });
      } else {
        res.status(404).json({ message: "Food log not found" });
      }
    } catch (error) {
      console.error("Error deleting food log:", error);
      res.status(500).json({ message: "Failed to delete food log" });
    }
  });

  // LogMeal API endpoints for food detection and status
  app.post("/api/detect-foods-logmeal", handleLogMealDetection);
  
  // Get LogMeal API usage status
  app.get("/api/logmeal-status", async (req, res) => {
    try {
      const { dailyCallCount, MAX_DAILY_CALLS, lastResetDate } = await import('./logmealEndpoint');
      res.json({
        callsUsed: dailyCallCount || 0,
        maxCalls: MAX_DAILY_CALLS || 180,
        remaining: (MAX_DAILY_CALLS || 180) - (dailyCallCount || 0),
        lastResetDate: lastResetDate || new Date().toDateString(),
        status: (dailyCallCount || 0) >= (MAX_DAILY_CALLS || 180) ? 'limited' : 'available'
      });
    } catch (error) {
      res.json({
        callsUsed: 0,
        maxCalls: 180,
        remaining: 180,
        lastResetDate: new Date().toDateString(),
        status: 'available'
      });
    }
  });

  // Test Google Vision API connection
  app.get("/api/test-vision", async (req, res) => {
    try {
      const VISION_API_KEY = 'AIzaSyBZNfvaAwCwgZHi4a9MKs8CkaRaMAxUPm4';
      
      // Test with a minimal request - just check if API is accessible
      const testUrl = `https://vision.googleapis.com/v1/images:annotate?key=${VISION_API_KEY}`;
      
      // Tiny 1x1 red pixel image
      const testImage = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
      
      const testRequest = {
        requests: [{
          image: { content: testImage },
          features: [{ type: 'LABEL_DETECTION', maxResults: 1 }]
        }]
      };
      

      
      const response = await fetch(testUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testRequest)
      });
      
      const responseText = await response.text();
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = { rawText: responseText };
      }
      
      res.json({
        success: response.ok,
        status: response.status,
        apiKeyWorks: response.status !== 403 && response.status !== 401,
        response: responseData,
        message: response.ok ? 'Vision API is working!' : 'Vision API test failed'
      });
      
    } catch (error: any) {
      console.error('Test error:', error);
      res.json({
        success: false,
        error: error.message,
        apiKeyWorks: false
      });
    }
  });

  // Detect ingredients using Google Vision API
  app.post("/api/detect-ingredients", async (req, res) => {
    try {
      console.log('🔍 === VISION API ENDPOINT CALLED ===');
      const { image } = req.body;
      
      if (!image) {
        console.error('❌ No image data provided');
        return res.status(400).json({ error: "Image data is required" });
      }
      
      console.log('📊 Received image data:', {
        length: image.length,
        isBase64: image.includes('base64'),
        prefix: image.substring(0, 50)
      });
      
      // Google Vision API key
      const VISION_API_KEY = 'AIzaSyBZNfvaAwCwgZHi4a9MKs8CkaRaMAxUPm4';
      const VISION_API_URL = `https://vision.googleapis.com/v1/images:annotate?key=${VISION_API_KEY}`;
      
      // Remove data URL prefix if present
      const base64Image = image.replace(/^data:image\/\w+;base64,/, '');
      
      // Create Vision API request
      const visionRequest = {
        requests: [{
          image: {
            content: base64Image
          },
          features: [
            {
              type: 'OBJECT_LOCALIZATION',
              maxResults: 20
            },
            {
              type: 'LABEL_DETECTION',
              maxResults: 20
            },
            {
              type: 'TEXT_DETECTION',
              maxResults: 10
            }
          ]
        }]
      };
      
      console.log('📡 Calling Google Vision API...');

      
      // Call Vision API
      let visionResponse;
      try {
        visionResponse = await fetch(VISION_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(visionRequest)
        });
      } catch (fetchError: any) {
        return res.status(500).json({ 
          error: 'Network error calling Vision API',
          details: fetchError.message 
        });
      }
      
      if (!visionResponse.ok) {
        const errorText = await visionResponse.text();
        console.error('❌ Vision API HTTP error:', visionResponse.status);
        console.error('❌ Error response:', errorText);
        
        // Try to parse as JSON for better error details
        let errorDetails;
        try {
          errorDetails = JSON.parse(errorText);
          console.error('❌ Error details:', errorDetails);
        } catch {
          errorDetails = { message: errorText };
        }
        
        return res.status(500).json({ 
          error: 'Vision API request failed',
          status: visionResponse.status,
          details: errorDetails
        });
      }
      
      const visionData = await visionResponse.json();
      console.log('✅ Vision API response received');
      
      const response = visionData.responses?.[0];
      if (!response) {
        return res.json({ ingredients: [] });
      }
      
      // Process detections into ingredients
      const detectedIngredients: any[] = [];
      const addedItems = new Set<string>();
      
      // Map common food-related labels to ingredients
      const foodLabelMap: Record<string, string> = {
        'apple': 'apple',
        'banana': 'banana',
        'orange': 'orange',
        'tomato': 'tomato',
        'lettuce': 'lettuce',
        'chicken': 'chicken_breast',
        'beef': 'ground_beef',
        'bread': 'bread',
        'egg': 'eggs',
        'milk': 'milk',
        'cheese': 'cheese',
        'rice': 'white_rice',
        'pasta': 'pasta',
        'potato': 'potato',
        'carrot': 'carrot',
        'onion': 'onion',
        'broccoli': 'broccoli',
        'pepper': 'bell_pepper',
        'fish': 'salmon',
        'shrimp': 'shrimp',
        'pork': 'pork_chop',
        'vegetable': 'vegetables',
        'fruit': 'fruit',
        'meat': 'ground_beef',
        'food': 'food_item',
        'produce': 'vegetables',
        'citrus': 'orange',
        'berry': 'strawberry',
        'nut': 'almonds',
        'grain': 'quinoa',
        'dairy': 'milk',
        'seafood': 'shrimp'
      };
      
      // Process object localizations (with bounding boxes)
      if (response.localizedObjectAnnotations) {
        console.log(`📦 Found ${response.localizedObjectAnnotations.length} objects`);
        
        for (const obj of response.localizedObjectAnnotations) {
          const name = obj.name?.toLowerCase() || '';
          const confidence = obj.score || 0;
          
          // Check if it's a food item
          const ingredientKey = foodLabelMap[name] || (name.includes('food') ? name : null);
          
          if (ingredientKey && confidence > 0.3 && !addedItems.has(ingredientKey)) {
            addedItems.add(ingredientKey);
            
            // Extract bounding box
            const vertices = obj.boundingPoly?.normalizedVertices || [];
            let bbox = null;
            if (vertices.length >= 2) {
              bbox = [
                vertices[0].x || 0,
                vertices[0].y || 0,
                (vertices[2]?.x || vertices[1]?.x || 1) - (vertices[0].x || 0),
                (vertices[2]?.y || vertices[1]?.y || 1) - (vertices[0].y || 0)
              ];
            }
            
            detectedIngredients.push({
              id: `ingredient-${Date.now()}-${Math.random()}`,
              name: ingredientKey.replace(/_/g, ' '),
              confidence: confidence,
              bbox: bbox,
              source: 'object'
            });
            
            console.log(`  ✅ Object: ${name} → ${ingredientKey} (${(confidence * 100).toFixed(1)}%)`);
          }
        }
      }
      
      // Process labels as fallback
      if (response.labelAnnotations && detectedIngredients.length < 5) {
        console.log(`🏷️ Found ${response.labelAnnotations.length} labels`);
        
        for (const label of response.labelAnnotations) {
          const description = label.description?.toLowerCase() || '';
          const confidence = label.score || 0;
          
          // Check if it's a food-related label
          const ingredientKey = foodLabelMap[description];
          
          if (ingredientKey && confidence > 0.5 && !addedItems.has(ingredientKey)) {
            addedItems.add(ingredientKey);
            
            detectedIngredients.push({
              id: `ingredient-${Date.now()}-${Math.random()}`,
              name: ingredientKey.replace(/_/g, ' '),
              confidence: confidence,
              source: 'label'
            });
            
            console.log(`  ✅ Label: ${description} → ${ingredientKey} (${(confidence * 100).toFixed(1)}%)`);
          }
        }
      }
      
      // Process text detection for branded items or labels
      if (response.textAnnotations && response.textAnnotations.length > 0) {
        const fullText = response.textAnnotations[0].description?.toLowerCase() || '';
        console.log(`📝 Detected text: "${fullText.substring(0, 100)}..."`);
        
        // Look for food keywords in text
        const foodKeywords = ['organic', 'fresh', 'natural', 'whole', 'premium'];
        const hasFoodText = foodKeywords.some(keyword => fullText.includes(keyword));
        
        if (hasFoodText) {
          console.log('  ℹ️ Food-related text detected');
        }
      }
      
      // Sort by confidence
      detectedIngredients.sort((a, b) => b.confidence - a.confidence);
      
      // Limit to top 10 detections
      const finalIngredients = detectedIngredients.slice(0, 10);
      

      
      res.json({
        ingredients: finalIngredients,
        raw: {
          objects: response.localizedObjectAnnotations?.length || 0,
          labels: response.labelAnnotations?.length || 0,
          hasText: !!response.textAnnotations
        }
      });
      
    } catch (error) {
      console.error("Error in Vision API detection:", error);
      res.status(500).json({ error: "Failed to detect ingredients" });
    }
  });

  // Parse missing foods using GPT (text only, no vision)
  app.post("/api/parse-missing-foods", authenticateToken, async (req: any, res) => {
    try {
      const { text } = req.body;
      
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ message: "Text input is required" });
      }

      const { OpenAI } = await import("openai");
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });

      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo", // Cheaper model for simple text parsing
        messages: [
          {
            role: "system",
            content: `You are a food parser. Parse the user's text and return a JSON array of foods with calories.
            
            Return format:
            [
              {
                "name": "food name",
                "amount": number (grams or ml),
                "unit": "g" or "ml" or "piece",
                "calories": number (for that amount),
                "protein": number (optional, grams),
                "carbs": number (optional, grams),
                "fat": number (optional, grams)
              }
            ]
            
            Common portion sizes:
            - Oil/butter: 10ml (88 calories)
            - Sauce: 30ml (varies)
            - Salt/pepper: 1g (0 calories)
            - Sugar: 5g (20 calories)
            
            Be realistic with portions. Return only valid JSON array.`
          },
          {
            role: "user",
            content: text
          }
        ],
        max_tokens: 300,
        temperature: 0.1
      });

      const content = completion.choices[0].message.content || '[]';
      let foods;
      
      try {
        foods = JSON.parse(content);
      } catch (e) {
        console.error("Failed to parse GPT response:", content);
        foods = [];
      }

      // Add IDs and flags to the foods
      const enhancedFoods = foods.map((food: any, index: number) => ({
        id: `manual_${Date.now()}_${index}`,
        ...food,
        included: true,
        isManual: true
      }));

      res.json(enhancedFoods);
    } catch (error) {
      console.error("Error parsing missing foods:", error);
      res.status(500).json({ message: "Failed to parse foods" });
    }
  });

  // Search food database
  app.get("/api/foods/search", authenticateToken, async (req: any, res) => {
    try {
      const { q } = req.query;
      
      if (!q || typeof q !== 'string') {
        return res.status(400).json({ message: "Search query is required" });
      }

      const foods = await storage.searchFoodDatabase(q);
      res.json(foods);
    } catch (error) {
      console.error("Error searching food database:", error);
      res.status(500).json({ message: "Failed to search foods" });
    }
  });

  // Get nutrition info for a food (uses existing USDA integration)
  app.get("/api/foods/nutrition", authenticateToken, async (req: any, res) => {
    try {
      const { name, amount = 100 } = req.query;
      
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ message: "Food name is required" });
      }

      // First check local database
      const localFood = await storage.getFoodDatabaseItem(name);
      if (localFood) {
        const multiplier = Number(amount) / 100;
        return res.json({
          name: localFood.name,
          amount: Number(amount),
          unit: 'g',
          calories: Math.round((localFood.calories_per_100g || 0) * multiplier),
          protein: Math.round((localFood.protein_per_100g || 0) * multiplier),
          carbs: Math.round((localFood.carbs_per_100g || 0) * multiplier),
          fat: Math.round((localFood.fat_per_100g || 0) * multiplier)
        });
      }

      // If not in local database, try USDA
      if (process.env.USDA_API_KEY) {
        try {
          const searchResponse = await fetch(
            `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(name)}&api_key=${process.env.USDA_API_KEY}&pageSize=1`
          );
          
          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            if (searchData.foods && searchData.foods.length > 0) {
              const food = searchData.foods[0];
              const nutrients = food.foodNutrients || [];
              
              let nutrition = { calories: 0, protein: 0, carbs: 0, fat: 0 };
              
              for (const nutrient of nutrients) {
                const name = (nutrient.nutrientName || '').toLowerCase();
                const value = nutrient.value || 0;
                
                if (name.includes('energy')) nutrition.calories = value;
                if (name.includes('protein')) nutrition.protein = value;
                if (name.includes('carbohydrate')) nutrition.carbs = value;
                if (name.includes('fat') && name.includes('total')) nutrition.fat = value;
              }
              
              // Save to local database for future use
              await storage.createFoodDatabaseItem({
                name: name.toLowerCase(),
                calories_per_100g: nutrition.calories,
                protein_per_100g: nutrition.protein,
                carbs_per_100g: nutrition.carbs,
                fat_per_100g: nutrition.fat,
                common_portion: 100,
                category: null
              }).catch(e => console.log('Could not cache food item'));
              
              const multiplier = Number(amount) / 100;
              return res.json({
                name,
                amount: Number(amount),
                unit: 'g',
                calories: Math.round(nutrition.calories * multiplier),
                protein: Math.round(nutrition.protein * multiplier),
                carbs: Math.round(nutrition.carbs * multiplier),
                fat: Math.round(nutrition.fat * multiplier)
              });
            }
          }
        } catch (usdaError) {
          console.error("USDA API error:", usdaError);
        }
      }

      // Default fallback
      res.json({
        name,
        amount: Number(amount),
        unit: 'g',
        calories: 100, // Default estimate
        protein: 0,
        carbs: 0,
        fat: 0
      });
    } catch (error) {
      console.error("Error getting nutrition info:", error);
      res.status(500).json({ message: "Failed to get nutrition info" });
    }
  });

  // ============= END FOOD TRACKING ENDPOINTS =============

  // Generate meal plan using ChatGPT with caching and rate limiting
  app.post("/api/meal-plan/generate", authenticateToken, async (req: any, res) => {
    const startTime = Date.now(); // Fix: Define startTime
    try {
      // User is now authenticated through middleware, get userId from req.user
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Check rate limit
      if (!rateLimiter.isAllowed(userId)) {
        return res.status(429).json({
          message: "Rate limit exceeded. Please try again later.",
          remainingRequests: rateLimiter.getRemainingRequests(userId),
          resetTime: rateLimiter.getResetTime(userId)
        });
      }

      const {
        numDays,
        mealsPerDay,
        cookTime,
        difficulty,
        nutritionGoal,
        dietaryRestrictions,
        availableIngredients,
        excludeIngredients,
        primaryGoal,
        selectedFamilyMembers = [],
        useIntelligentPrompt = true,
        culturalBackground = [],
        planTargets = ["Everyone"] // New parameter for family member targeting (array)
      } = req.body;

      // Disable caching - always generate fresh meal plans
        // const cacheKey = JSON.stringify({
        //   numDays,
        //   mealsPerDay,
        //   cookTime,
        //   difficulty,
        //   nutritionGoal,
        //   dietaryRestrictions,
        //   availableIngredients,
        //   excludeIngredients,
        //   primaryGoal,
        //   selectedFamilyMembers: selectedFamilyMembers?.sort(),
        //   useIntelligentPrompt
        // });

        // const cachedResult = getCachedMealPlan(cacheKey);
        // if (cachedResult) {
        //   console.log('Serving cached meal plan');
        //   return res.json(cachedResult);
        // }

      // Get user profile for intelligent prompt building
      let userProfile = null;
      let culturalCuisineData = null;
      try {
        if (userId !== 'anonymous' && useIntelligentPrompt) {
          console.log('Attempting to fetch user profile for userId:', userId);
          // Pass userId as string, no parseInt needed since user_id is varchar in database
          userProfile = await storage.getProfile(userId);
          console.log('User profile found:', userProfile);

          // Get cultural cuisine data if user has cultural preferences
          if (userProfile && userProfile.cultural_background && Array.isArray(userProfile.cultural_background) && userProfile.cultural_background.length > 0) {
            console.log('User has cultural background:', userProfile.cultural_background);
            const { getCachedCulturalCuisine } = await import('./cultureCacheManager');
            // Pass userId as string
            culturalCuisineData = await getCachedCulturalCuisine(userId, userProfile.cultural_background);
            console.log(`Retrieved cultural cuisine data for: ${userProfile.cultural_background.join(', ')}`);
            console.log('Cultural cuisine data structure:', Object.keys(culturalCuisineData || {}));
          }
        } else {
          console.log('Skipping user profile fetch - userId:', userId, 'useIntelligentPrompt:', useIntelligentPrompt);
        }
      } catch (error) {
        console.log('Could not fetch user profile, using basic prompt. Error:', error);
      }

      let prompt;

      // Generate day structure for all cases
      const dayStructure = [];
      for (let i = 1; i <= numDays; i++) {
        dayStructure.push(`"day_${i}"`);
      }

      // ALWAYS use V2 intelligent prompt builder
      if (true) {
        // Import profile validator
        const { validateProfileForMealGeneration, getDefaultGoalWeights } = await import('./profileValidator');
        
        // For anonymous users, create a minimal profile with defaults
        if (userId === 'anonymous') {
          // Create a minimal profile for anonymous users
          userProfile = {
            primary_goal: primaryGoal || 'Eat Healthier',
            profile_type: 'individual',
            family_size: 1,
            preferences: dietaryRestrictions ? dietaryRestrictions.split(',').map((r: string) => r.trim()) : [],
            cultural_background: culturalBackground || [],
            goal_weights: getDefaultGoalWeights(primaryGoal || 'Eat Healthier')
          };
          console.log('Created default profile for anonymous user');
        } else if (!userProfile) {
          // For logged-in users, profile is required
          return res.status(400).json({
            message: "Profile not found. Please update your profile before generating meal plans.",
            error: "PROFILE_MISSING"
          });
        }
        
        // Process goal weights from profile before validation
        if (userProfile && userProfile.goals && Array.isArray(userProfile.goals)) {
          const goalWeights: any = {};
          
          // Parse goals array into weights object
          userProfile.goals.forEach((goal: string) => {
            if (typeof goal === 'string' && goal.includes(':')) {
              const [key, value] = goal.split(':');
              const weight = parseFloat(value);
              if (!isNaN(weight)) {
                goalWeights[key] = weight;
              }
            }
          });
          
          // Add parsed weights to profile for validation
          userProfile.goal_weights = goalWeights;
          console.log('Parsed goal weights from goals array:', goalWeights);
        }
        
        // Validate profile has required fields
        if (userProfile) {
          const validation = validateProfileForMealGeneration(userProfile);
          if (!validation.isValid) {
            return res.status(400).json({
              message: validation.errorMessage,
              missingFields: validation.missingFields,
              error: "PROFILE_INCOMPLETE"
            });
          }
        }
        
        // Use V2 intelligent prompt builder
        const { buildIntelligentPrompt } = await import('./intelligentPromptBuilderV2');
        const { mergeFamilyDietaryRestrictions } = await import('../shared/schema');

        // Merge dietary restrictions from profile and family members
        const profileRestrictions = userProfile?.preferences || [];
        const familyMembers = Array.isArray(userProfile?.members) ? userProfile.members : [];
        const familyRestrictions = mergeFamilyDietaryRestrictions(familyMembers);
        
        // Combine all restrictions: request > family > profile
        const allRestrictions = new Set<string>();
        
        // Add request restrictions (highest priority)
        if (dietaryRestrictions) {
          dietaryRestrictions.split(',').forEach((r: string) => {
            const trimmed = r.trim();
            if (trimmed) allRestrictions.add(trimmed);
          });
        }
        
        // Add family member restrictions
        if (Array.isArray(familyRestrictions)) {
          familyRestrictions.forEach((r: string) => allRestrictions.add(r));
        }
        
        // Add profile restrictions
        if (Array.isArray(profileRestrictions)) {
          profileRestrictions.forEach((r: string) => allRestrictions.add(r));
        }
        
        const mergedRestrictions = Array.from(allRestrictions).join(', ');
        console.log('Merged dietary restrictions:', mergedRestrictions);

        // Ensure we have goal weights (use defaults if not in profile)
        const goalWeights = userProfile?.goal_weights || getDefaultGoalWeights(primaryGoal || userProfile?.primary_goal || 'Eat Healthier');
        
        const filters = {
          numDays,
          mealsPerDay,
          cookTime,
          difficulty,
          nutritionGoal,
          dietaryRestrictions: mergedRestrictions, // Use merged restrictions
          availableIngredients,
          excludeIngredients,
          primaryGoal: primaryGoal || userProfile?.primary_goal || 'Eat Healthier', // Ensure we always have a primary goal
          familySize: userProfile?.family_size || undefined,
          familyMembers: familyMembers,
          profileType: userProfile?.profile_type as 'individual' | 'family' || 'individual',
          // UNIFIED: Set intelligent defaults based on primary goal across entire system
          encourageOverlap: primaryGoal === 'Save Money' || userProfile?.primary_goal === 'Save Money',
          availableIngredientUsagePercent: primaryGoal === 'Save Money' ? 80 : 60,
          // Add cultural cuisine data
          culturalCuisineData: culturalCuisineData,
          culturalBackground: userProfile?.cultural_background || culturalBackground || [],
          // V2 specific fields
          goalWeights: goalWeights,
          weightBasedEnhanced: true, // Enable V2 weight-based system
          heroIngredients: [] // Will be populated by V2 system
        };

        prompt = await buildIntelligentPrompt(filters);
        console.log('Using V2 intelligent prompt builder with enhanced features');
        
        // Log prompt details for debugging
        console.log('Primary Goal:', filters.primaryGoal);
        console.log('Goal Weights:', filters.goalWeights);
        console.log('Weight-based Enhanced:', filters.weightBasedEnhanced);
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are a meal planning expert. You MUST generate exactly the requested number of days. Follow the user's specifications precisely and generate complete meal plans with all requested days. Always return valid JSON.`
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          response_format: { type: "json_object" },
          temperature: 0.2, // Lower for more consistent adherence to requirements
          max_tokens: 4000 // Increased to ensure all days fit
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data: any = await response.json();
      let mealPlan;

      try {
        const content = data.choices[0].message.content;
        if (!content || content.trim() === '') {
          throw new Error('Empty response from AI');
        }
        mealPlan = JSON.parse(content);
      } catch (parseError) {
        console.error('JSON Parse Error:', parseError);
        console.error('AI Response:', data.choices[0].message.content);
        throw new Error('Invalid response format from AI. Please try again.');
      }

      // Validate the meal plan structure
      if (!mealPlan.meal_plan || typeof mealPlan.meal_plan !== 'object') {
        throw new Error('Invalid meal plan structure - missing meal_plan object');
      }

      // Apply difficulty rounding and validation
      validateAndRoundDifficulties(mealPlan.meal_plan, difficulty);

      // DIETARY VALIDATION: Check meal plan compliance before caching
      let finalMealPlan = mealPlan;
      if (dietaryRestrictions) {
        try {
          const { validateMealPlanDietaryCompliance } = await import('./dietaryValidationService');

          const validation = await validateMealPlanDietaryCompliance(mealPlan, [dietaryRestrictions]);
          console.log(`🔍 Meal plan dietary validation: ${validation.overallCompliance}% compliance (${validation.compliantMeals}/${validation.totalMeals} meals)`);

          if (validation.overallCompliance < 80) {
            console.warn(`❌ Low dietary compliance for "${dietaryRestrictions}":`, validation.summary);

            // Add validation metadata to meal plan
            finalMealPlan.dietary_validation = {
              compliance_score: validation.overallCompliance,
              compliant_meals: validation.compliantMeals,
              total_meals: validation.totalMeals,
              violations_summary: validation.summary,
              validation_timestamp: new Date().toISOString()
            };

            // Log specific violations for debugging
            Object.entries(validation.violations).forEach(([mealKey, result]) => {
              console.warn(`  - ${mealKey}: ${result.violations.length} violations`);
            });
          } else {
            console.log(`✅ Meal plan passes dietary validation for "${dietaryRestrictions}" (${validation.overallCompliance}% compliance)`);
            finalMealPlan.dietary_validation = {
              compliance_score: validation.overallCompliance,
              compliant_meals: validation.compliantMeals,
              total_meals: validation.totalMeals,
              validation_timestamp: new Date().toISOString()
            };
          }
        } catch (validationError) {
          console.error('Meal plan dietary validation error:', validationError);
          // Continue without validation rather than failing
        }
      }

      // DISH NAME ENHANCEMENT: Map to familiar, recognizable names
      try {
        const { enhanceMealPlanNames } = await import('./mealPlanEnhancer');

        // Extract cultural background from profile or request body
        const culturalBackgroundArray = userProfile?.cultural_background || [];

        const enhancement = await enhanceMealPlanNames(
          finalMealPlan,
          culturalBackgroundArray as string[]
        );

        console.log(`📝 Meal plan enhancement: ${enhancement.enhancementStats.familiarNameChanges} name changes, ${enhancement.enhancementStats.cuisineCorrections} cuisine corrections`);
        console.log(`   Average naming confidence: ${(enhancement.enhancementStats.averageConfidence * 100).toFixed(1)}%`);

        if (enhancement.enhancementStats.familiarNameChanges > 0) {
          finalMealPlan = enhancement.enhancedMealPlan;
          console.log('   Enhanced meal names:');
          enhancement.enhancementLog.slice(0, 3).forEach(log => console.log(`     ${log}`));
        }

      } catch (enhancementError) {
        console.error('Meal plan enhancement error:', enhancementError);
        // Continue without enhancement rather than failing
      }

      const dayCount = Object.keys(finalMealPlan.meal_plan).length;
      console.log(`Generated meal plan has ${dayCount} days, expected ${numDays}`);

      // Ensure we have the correct number of days
      if (dayCount !== numDays) {
        console.error(`CRITICAL ERROR: Day count mismatch: generated ${dayCount}, expected ${numDays}`);
        throw new Error(`AI generated ${dayCount} days instead of requested ${numDays} days. Please try again.`);
      }

      // Disable caching - always generate fresh meal plans
      console.log(`✅ Generated fresh meal plan in ${Date.now() - startTime}ms (no caching)`);
      res.json(finalMealPlan);

    } catch (error) {
      console.error("Error generating meal plan:", error);
      res.status(500).json({ message: "Failed to generate meal plan" });
    }
  });

  // Streaming meal plan generation endpoint - streams actual meal content
  app.post("/api/meal-plan/generate-stream", authenticateToken, async (req: any, res) => {
    // Set headers for Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable proxy buffering for real-time streaming
    
    // Helper function to send SSE data
    const sendData = (data: string) => {
      res.write(`data: ${data}\n\n`);
      // Force flush to ensure data is sent immediately
      // This is crucial for real-time streaming
      if (typeof (res as any).flush === 'function') {
        (res as any).flush();
      }
    };

    try {
      const userId = req.user?.id;
      
      if (!userId) {
        sendData(JSON.stringify({ error: 'Authentication required' }));
        return res.end();
      }

      // Check rate limit
      if (!rateLimiter.isAllowed(userId)) {
        sendData(JSON.stringify({ 
          error: 'Rate limit exceeded. Please try again later.',
          remainingRequests: rateLimiter.getRemainingRequests(userId),
          resetTime: rateLimiter.getResetTime(userId)
        }));
        return res.end();
      }

      const {
        numDays,
        mealsPerDay,
        cookTime,
        difficulty,
        nutritionGoal,
        dietaryRestrictions,
        availableIngredients,
        excludeIngredients,
        primaryGoal,
        selectedFamilyMembers = [],
        useIntelligentPrompt = true,
        culturalBackground = [],
        planTargets = ["Everyone"]
      } = req.body;

      // Get user profile and cultural data
      let userProfile = null;
      let culturalCuisineData = null;
      
      try {
        if (userId !== 'anonymous' && useIntelligentPrompt) {
          userProfile = await storage.getProfile(userId);
          console.log('Streaming: User profile found:', userProfile?.profile_name);
          
          if (userProfile && userProfile.cultural_background && Array.isArray(userProfile.cultural_background) && userProfile.cultural_background.length > 0) {
            const { getCachedCulturalCuisine } = await import('./cultureCacheManager');
            culturalCuisineData = await getCachedCulturalCuisine(userId, userProfile.cultural_background);
            console.log(`Streaming: Retrieved cultural cuisine data for: ${userProfile.cultural_background.join(', ')}`);
          }
        }
      } catch (error) {
        console.log('Streaming: Could not fetch user profile, using basic prompt. Error:', error);
      }

      // Process goal weights from profile
      let goalWeights: any = {};
      if (userProfile && userProfile.goals && Array.isArray(userProfile.goals)) {
        userProfile.goals.forEach((goal: string) => {
          if (typeof goal === 'string' && goal.includes(':')) {
            const [key, value] = goal.split(':');
            const weight = parseFloat(value);
            if (!isNaN(weight)) {
              goalWeights[key] = weight;
            }
          }
        });
        userProfile.goal_weights = goalWeights;
      }

      // Validate profile and build prompt
      const { validateProfileForMealGeneration, getDefaultGoalWeights } = await import('./profileValidator');
      
      if (userId === 'anonymous') {
        userProfile = {
          primary_goal: primaryGoal || 'Eat Healthier',
          profile_type: 'individual',
          family_size: 1,
          preferences: dietaryRestrictions ? dietaryRestrictions.split(',').map((r: string) => r.trim()) : [],
          cultural_background: culturalBackground || [],
          goal_weights: getDefaultGoalWeights(primaryGoal || 'Eat Healthier')
        };
      } else if (!userProfile) {
        sendData(JSON.stringify({ error: 'Profile not found. Please update your profile before generating meal plans.' }));
        return res.end();
      }
      
      // Validate profile
      if (userProfile) {
        const validation = validateProfileForMealGeneration(userProfile);
        if (!validation.isValid) {
          sendData(JSON.stringify({ 
            error: validation.errorMessage,
            missingFields: validation.missingFields
          }));
          return res.end();
        }
      }
      
      // Build intelligent prompt
      const { buildIntelligentPrompt } = await import('./intelligentPromptBuilderV2');
      const { mergeFamilyDietaryRestrictions } = await import('../shared/schema');
      
      const dietaryRestrictionsArray = typeof dietaryRestrictions === 'string' 
        ? dietaryRestrictions.split(',').map((r: string) => r.trim()).filter(Boolean)
        : dietaryRestrictions || [];
      
      // Merge dietary restrictions from profile and family members  
      const profileRestrictions = userProfile?.preferences || [];
      const familyMembers = Array.isArray(userProfile?.members) ? userProfile.members : [];
      const familyRestrictions = mergeFamilyDietaryRestrictions(familyMembers);
      
      // Combine all restrictions: request > family > profile
      const allRestrictions = new Set<string>();
      
      // Add request restrictions (highest priority)
      if (dietaryRestrictions) {
        dietaryRestrictionsArray.forEach((r: string) => {
          if (r.trim()) allRestrictions.add(r.trim());
        });
      }
      
      // Add family restrictions (medium priority)
      familyRestrictions.forEach(r => allRestrictions.add(r));
      
      // Add profile restrictions (lowest priority)
      profileRestrictions.forEach(r => allRestrictions.add(r));
      
      const mergedRestrictions = Array.from(allRestrictions).join(', ');

      const prompt = await buildIntelligentPrompt({
        numDays,
        mealsPerDay,
        cookTime,
        difficulty,
        nutritionGoal,
        dietaryRestrictions: mergedRestrictions,
        availableIngredients,
        excludeIngredients,
        primaryGoal: primaryGoal || userProfile?.primary_goal || 'Eat Healthier',
        familySize: userProfile?.family_size || undefined,
        familyMembers: familyMembers,
        profileType: userProfile?.profile_type as 'individual' | 'family' || 'individual',
        encourageOverlap: primaryGoal === 'Save Money' || userProfile?.primary_goal === 'Save Money',
        availableIngredientUsagePercent: primaryGoal === 'Save Money' ? 80 : 60,
        culturalCuisineData: culturalCuisineData,
        culturalBackground: userProfile?.cultural_background || culturalBackground || [],
        goalWeights: goalWeights,
        weightBasedEnhanced: true,
        heroIngredients: []
      });

      // Stream from OpenAI
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
      
      const openaiStream = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        stream: true,
        temperature: 0.7,
        max_tokens: 4096
      });

      // 🎯 DYNAMIC MEAL COUNTING: Calculate expected meals based on user's selection
      const expectedTotalMeals = numDays * mealsPerDay;
      console.log(`🧮 DYNAMIC CALCULATION: ${numDays} days × ${mealsPerDay} meals = ${expectedTotalMeals} total expected meals`);
      
      // Parse meals in real-time from the stream
      let buffer = '';
      let mealCount = 0;
      let currentDay = 0;
      const mealTypes = ['breakfast', 'lunch', 'dinner'];
      const processedMeals = new Set<string>(); // Track processed meals to avoid duplicates
      
      // Helper to extract meal type from position
      const getMealType = (dayNum: number, mealNum: number) => {
        const mealIndex = (mealNum - 1) % mealsPerDay;
        return mealTypes[mealIndex] || 'meal';
      };

      for await (const chunk of openaiStream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          console.log('🌊 STREAM CHUNK received:', content.length, 'chars:', content.substring(0, 100));
          buffer += content;
          
          // Log when we see important content
          if (content.includes('"title"')) {
            console.log('📡 TITLE DETECTED in chunk:', content);
          }
          
          // Track current day from the JSON structure
          const dayMatches = [...buffer.matchAll(/"day_(\d+)"/g)];
          if (dayMatches.length > 0) {
            currentDay = parseInt(dayMatches[dayMatches.length - 1][1]);
          }
          
          // 🚀 REAL-TIME PARSING: Search entire buffer for complete titles
          console.log('🔍 BUFFER SIZE:', buffer.length, 'chars - searching for complete titles');
          
          // Look for meal titles in real-time - stream as soon as we see a complete title!
          const titleRegex = /"title":\s*"([^"]+)"/g;
          
          // Search the entire buffer for complete titles
          console.log('🕵️ SEARCHING entire buffer for titles...');
          
          let match;
          titleRegex.lastIndex = 0; // Reset regex position
          while ((match = titleRegex.exec(buffer)) !== null) {
            const mealTitle = match[1];
            console.log('🎯 REGEX MATCH found title:', mealTitle);
            
            // Create a simple unique key based on meal title
            const mealKey = `${mealTitle.trim()}`;
            
            // Skip if we've already processed this meal title
            if (processedMeals.has(mealKey)) {
              console.log(`⏭️ DUPLICATE DETECTED: ${mealTitle} (already processed)`);
              continue;
            }
            
            // Determine meal type based on count
            const mealType = mealTypes[mealCount % 3];
            
            processedMeals.add(mealKey);
            mealCount++;
            
            console.log(`🍽️ NEW MEAL FOUND: ${mealTitle} (${mealType}) - Count: ${mealCount} 🚀 SCHEDULING STREAMING!`);
            
            // Send individual meal as SSE event with natural timing delays
            const mealData = {
              title: mealTitle,
              name: mealTitle, // For compatibility
              cook_time_minutes: 25, // Default cook time
              cook_time: 25, // For compatibility
              prep_time: 10, // Default prep time
              difficulty: 2, // Default difficulty
              mealType: mealType,
              day: currentDay || 1,
              totalTime: 35,
              id: `${mealType}_${mealCount}_${Date.now()}`
            };
            
            // 🚀 IMMEDIATE STREAMING: Send meal as soon as detected, no artificial delays
            console.log(`📤 SENDING SSE data IMMEDIATELY for meal ${mealCount}/${expectedTotalMeals}:`, mealTitle);
            const sseData = JSON.stringify({
              type: 'meal',
              data: mealData,
              mealNumber: mealCount,
              totalMeals: expectedTotalMeals
            });
            console.log('📦 SSE payload:', sseData);
            
            sendData(sseData);
            
            // 🚀 FORCE IMMEDIATE FLUSH to ensure real-time delivery
            try {
              if (res.flush) {
                res.flush();
              }
              // Additional flush for some Node.js versions
              if (res.socket && res.socket.flush) {
                res.socket.flush();
              }
            } catch (flushError) {
              console.log('Flush attempt failed (not critical):', flushError.message);
            }
            
            console.log(`✨ STREAMED IMMEDIATELY: Meal ${mealCount}/${expectedTotalMeals} - ${mealTitle} sent to frontend at ${new Date().toISOString()}!`);
          }
          
          // Log if no matches found
          if (!titleRegex.test(buffer)) {
            console.log('❌ NO TITLES found in this chunk');
          }
        }
      }
      
      // 🎯 ROBUST LOGIC: Only send complete meal plan when ALL meals have been streamed
      console.log(`🔍 COMPLETION CHECK: Streamed ${mealCount} meals out of ${expectedTotalMeals} expected`);
      
      if (mealCount >= expectedTotalMeals) {
        console.log(`✅ ALL ${expectedTotalMeals} MEALS STREAMED! Now sending complete meal plan...`);
        try {
          // Clean and parse the complete response
          const cleanBuffer = buffer.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          const completeMealPlan = JSON.parse(cleanBuffer);
          
          sendData(JSON.stringify({
            type: 'complete',
            data: completeMealPlan,
            allMealsStreamed: true,
            totalMealsStreamed: mealCount,
            expectedTotalMeals: expectedTotalMeals
          }));
          console.log(`📋 COMPLETE MEAL PLAN SENT after all ${expectedTotalMeals} meals streamed!`);
        } catch (e) {
          console.log('❌ Failed to parse complete meal plan, sending done signal');
          sendData(JSON.stringify({ type: 'done' }));
        }
      } else {
        console.log(`⏳ WAITING for more meals... Only ${mealCount}/${expectedTotalMeals} streamed so far. NOT sending complete plan yet.`);
        // Don't send complete plan until all meals are streamed
        sendData(JSON.stringify({ 
          type: 'partial_complete',
          streamedMeals: mealCount,
          totalExpected: expectedTotalMeals,
          message: 'Waiting for all meals to stream before showing complete plan'
        }));
      }
      
      res.end();
      
    } catch (error) {
      console.error('Streaming generation error:', error);
      sendData(JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to generate meal plan' }));
      res.end();
    }
  });

  // Weight-based meal plan generation
  app.post("/api/meal-plan/generate-weight-based", authenticateToken, async (req: any, res) => {
    const startTime = Date.now();
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // Check rate limit
      if (!rateLimiter.isAllowed(userId.toString())) {
        return res.status(429).json({
          message: "Rate limit exceeded. Please try again later.",
          remainingRequests: rateLimiter.getRemainingRequests(userId.toString()),
          resetTime: rateLimiter.getResetTime(userId.toString())
        });
      }

      const {
        numDays,
        mealsPerDay,
        goalWeights,
        dietaryRestrictions = [],
        culturalBackground = [],
        availableIngredients = "",
        excludeIngredients = "",
        familySize = 2,
        planTargets = ["Everyone"] // New parameter for family member targeting (array)
      } = req.body;

      // Get weight-based profile and user profile for advanced prompt integration
      let weightBasedProfile = null;
      let userProfile = null;
      let culturalCuisineData = null;
      
      try {
        userProfile = await storage.getProfile(userId);
        console.log('Retrieved user profile for weight-based system:', userProfile?.profile_name);
        
        if (userProfile && userProfile.profile_type === 'weight-based') {
          // Parse goal weights from stored goals
          const storedGoalWeights: any = {};
          if (userProfile.goals && Array.isArray(userProfile.goals)) {
            userProfile.goals.forEach((goal: string) => {
              const [key, value] = goal.split(':');
              storedGoalWeights[key] = parseFloat(value) || 0.5;
            });
          }
          
          weightBasedProfile = {
            profileName: userProfile.profile_name,
            familySize: userProfile.family_size,
            goalWeights: storedGoalWeights,
            dietaryRestrictions: userProfile.preferences || [],
            culturalBackground: userProfile.cultural_background || []
          };
        }

        // Get cultural cuisine data if user has cultural preferences (for advanced prompt integration)
        if (userProfile && userProfile.cultural_background && Array.isArray(userProfile.cultural_background) && userProfile.cultural_background.length > 0) {
          console.log('Weight-based system: User has cultural background:', userProfile.cultural_background);
          const { getCachedCulturalCuisine } = await import('./cultureCacheManager');
          culturalCuisineData = await getCachedCulturalCuisine(userId, userProfile.cultural_background);
          console.log(`Weight-based system: Retrieved cultural cuisine data for: ${userProfile.cultural_background.join(', ')}`);
        }
      } catch (error) {
        console.log('Could not fetch user profile for weight-based system, using request data. Error:', error);
      }

      // Import helper function
      const { mergeFamilyDietaryRestrictions } = await import('../shared/schema');
      
      // Merge dietary restrictions from all sources
      const allRestrictions = new Set<string>();
      
      // Add weight-based profile restrictions
      if (weightBasedProfile?.dietaryRestrictions && Array.isArray(weightBasedProfile.dietaryRestrictions)) {
        weightBasedProfile.dietaryRestrictions.forEach((r: string) => allRestrictions.add(r));
      }
      
      // Add traditional profile restrictions (preferences field)
      if (userProfile?.preferences && Array.isArray(userProfile.preferences)) {
        userProfile.preferences.forEach(r => allRestrictions.add(r));
      }
      
      // Add family member restrictions if traditional profile
      if (userProfile?.members && Array.isArray(userProfile.members)) {
        const familyRestrictions = mergeFamilyDietaryRestrictions(userProfile.members);
        familyRestrictions.forEach(r => allRestrictions.add(r));
      }
      
      // Add request restrictions (highest priority)
      if (dietaryRestrictions && Array.isArray(dietaryRestrictions)) {
        dietaryRestrictions.forEach((r: any) => {
          if (r && r.trim()) allRestrictions.add(r.trim());
        });
      }
      
      const mergedDietaryRestrictions = Array.from(allRestrictions);
      console.log('Weight-based system - Merged dietary restrictions:', mergedDietaryRestrictions);

      // MEMBER-SPECIFIC FILTERING: Apply planTargets filtering for specific family members
      let targetMemberRestrictions = mergedDietaryRestrictions;
      let targetMemberNames = planTargets;
      
      if (!planTargets.includes("Everyone") && userProfile?.members && Array.isArray(userProfile.members)) {
        console.log(`🎯 Filtering meal plan for specific members: "${planTargets.join(', ')}"`);
        
        // Collect restrictions from all selected members
        const memberRestrictions = new Set<string>();
        
        planTargets.forEach(targetName => {
          const targetMember = userProfile.members.find((member: any) => member.name === targetName);
          
          if (targetMember) {
            console.log(`✅ Found target member: ${targetName}`, targetMember);
            
            // Add member's specific dietary restrictions
            if (targetMember.dietaryRestrictions && Array.isArray(targetMember.dietaryRestrictions)) {
              targetMember.dietaryRestrictions.forEach((restriction: string) => {
                if (restriction && restriction.trim()) {
                  memberRestrictions.add(restriction.trim());
                }
              });
            }
            
            // Also check preferences for dietary restrictions (backward compatibility)
            if (targetMember.preferences && Array.isArray(targetMember.preferences)) {
              targetMember.preferences.forEach((pref: string) => {
                const lowerPref = pref.toLowerCase().trim();
                if (lowerPref.includes('allerg') || lowerPref.includes('intoleran') || 
                    lowerPref.includes('free') || lowerPref.includes('vegan') || 
                    lowerPref.includes('vegetarian') || lowerPref.includes('kosher') ||
                    lowerPref.includes('halal') || lowerPref.includes('diet')) {
                  memberRestrictions.add(pref.trim());
                }
              });
            }
          } else {
            console.warn(`⚠️ Could not find family member "${targetName}", skipping`);
          }
        });
        
        // Still include request-level restrictions (highest priority)
        if (dietaryRestrictions && Array.isArray(dietaryRestrictions)) {
          dietaryRestrictions.forEach((r: any) => {
            if (r && r.trim()) memberRestrictions.add(r.trim());
          });
        }
        
        targetMemberRestrictions = Array.from(memberRestrictions);
        console.log(`🎯 Combined restrictions for selected members [${planTargets.join(', ')}]:`, targetMemberRestrictions);
        
      } else if (!planTargets.includes("Everyone") && planTargets.length > 0) {
        console.log(`ℹ️ Plan targets "${planTargets.join(', ')}" specified but no family members found, using merged restrictions`);
      }

      // Use profile data or fallback to request data
      const finalGoalWeights = goalWeights || weightBasedProfile?.goalWeights || {
        cost: 0.5, health: 0.5, cultural: 0.5, variety: 0.5, time: 0.5
      };
      const finalDietaryRestrictions = targetMemberRestrictions; // Use member-filtered restrictions
      const finalCulturalBackground = culturalBackground.length > 0 ? 
        culturalBackground : (weightBasedProfile?.culturalBackground || []);
      // Adjust final family size based on plan targets
      let finalFamilySize;
      if (!planTargets.includes("Everyone") && userProfile?.members && Array.isArray(userProfile.members)) {
        // Count how many valid target members we found
        const validTargetCount = planTargets.filter(targetName => 
          userProfile.members.find((member: any) => member.name === targetName)
        ).length;
        
        if (validTargetCount > 0) {
          finalFamilySize = validTargetCount; // Size based on selected members
          console.log(`🎯 Final family size set to ${validTargetCount} for selected members: ${planTargets.join(', ')}`);
        } else {
          finalFamilySize = familySize || weightBasedProfile?.familySize || 2;
        }
      } else {
        finalFamilySize = familySize || weightBasedProfile?.familySize || 2;
      }

      // Initialize weight-based meal planner
      const { WeightBasedMealPlanner } =  await import('./WeightBasedMealPlanner');
      const planner = new WeightBasedMealPlanner();

      // Get hero ingredients for cost optimization
      let heroIngredients: string[] = [];
      if (finalGoalWeights.cost > 0.6) {
        const { HeroIngredientManager } = await import('./HeroIngredientManager');
        const heroManager = new HeroIngredientManager();
        const heroSelection = await heroManager.selectHeroIngredients(
          finalCulturalBackground,
          availableIngredients.split(',').map((i: string) => i.trim()).filter(Boolean),
          finalGoalWeights.cost,
          finalDietaryRestrictions
        );
        heroIngredients = Array.isArray(heroSelection?.selected_ingredients) ? 
          heroSelection.selected_ingredients.map(ing => ing.name) : [];
        console.log('Selected hero ingredients:', heroIngredients);
      }

      // V2 INTEGRATION: Use Prompt Builder V2 with main goal + weight-based enhancement
      let prompt: string;
      
      // Extract main goal from profile for advanced prompt integration
      const primaryGoal = userProfile?.primary_goal || 'Weight-Based Planning';
      console.log('Weight-based system: Processing main goal:', primaryGoal);
      
      try {
        // Import V2 prompt builder with weight-based intelligence
        const { buildWeightBasedIntelligentPrompt } = await import('./intelligentPromptBuilderV2');
        
        // Build advanced filters for V2 prompt builder
        const advancedFilters = {
          numDays,
          mealsPerDay,
          cookTime: 45, // Default reasonable cook time
          difficulty: 3, // Default moderate difficulty  
          primaryGoal,
          familySize: finalFamilySize,
          familyMembers: Array.isArray(userProfile?.members) ? userProfile.members : [],
          profileType: userProfile?.profile_type as 'individual' | 'family' || 'individual',
          dietaryRestrictions: finalDietaryRestrictions.join(', '),
          culturalBackground: finalCulturalBackground,
          culturalCuisineData: culturalCuisineData,
          availableIngredients,
          excludeIngredients,
          // Member targeting
          planTargets: planTargets,
          targetMemberNames: targetMemberNames,
          // Weight-based enhancements
          goalWeights: finalGoalWeights,
          heroIngredients,
          weightBasedEnhanced: true
        };
        
        // Generate prompt using V2 system (main goals + weight-based intelligence)
        prompt = await buildWeightBasedIntelligentPrompt(
          advancedFilters,
          finalGoalWeights,
          heroIngredients
        );
        
        console.log('✅ Generated V2 weight-based prompt with main goal integration');
        console.log('Main goal:', primaryGoal);
        console.log('Goal weights:', finalGoalWeights);
        console.log('Hero ingredients:', heroIngredients);
        
      } catch (error) {
        console.error('V2 prompt builder failed, falling back to original weight-based prompt:', error);
        
        // Fallback to original weight-based prompt system
        const mealContext = {
          numDays,
          mealsPerDay,
          availableIngredients,
          excludeIngredients,
          familySize: finalFamilySize
        };

        prompt = (planner as any).buildWeightBasedPrompt(
          finalGoalWeights,
          heroIngredients,
          mealContext,
          finalDietaryRestrictions,
          finalFamilySize
        );
        
        console.log('⚠️ Using fallback weight-based prompt');
        console.log('Goal weights:', finalGoalWeights);
        console.log('Hero ingredients:', heroIngredients);
      }

      // Generate meal plan using OpenAI
      const openai = new (await import('openai')).OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: 'system',
            content: `You are an advanced meal planning expert with weight-based intelligence. You understand main goals (like "${primaryGoal}") and can apply weight-based priorities to refine decisions. ${!planTargets.includes("Everyone") ? `This meal plan is specifically designed for "${planTargets.join(', ')}" with their combined dietary restrictions and preferences.` : 'This meal plan is designed for the entire family with merged dietary restrictions.'} Generate exactly the requested number of days following the main goal guidance first, then using weights to resolve conflicts. Always return valid JSON with proper day structure.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 4000
      });

      let mealPlan;
      try {
        mealPlan = JSON.parse(completion.choices[0].message.content || '{}');
      } catch (parseError) {
        console.error('Failed to parse AI response:', parseError);
        throw new Error('Invalid response format from AI');
      }

      // Validate and enhance meal plan with cultural meal integration
      if (finalGoalWeights.cultural > 0.3 && finalCulturalBackground.length > 0) {
        const { SmartCulturalMealSelector } = await import('./SmartCulturalMealSelector');
        const culturalSelector = new SmartCulturalMealSelector();
        
        try {
          const culturalMeals = await (culturalSelector as any).getCompatibleCulturalMeals(
            userId,
            finalCulturalBackground,
            finalDietaryRestrictions
          );
          
          if (culturalMeals.length > 0) {
            // Integrate cultural meals into the plan
            const enhancedPlan = await (culturalSelector as any).integrateCulturalMeals(
              mealPlan,
              culturalMeals,
              finalGoalWeights,
              { numDays, mealsPerDay }
            );
            mealPlan = enhancedPlan;
            console.log('Enhanced meal plan with cultural integration');
          }
        } catch (culturalError) {
          console.log('Cultural meal integration failed, using basic plan:', culturalError);
        }
      }

      // Add metadata about the V2 weight-based generation
      const finalMealPlan = {
        ...mealPlan,
        generation_metadata: {
          type: 'weight-based-v2',
          main_goal: primaryGoal,
          goal_weights: finalGoalWeights,
          hero_ingredients: heroIngredients,
          cultural_integration: finalGoalWeights.cultural > 0.3,
          advanced_prompt_used: true,
          prompt_builder_version: 'V2',
          generation_time_ms: Date.now() - startTime
        }
      };

      console.log(`✅ Generated weight-based meal plan in ${Date.now() - startTime}ms`);
      res.json(finalMealPlan);

    } catch (error) {
      console.error("Error generating weight-based meal plan:", error);
      res.status(500).json({ message: "Failed to generate weight-based meal plan" });
    }
  });

  // Cache statistics endpoint
  app.get("/api/cache/stats", (req, res) => {
    // Temporary mock stats while caching is disabled
    res.json({
      cacheSize: 0,
      hitRate: "0.0%",
      estimatedSavings: "$0.0000 per request"
    });
  });

  // Optimized shopping list endpoint
  app.post("/api/shopping-list/optimize", async (req, res) => {
    try {
      const { mealPlan, userPreferences } = req.body;

      if (!mealPlan) {
        return res.status(400).json({ message: "Meal plan data is required" });
      }

      const { createOptimizedShoppingList } = await import("./instacart");
      const optimizedData = await createOptimizedShoppingList(mealPlan, userPreferences);

      res.json(optimizedData);
    } catch (error: any) {
      console.error("Error creating optimized shopping list:", error);
      res.status(500).json({ message: `Failed to optimize shopping list: ${error.message}` });
    }
  });

  // Intelligent cooking time and difficulty calculation endpoint
  app.post("/api/recipes/calculate-timing", async (req, res) => {
    try {
      const { recipe, constraints } = req.body;

      if (!recipe || !recipe.title || !recipe.ingredients) {
        return res.status(400).json({ message: "Recipe with title and ingredients is required" });
      }

      const { calculateCookingTimeAndDifficulty, getEasyAlternatives } = await import("./cookingTimeCalculator");
      const { validateMealConstraints } = await import("./intelligentPromptBuilder");

      const calculation = calculateCookingTimeAndDifficulty(recipe);
      const alternatives = getEasyAlternatives(recipe);

      let validation = null;
      if (constraints) {
        validation = validateMealConstraints(
          { ...recipe, ...calculation }, 
          constraints
        );
      }

      res.json({
        timing: calculation,
        alternatives,
        validation,
        enhanced_recipe: {
          ...recipe,
          cook_time_minutes: calculation.totalMinutes,
          prep_time_minutes: calculation.prepTime,
          actual_cook_time_minutes: calculation.cookTime,
          difficulty: calculation.difficulty
        }
      });
    } catch (error: any) {
      console.error("Error calculating cooking timing:", error);
      res.status(500).json({ message: `Failed to calculate timing: ${error.message}` });
    }
  });

  // Batch cooking time estimation for meal planning
  app.post("/api/recipes/batch-timing", async (req, res) => {
    try {
      const { recipes } = req.body;

      if (!recipes || !Array.isArray(recipes)) {
        return res.status(400).json({ message: "Array of recipes is required" });
      }

      const { estimateBatchCookingTime } = await import("./cookingTimeCalculator");
      const batchEstimate = estimateBatchCookingTime(recipes);

      res.json(batchEstimate);
    } catch (error: any) {
      console.error("Error calculating batch timing:", error);
      res.status(500).json({ message: `Failed to calculate batch timing: ${error.message}` });
    }
  });

  // Simple Perplexity Recipe Search Test
  app.post("/api/recipes/intelligent-search", authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      const { query } = req.body;
      
      if (!query) {
        return res.status(400).json({ message: "Search query is required" });
      }

      console.log(`🔍 [PERPLEXITY TEST] Starting search for: "${query}"`);
      console.log(`🔑 [PERPLEXITY TEST] API Key exists: ${!!process.env.PERPLEXITY_API_KEY}`);

      // Test Perplexity API only first - Fix the request format
      const requestBody = {
        model: 'llama-3.1-sonar-small-128k-online',
        messages: [
          {
            role: 'system',
            content: 'You are a recipe search expert. Find detailed recipes with ingredients, instructions, and cooking times.'
          },
          {
            role: 'user', 
            content: `Find 3 simple recipes for: ${query}. Include ingredients, instructions, cooking time, and difficulty level for each recipe.`
          }
        ],
        max_tokens: 1500,
        temperature: 0.3,
        top_p: 0.9,
        return_citations: true,
        return_images: false,
        return_related_questions: false,
        search_recency_filter: "month",
        top_k: 0,
        stream: false,
        presence_penalty: 0,
        frequency_penalty: 1
      };

      console.log(`📤 [PERPLEXITY TEST] Request body:`, JSON.stringify(requestBody, null, 2));

      const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      console.log(`🌐 [PERPLEXITY] Response status: ${perplexityResponse.status}`);

      if (!perplexityResponse.ok) {
        const errorText = await perplexityResponse.text();
        console.error(`🚨 [PERPLEXITY] Error response:`, errorText);
        throw new Error(`Perplexity API error: ${perplexityResponse.status} - ${errorText}`);
      }

      const perplexityData = await perplexityResponse.json();
      const recipeContent = perplexityData.choices[0]?.message?.content || '';
      const citations = perplexityData.citations || [];

      console.log(`🌐 [PERPLEXITY] Success! Found ${citations.length} citations`);
      console.log(`📝 [PERPLEXITY] Content length: ${recipeContent.length} characters`);
      console.log(`📝 [PERPLEXITY] Content preview:`, recipeContent.substring(0, 200) + '...');

      // Return simple response for testing
      res.json({
        success: true,
        query,
        perplexityContent: recipeContent,
        citations,
        contentLength: recipeContent.length,
        searchMetadata: {
          perplexitySearched: true,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error: any) {
      console.error("🚨 [PERPLEXITY TEST] Error:", error);
      res.status(500).json({ 
        message: "Failed to perform perplexity search",
        error: error.message,
        query: req.body.query 
      });
    }
  });

  // Dietary-cultural conflict resolution endpoint
  app.post("/api/recipes/resolve-conflicts", async (req, res) => {
    try {
      const { mealRequest, dietaryRestrictions, culturalBackground } = req.body;

      if (!mealRequest) {
        return res.status(400).json({ message: "Meal request is required" });
      }

      const { resolveDietaryCulturalConflicts, hasQuickConflict, getIngredientSubstitutions } = await import("./dietaryCulturalConflictResolver");

      // Provide defaults for optional parameters
      const restrictions = dietaryRestrictions || [];
      const cultural = culturalBackground || [];

      const resolution = await resolveDietaryCulturalConflicts(
        mealRequest,
        restrictions,
        cultural
      );

      res.json({
        success: true,
        mealRequest,
        resolution,
        quickCheck: hasQuickConflict(mealRequest, restrictions)
      });
    } catch (error: any) {
      console.error("Error resolving dietary conflicts:", error);
      res.status(500).json({ 
        success: false,
        message: `Failed to resolve conflicts: ${error.message}` 
      });
    }
  });

  // Get ingredient substitutions endpoint
  app.post("/api/recipes/ingredient-substitutions", async (req, res) => {
    try {
      const { ingredient, dietaryRestriction } = req.body;

      if (!ingredient || !dietaryRestriction) {
        return res.status(400).json({ message: "Ingredient and dietary restriction are required" });
      }

      const { getIngredientSubstitutions } = await import("./dietaryCulturalConflictResolver");
      const substitutions = getIngredientSubstitutions(ingredient, dietaryRestriction);

      res.json({
        success: true,
        ingredient,
        dietaryRestriction,
        substitutions
      });
    } catch (error: any) {
      console.error("Error getting ingredient substitutions:", error);
      res.status(500).json({ 
        success: false,
        message: `Failed to get substitutions: ${error.message}` 
      });
    }
  });

  // Helper function to get the actual database user ID
  async function getDatabaseUserId(req: any): Promise<string | null> {
    console.log('🔍 [AUTH DEBUG] getDatabaseUserId called with req.user:', req.user ? {
      id: req.user.id,
      email: req.user.email,
      exists: !!req.user
    } : 'req.user is null/undefined');

    // For JWT auth, just return the user ID directly
    if (req.user?.id) {
      console.log('✅ [AUTH DEBUG] User ID found:', req.user.id);
      return req.user.id;
    }

    console.log('❌ [AUTH DEBUG] No user ID found in request');
    return null;
  }

  // Profile routes
  app.get("/api/profile", authenticateToken, async (req: any, res) => {
    try {
      const userId = await getDatabaseUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const profile = await storage.getProfile(userId);
      res.json(profile);
    } catch (error) {
      console.error("Error fetching profile:", error);
      res.status(500).json({ message: "Failed to fetch profile" });
    }
  });

  app.post("/api/profile", authenticateToken, async (req: any, res) => {
    try {
      const userId = await getDatabaseUserId(req);
      if (!userId) {
        console.error('Profile creation failed: User not authenticated');
        return res.status(401).json({ message: "User not authenticated" });
      }

      console.log('Creating profile for user:', userId);
      console.log('Request body:', req.body);

      // Validate required fields
      const { profile_name, primary_goal } = req.body;
      if (!profile_name?.trim()) {
        console.error('Profile creation failed: Missing profile name');
        return res.status(400).json({ message: "Profile name is required" });
      }

      if (!primary_goal) {
        console.error('Profile creation failed: Missing primary goal');
        return res.status(400).json({ message: "Primary goal is required" });
      }

      try {
        const profileData = insertProfileSchema.parse({
          user_id: userId,
          ...req.body
        });

        console.log('Parsed profile data:', profileData);

        const profile = await storage.createProfile(profileData);
        console.log('Created profile:', profile);

        // PROACTIVE CULTURAL DATA CACHING: Auto-cache cultural data after profile creation
        if (profileData.cultural_background && Array.isArray(profileData.cultural_background) && profileData.cultural_background.length > 0) {
          try {
            console.log(`🚀 Auto-caching cultural data for new profile: [${profileData.cultural_background.join(', ')}]`);

            // Import and trigger cultural data caching asynchronously
            import('./cultureCacheManager').then(async ({ getCachedCulturalCuisine }) => {
              try {
                for (const culture of profileData.cultural_background || []) {
                  await getCachedCulturalCuisine(userId, [culture]);
                  console.log(`   ✅ Cached cultural data for: ${culture}`);
                }
                console.log(`🎯 Auto-caching complete for user ${userId}`);
              } catch (cacheError) {
                console.warn('Auto-caching failed:', cacheError);
              }
            });
          } catch (error) {
            console.warn('Failed to trigger auto-caching:', error);
          }
        }

        res.json(profile);
      } catch (parseError) {
        console.error('Profile creation failed: Schema validation error:', parseError);
        if (parseError instanceof Error) {
          return res.status(400).json({ 
            message: "Invalid profile data", 
            details: parseError.message 
          });
        }
        return res.status(400).json({ message: "Invalid profile data format" });
      }
    } catch (error) {
      console.error("Error creating profile:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to create profile";
      res.status(500).json({ 
        message: "Failed to create profile",
        error: errorMessage 
      });
    }
  });

  app.put("/api/profile", authenticateToken, async (req: any, res) => {
    try {
      const userId = await getDatabaseUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const profile = await storage.updateProfile(userId, req.body);
      if (!profile) {
        return res.status(404).json({ message: "Profile not found" });
      }

      // CACHE INVALIDATION AND REFRESH: Clear old cache and refresh cultural data on profile update
      if (req.body.cultural_background) {
        try {
          console.log(`🔄 Profile cultural background updated for user ${userId}: [${req.body.cultural_background.join(', ')}]`);

          import('./cultureCacheManager').then(async ({ clearUserCache, getCachedCulturalCuisine }) => {
            try {
              // Clear existing cache for this user
              clearUserCache(userId);
              console.log(`   🗑️ Cleared old cultural cache for user ${userId}`);

              // Refresh cache with new cultural background
              if (req.body.cultural_background && req.body.cultural_background.length > 0) {
                for (const culture of req.body.cultural_background) {
                  await getCachedCulturalCuisine(userId, [culture]);
                  console.log(`   ✅ Refreshed cultural data for: ${culture}`);
                }
                console.log(`🎯 Cache refresh complete for user ${userId}`);
              }
            } catch (cacheError) {
              console.warn('Cache refresh failed:', cacheError);
            }
          });
        } catch (error) {
          console.warn('Failed to trigger cache refresh:', error);
        }
      }

      res.json(profile);
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Weight-based profile routes
  app.get("/api/profile/weight-based", authenticateToken, async (req: any, res) => {
    try {
      const userId = await getDatabaseUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // Try to get existing profile first
      const existingProfile = await storage.getProfile(userId);
      
      if (existingProfile) {
        console.log('🔍 Processing existing profile for weight extraction:', {
          profile_name: existingProfile.profile_name,
          goals: existingProfile.goals,
          goalsType: typeof existingProfile.goals,
          goalsIsArray: Array.isArray(existingProfile.goals),
          goalsLength: existingProfile.goals?.length
        });

        // Extract stored goal weights - handle both object and array formats
        const storedGoalWeights: any = {
          cost: 0.5,
          health: 0.5,
          cultural: 0.5,
          variety: 0.5,
          time: 0.5
        };

        let parsedWeightsCount = 0;

        if (existingProfile.goals) {
          console.log('📋 Processing goals data:', existingProfile.goals, 'type:', typeof existingProfile.goals);
          
          // Handle object format (e.g., {"cost":0.8,"health":0.5,...})
          if (typeof existingProfile.goals === 'object' && !Array.isArray(existingProfile.goals)) {
            console.log('📋 Processing goals as object format');
            
            Object.entries(existingProfile.goals).forEach(([key, value]) => {
              console.log(`🔍 Processing goal object entry: key="${key}", value="${value}"`);
              
              if (typeof value === 'number' && value >= 0 && value <= 1) {
                storedGoalWeights[key] = value;
                parsedWeightsCount++;
                console.log(`   ✅ Set ${key} = ${value}`);
              } else {
                console.log(`   ❌ Invalid weight value: ${value}`);
              }
            });
          }
          // Handle array format (e.g., ["cost:0.8", "health:0.5", ...])
          else if (Array.isArray(existingProfile.goals)) {
            console.log('📋 Processing goals as array format');
            
            existingProfile.goals.forEach((goal: string, index: number) => {
              console.log(`🔍 Processing goal ${index}:`, goal, typeof goal);
              
              if (typeof goal === 'string' && goal.includes(':')) {
                const [key, value] = goal.split(':');
                console.log(`   Split result: key="${key}", value="${value}"`);
                
                if (key && value) {
                  const weight = parseFloat(value);
                  console.log(`   Parsed weight: ${weight}, isNaN: ${isNaN(weight)}`);
                  
                  if (!isNaN(weight) && weight >= 0 && weight <= 1) {
                    storedGoalWeights[key] = weight;
                    parsedWeightsCount++;
                    console.log(`   ✅ Set ${key} = ${weight}`);
                  } else {
                    console.log(`   ❌ Invalid weight value: ${weight}`);
                  }
                } else {
                  console.log(`   ❌ Missing key or value after split`);
                }
              } else {
                console.log(`   ❌ Goal is not string or doesn't contain ":"`);
              }
            });
          } else {
            console.log('❌ Goals is neither object nor array');
          }
        } else {
          console.log('❌ Goals is null/undefined');
        }

        console.log('📊 Final extracted stored goal weights:', storedGoalWeights);
        console.log(`📊 Successfully parsed ${parsedWeightsCount} weights from ${existingProfile.goals?.length || 0} goals`);
        
        // Convert existing profile to weight-based format
        const weightBasedProfile = {
          profileName: existingProfile.profile_name || 'My Profile',
          familySize: existingProfile.family_size || 2,
          goalWeights: storedGoalWeights,
          dietaryRestrictions: existingProfile.preferences || [],
          culturalBackground: existingProfile.cultural_background || []
        };
        
        res.json(weightBasedProfile);
      } else {
        res.json(null);
      }
    } catch (error) {
      console.error("Error fetching weight-based profile:", error);
      res.status(500).json({ message: "Failed to fetch weight-based profile" });
    }
  });

  app.post("/api/profile/weight-based", authenticateToken, async (req: any, res) => {
    try {
      const userId = await getDatabaseUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const { profileName, familySize, goalWeights, dietaryRestrictions, culturalBackground, profileType, questionnaire_answers, questionnaire_selections } = req.body;

      console.log('💾 Creating weight-based profile with data:', {
        profileName,
        familySize,
        goalWeights,
        dietaryRestrictions,
        culturalBackground,
        questionnaire_answers,
        questionnaire_selections
      });

      // Convert goalWeights to goals array format
      const goalsArray = Object.entries(goalWeights).map(([goal, weight]) => `${goal}:${weight}`);
      console.log('💾 Converted goalWeights to goals array for creation:', goalsArray);

      // Create profile using existing schema structure
      const profileData = {
        user_id: userId,
        profile_name: profileName,
        primary_goal: 'Weight-Based Planning',
        family_size: familySize,
        members: [], // Empty for weight-based approach
        profile_type: (profileType || 'individual') as 'individual' | 'family',
        preferences: dietaryRestrictions,
        goals: goalsArray,
        cultural_background: culturalBackground
      };

      console.log('💾 Final profileData being created:', profileData);

      const profile = await storage.createProfile(profileData);
      
      console.log('💾 Profile created successfully:', {
        profile_name: profile.profile_name,
        goals: profile.goals,
        savedGoalWeights: goalWeights
      });

      const response = {
        profileName: profile.profile_name,
        familySize: profile.family_size,
        goalWeights,
        dietaryRestrictions: profile.preferences,
        culturalBackground: profile.cultural_background
      };

      console.log('💾 Returning creation response to client:', response);
      res.json(response);
    } catch (error) {
      console.error("Error creating weight-based profile:", error);
      res.status(500).json({ message: "Failed to create weight-based profile" });
    }
  });

  app.put("/api/profile/weight-based", authenticateToken, async (req: any, res) => {
    console.log('🚀 [PROFILE DEBUG] PUT /api/profile/weight-based called');
    console.log('🚀 [PROFILE DEBUG] Request body keys:', Object.keys(req.body));
    console.log('🚀 [PROFILE DEBUG] Auth header present:', !!req.headers.authorization);

    try {
      const userId = await getDatabaseUserId(req);
      console.log('🚀 [PROFILE DEBUG] Retrieved userId:', userId);

      if (!userId) {
        console.log('❌ [PROFILE DEBUG] No userId found, returning 401');
        return res.status(401).json({ message: "User not authenticated" });
      }

      const { profileName, familySize, goalWeights, dietaryRestrictions, culturalBackground, profileType, questionnaire_answers, questionnaire_selections } = req.body;

      console.log('💾 Saving weight-based profile with data:', {
        profileName,
        familySize,
        goalWeights,
        dietaryRestrictions,
        culturalBackground,
        questionnaire_answers,
        questionnaire_selections
      });

      // Convert goalWeights to goals array format
      const goalsArray = Object.entries(goalWeights).map(([goal, weight]) => `${goal}:${weight}`);
      console.log('💾 Converted goalWeights to goals array:', goalsArray);

      // Check if profile exists first
      console.log('🔍 [PROFILE DEBUG] Checking for existing profile for userId:', userId);
      const existingProfile = await storage.getProfile(userId);
      console.log('🔍 [PROFILE DEBUG] Existing profile found:', !!existingProfile, existingProfile ? { id: existingProfile.id, profile_name: existingProfile.profile_name } : 'none');
      
      let profile;
      if (existingProfile) {
        // Update existing profile
        const profileData = {
          profile_name: profileName || existingProfile.profile_name || 'My Profile',
          primary_goal: 'Weight-Based Planning',
          family_size: familySize || existingProfile.family_size || 2,
          members: existingProfile.members || [],
          profile_type: (profileType || existingProfile.profile_type || 'individual') as 'individual' | 'family',
          preferences: dietaryRestrictions || existingProfile.preferences || [],
          goals: goalsArray,
          cultural_background: culturalBackground || existingProfile.cultural_background || []
        };

        console.log('💾 Final profileData being updated:', profileData);
        profile = await storage.updateProfile(userId, profileData);
      } else {
        // Create new profile
        const profileData = {
          user_id: userId,
          profile_name: profileName || 'My Profile',
          primary_goal: 'Weight-Based Planning',
          family_size: familySize || 2,
          members: [],
          profile_type: (profileType || 'individual') as 'individual' | 'family',
          preferences: dietaryRestrictions || [],
          goals: goalsArray,
          cultural_background: culturalBackground || []
        };

        console.log('💾 Final profileData being created:', profileData);
        profile = await storage.createProfile(profileData);
      }

      console.log('💾 Profile saved successfully:', {
        profile_name: profile.profile_name,
        goals: profile.goals,
        savedGoalWeights: goalWeights
      });

      const response = {
        profileName: profile.profile_name,
        familySize: profile.family_size,
        goalWeights,
        dietaryRestrictions: profile.preferences,
        culturalBackground: profile.cultural_background
      };

      console.log('💾 Returning response to client:', response);
      res.json(response);
    } catch (error) {
      console.error("Error updating weight-based profile:", error);
      res.status(500).json({ message: "Failed to update weight-based profile" });
    }
  });

  // NLP Culture Parser route
  app.post("/api/culture-parser", authenticateToken, async (req: any, res) => {
    try {
      const { text } = req.body;

      if (!text || typeof text !== 'string') {
        return res.status(400).json({ message: "Text input is required" });
      }

      // Import the NLP culture parser
      const { nlpCultureParser } = await import('./nlpCultureParser');
      const result = await nlpCultureParser(text);

      res.json(result);
    } catch (error) {
      console.error("Error in culture parser:", error);
      res.status(500).json({ message: "Failed to parse cultural input" });
    }
  });

  // Cultural cuisine data route
  app.get("/api/cultural-cuisine/:cuisine", authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const { cuisine } = req.params;

      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      if (!cuisine) {
        return res.status(400).json({ message: "Cuisine parameter is required" });
      }

      const { getCulturalCuisineData } = await import('./cultureCacheManager');
      const cuisineData = await getCulturalCuisineData(userId, cuisine);

      if (!cuisineData) {
        return res.status(404).json({ message: "Cuisine data not found" });
      }

      res.json(cuisineData);
    } catch (error) {
      console.error("Error fetching cultural cuisine data:", error);
      res.status(500).json({ message: "Failed to fetch cuisine data" });
    }
  });

  // Trigger cultural cuisine caching for user's profile
  app.post("/api/cache-cultural-cuisines", authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // Get user's cultural background
      const profile = await storage.getProfile(userId);
      if (!profile || !profile.cultural_background) {
        return res.status(404).json({ message: "No cultural preferences found in profile" });
      }

      const culturalBackground = Array.isArray(profile.cultural_background) 
        ? profile.cultural_background 
        : [];

      if (culturalBackground.length === 0) {
        return res.json({ message: "No cultural cuisines to cache", cached: [] });
      }

      const { getCulturalCuisineData } = await import('./cultureCacheManager');
      const cachePromises = culturalBackground.map(cuisine => 
        getCulturalCuisineData(userId, cuisine)
      );

      const results = await Promise.allSettled(cachePromises);
      const cached = culturalBackground.filter((_, index) => 
        results[index].status === 'fulfilled' && results[index].value !== null
      );

      res.json({ 
        message: `Cached data for ${cached.length} cuisines`, 
        cached,
        total: culturalBackground.length 
      });
    } catch (error) {
      console.error("Error caching cultural cuisines:", error);
      res.status(500).json({ message: "Failed to cache cultural cuisine data" });
    }
  });

  // Get cache statistics
  app.get("/api/culture-cache-stats", authenticateToken, async (req: any, res) => {
    try {
      const { getCacheStats } = await import('./cultureCacheManager');
      const stats = getCacheStats();
      res.json(stats);
    } catch (error) {
      console.error("Error getting cache stats:", error);
      res.status(500).json({ message: "Failed to get cache statistics" });
    }
  });

  // Clear all cultural cache data endpoint  
  app.post("/api/clear-cultural-cache", async (req, res) => {
    try {
      const { clearAllCache } = await import('./cultureCacheManager');
      clearAllCache();

      res.json({
        success: true,
        message: "All cultural cache data has been cleared. Fresh research will be performed for all cuisines."
      });
    } catch (error) {
      console.error('🚨 Error clearing cultural cache:', error);
      res.status(500).json({
        error: 'Failed to clear cache',
        message: 'Unable to clear cultural cache data'
      });
    }
  });

  // Save cultural meals to user profile
  app.post("/api/save-cultural-meals", async (req, res) => {
    const { saveCulturalMeals } = await import('./routes/save-cultural-meals');
    return saveCulturalMeals(req, res);
  });

  // Get user's saved cultural meals
  app.get("/api/saved-cultural-meals", async (req, res) => {
    try {
      const userId = 9; // Default user ID for testing
      const { userSavedCulturalMeals } = await import('../shared/schema');
      const { eq } = await import('drizzle-orm');

      // Mock response for saved cultural meals
      const savedMeals: any[] = [];

      res.json({
        success: true,
        saved_meals: savedMeals
      });

    } catch (error) {
      console.error('❌ Error fetching saved cultural meals:', error);
      res.status(500).json({
        error: 'Failed to fetch saved meals',
        message: 'An internal server error occurred'
      });
    }
  });

  // Cultural cuisine research endpoint
  app.post("/api/cultural-cuisine-research", async (req, res) => {
    try {
      const { cuisine } = req.body;

      if (!cuisine || typeof cuisine !== 'string') {
        return res.status(400).json({
          error: 'Missing or invalid cuisine parameter',
          message: 'Please provide a valid cuisine name to research'
        });
      }

      if (cuisine.trim().length === 0) {
        return res.status(400).json({
          error: 'Empty cuisine name',
          message: 'Cuisine name cannot be empty'
        });
      }

      const trimmedCuisine = cuisine.trim();
      console.log(`🔍 Research request for cuisine: ${trimmedCuisine}`);

      // Use the existing Perplexity integration to fetch detailed cuisine data
      // Using a temporary userId (0) since this is for research only - check cache first
      const { getCulturalCuisineData } = await import('./cultureCacheManager');
      const cuisineData = await getCulturalCuisineData(0, trimmedCuisine);

      if (!cuisineData) {
        console.error(`❌ Failed to fetch research data for cuisine: ${trimmedCuisine}`);
        return res.status(404).json({
          error: 'Research failed',
          message: `Unable to find detailed information for ${trimmedCuisine} cuisine. Please try again or check the cuisine name.`
        });
      }

      console.log(`✅ Successfully researched ${trimmedCuisine} cuisine`);

      // Return the detailed cuisine research data
      res.json({
        cuisine: trimmedCuisine,
        culture: (cuisineData as any).culture || trimmedCuisine,
        meals: cuisineData.meals || [],
        summary: cuisineData.summary || {
          common_healthy_ingredients: [],
          common_cooking_techniques: []
        },
        research_timestamp: new Date().toISOString(),
        data_source: 'Perplexity AI'
      });

    } catch (error) {
      console.error('🚨 Error in cultural cuisine research endpoint:', error);

      // Handle different types of errors
      if (error instanceof Error) {
        if (error.message.includes('rate limit') || error.message.includes('Rate limited')) {
          return res.status(429).json({
            error: 'Rate limit exceeded',
            message: 'Too many research requests. Please wait a moment before trying again.',
            retry_after: 60
          });
        }

        if (error.message.includes('API key') || error.message.includes('Authorization')) {
          return res.status(503).json({
            error: 'Service configuration error',
            message: 'Research service is temporarily unavailable. Please try again later.'
          });
        }
      }

      res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred while researching the cuisine. Please try again.'
      });
    }
  });

  // Perplexity Search Cache Endpoints
  app.get("/api/perplexity-cache", async (req, res) => {
    try {
      const { perplexityLogger } = await import('./perplexitySearchLogger');
      const searchHistory = await perplexityLogger.getSearchHistory(100);
      res.json(searchHistory);
    } catch (error) {
      console.error('Failed to get Perplexity cache:', error);
      res.status(500).json({ error: 'Failed to load search history' });
    }
  });

  app.delete("/api/perplexity-cache", async (req, res) => {
    try {
      const { perplexityLogger } = await import('./perplexitySearchLogger');
      await perplexityLogger.clearSearchHistory();
      res.json({ success: true, message: 'Search history cleared' });
    } catch (error) {
      console.error('Failed to clear Perplexity cache:', error);
      res.status(500).json({ error: 'Failed to clear search history' });
    }
  });

  app.get("/api/perplexity-cache/stats", async (req, res) => {
    try {
      const { perplexityLogger } = await import('./perplexitySearchLogger');
      const stats = await perplexityLogger.getSearchStats();
      res.json(stats);
    } catch (error) {
      console.error('Failed to get Perplexity cache stats:', error);
      res.status(500).json({ error: 'Failed to load cache statistics' });
    }
  });

  /**
   * Validate and round difficulties to nearest 0.5 within max constraint
   */
  function validateAndRoundDifficulties(mealPlan: any, maxDifficulty: number) {
    Object.keys(mealPlan).forEach(day => {
      const dayMeals = mealPlan[day];
      if (typeof dayMeals === 'object') {
        Object.keys(dayMeals).forEach(mealType => {
          const meal = dayMeals[mealType];
          if (meal && typeof meal.difficulty === 'number') {
            // Round to nearest 0.5 increment
            const roundedDifficulty = Math.round(meal.difficulty * 2) / 2;

            // Ensure it doesn't exceed the maximum
            const finalDifficulty = Math.min(roundedDifficulty, maxDifficulty);

            if (meal.difficulty !== finalDifficulty) {
              console.log(`Adjusted difficulty: ${day} ${mealType} from ${meal.difficulty} to ${finalDifficulty}`);
              meal.difficulty = finalDifficulty;
            }
          }
        });
      }
    });
  }

  // Achievement routes
  app.get("/api/achievements", authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      let achievements = await storage.getUserAchievements(userId);
      
      // Initialize achievements if none exist
      if (achievements.length === 0) {
        achievements = await storage.initializeUserAchievements(userId);
      }

      res.json(achievements);
    } catch (error) {
      console.error("Error fetching achievements:", error);
      res.status(500).json({ message: "Failed to fetch achievements" });
    }
  });

  app.post("/api/achievements/trigger", authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const { achievementId, progress } = req.body;

      if (!achievementId) {
        return res.status(400).json({ message: "Achievement ID is required" });
      }

      // Get current achievement
      const achievement = await storage.getUserAchievement(userId, achievementId);
      if (!achievement) {
        return res.status(404).json({ message: "Achievement not found" });
      }

      const newProgress = progress || (achievement.progress || 0) + 1;
      const isUnlocked = newProgress >= achievement.max_progress;

      const updatedAchievement = await storage.updateUserAchievement(userId, achievementId, {
        progress: newProgress,
        is_unlocked: isUnlocked,
        unlocked_date: isUnlocked ? new Date() : undefined
      });

      res.json({
        achievement: updatedAchievement,
        isNewlyUnlocked: isUnlocked && !achievement.is_unlocked
      });
    } catch (error) {
      console.error("Error triggering achievement:", error);
      res.status(500).json({ message: "Failed to trigger achievement" });
    }
  });

  app.get("/api/achievements/:achievementId", authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const { achievementId } = req.params;
      const achievement = await storage.getUserAchievement(userId, achievementId);

      if (!achievement) {
        return res.status(404).json({ message: "Achievement not found" });
      }

      res.json(achievement);
    } catch (error) {
      console.error("Error fetching achievement:", error);
      res.status(500).json({ message: "Failed to fetch achievement" });
    }
  });

  // Enhanced Cultural Ranking + Llama Meal Plan Generation
  app.post("/api/enhanced-meal-plan", authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const { 
        numDays = 3, 
        mealsPerDay = 3, 
        goalWeights,
        profile: userProfile
      } = req.body;

      console.log(`🚀 Enhanced meal plan request: ${numDays} days, ${mealsPerDay} meals/day`);

      // Get user's profile data
      const profile = userProfile || await storage.getProfile(userId);
      if (!profile) {
        return res.status(404).json({ message: "Profile not found" });
      }

      // Import enhanced meal plan generator
      const { enhancedMealPlanGenerator, EnhancedMealPlanGenerator } = await import('./enhancedMealPlanGenerator');
      
      // Build cultural profile from user data
      const culturalProfile = EnhancedMealPlanGenerator.buildUserProfile(profile, goalWeights);
      
      console.log('🎯 Cultural profile:', {
        culturalPrefs: Object.keys(culturalProfile.cultural_preferences),
        weights: culturalProfile.priority_weights,
        restrictions: culturalProfile.dietary_restrictions
      });

      // Generate enhanced meal plan
      const mealPlan = await enhancedMealPlanGenerator.generateMealPlan({
        userId: userId,
        numDays,
        mealsPerDay,
        userProfile: culturalProfile,
        servingSize: profile.family_size || 1
      });

      console.log(`✅ Generated enhanced meal plan in ${mealPlan.generation_metadata.processing_time_ms}ms`);

      res.json(mealPlan);

    } catch (error) {
      console.error("❌ Enhanced meal plan generation failed:", error);
      res.status(500).json({ 
        message: "Failed to generate enhanced meal plan",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Simple test endpoint to verify API is working
  app.get("/api/test-simple", (req, res) => {
    res.json({ message: "API is working", timestamp: new Date().toISOString() });
  });



  // Intelligent Meal Base Selection Endpoint
  app.post("/api/intelligent-meal-selection", async (req, res) => {
    try {
      console.log('🤖 Intelligent meal selection endpoint called');
      const { userId = 1, userProfile, selectedMeal, totalMeals = 9 } = req.body;

      if (!userProfile) {
        return res.status(400).json({ error: 'User profile is required' });
      }

      // Import the intelligent meal base selector
      const { intelligentMealBaseSelector } = await import('./intelligentMealBaseSelector.js');

      if (selectedMeal) {
        // User selected a specific base meal - generate plan around it
        console.log(`🎯 Generating meal plan around selected base: ${selectedMeal.meal.name}`);
        
        // Create base meal selection object
        const baseMealSelection = {
          baseMeal: selectedMeal.meal,
          similarity_score: selectedMeal.total_score,
          usage_rationale: selectedMeal.ranking_explanation || 'Selected by user as preferred base meal',
          weight_alignment: selectedMeal.component_scores
        };

        const mealPlan = await intelligentMealBaseSelector.generateMealPlanWithBase(
          userId,
          userProfile,
          baseMealSelection,
          totalMeals
        );

        console.log(`✅ Generated meal plan with ${mealPlan.complementaryMeals.length + mealPlan.variety_boost_meals.length + 1} meals`);

        res.json({
          success: true,
          mealPlan,
          processingTime: Date.now()
        });

      } else {
        // Auto-select optimal base meal using questionnaire weights
        console.log('🔍 Auto-selecting optimal base meal from user preferences');
        
        const cultures = Object.keys(userProfile.cultural_preferences);
        const baseMealSelection = await intelligentMealBaseSelector.findOptimalBaseMeal(
          userId,
          userProfile,
          cultures
        );

        if (!baseMealSelection) {
          return res.status(404).json({ 
            error: 'No suitable base meal found for your preferences',
            suggestion: 'Try adjusting your cultural preferences or dietary restrictions'
          });
        }

        const mealPlan = await intelligentMealBaseSelector.generateMealPlanWithBase(
          userId,
          userProfile,
          baseMealSelection,
          totalMeals
        );

        console.log(`✅ Auto-generated meal plan with optimal base: ${baseMealSelection.baseMeal.name}`);

        res.json({
          success: true,
          mealPlan,
          autoSelectedBase: true,
          processingTime: Date.now()
        });
      }

    } catch (error) {
      console.error('❌ Error in intelligent meal selection:', error);
      res.status(500).json({ 
        error: 'Internal server error during intelligent meal selection',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ============================================
  // COMMUNITY & MEAL PLAN SHARING ROUTES
  // ============================================

  // Object Storage Routes for Community Image Uploads
  app.post('/api/objects/upload', authenticateToken, async (req: any, res) => {
    try {
      console.log('📤 [API] Upload URL request from user:', req.user?.id);
      console.log('📤 [API] Request body:', JSON.stringify(req.body, null, 2));
      console.log('📤 [API] Request headers:', JSON.stringify(req.headers, null, 2));

      const { fileName, contentType } = req.body;

      if (!fileName || !contentType) {
        return res.status(400).json({
          error: 'Missing fileName or contentType',
          hint: 'Send { fileName: "file.jpg", contentType: "image/jpeg" }'
        });
      }

      // Check GCS configuration
      const hasGCSConfig = !!(process.env.GOOGLE_SERVICE_ACCOUNT_JSON && process.env.GCS_PROJECT_ID);
      if (!hasGCSConfig) {
        console.error('❌ [API] GCS not configured');
        return res.status(500).json({
          error: 'Upload service not configured',
          details: 'Google Cloud Storage credentials missing'
        });
      }

      const { objectStorageClient } = await import('./objectStorage');
      const bucketName = 'healthymamabucket';
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(`uploads/${fileName}`);

      // Generate v4 signed URL with exact content-type matching
      const options = {
        version: 'v4' as const,
        action: 'write' as const,
        expires: Date.now() + 15 * 60 * 1000, // 15 minutes
        contentType: contentType,
      };

      const [url] = await file.getSignedUrl(options);

      console.log('✅ [API] Upload URL generated successfully for:', fileName);
      res.json({ url });
    } catch (error: any) {
      console.error('❌ [API] Error getting upload URL:', error);

      const errorResponse = {
        error: 'Failed to get upload URL',
        details: error?.message || String(error),
        timestamp: new Date().toISOString()
      };

      if (app.get('env') === 'development') {
        errorResponse.hint = 'Check GCS credentials and bucket configuration. Ensure PRIVATE_OBJECT_DIR points to a valid bucket path.';
        errorResponse.stack = error?.stack;
      }

      res.status(500).json(errorResponse);
    }
  });

  // Generate download URL for uploaded objects
  app.post('/api/objects/download-url', authenticateToken, async (req: any, res) => {
    try {
      console.log('📥 [API] Download URL request from user:', req.user?.id);
      console.log('📥 [API] Request body:', JSON.stringify(req.body, null, 2));

      const { fileName } = req.body;

      if (!fileName) {
        return res.status(400).json({
          error: 'Missing fileName',
          hint: 'Send { fileName: "file.jpg" }'
        });
      }

      // Check GCS configuration
      const hasGCSConfig = !!(process.env.GOOGLE_SERVICE_ACCOUNT_JSON && process.env.GCS_PROJECT_ID);
      if (!hasGCSConfig) {
        console.error('❌ [API] GCS not configured for download');
        return res.status(500).json({
          error: 'Download service not configured',
          details: 'Google Cloud Storage credentials missing'
        });
      }

      const { objectStorageClient } = await import('./objectStorage');
      const bucketName = 'healthymamabucket';
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(`uploads/${fileName}`);

      // Check if file exists
      const [exists] = await file.exists();
      if (!exists) {
        console.log('❌ [API] File not found in GCS:', fileName);
        return res.status(404).json({
          error: 'File not found',
          details: `File ${fileName} does not exist in storage`
        });
      }

      // Generate v4 signed URL for reading (24 hour expiry for preview)
      const options = {
        version: 'v4' as const,
        action: 'read' as const,
        expires: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      };

      const [downloadUrl] = await file.getSignedUrl(options);

      console.log('✅ [API] Download URL generated successfully for:', fileName);
      res.json({ downloadUrl });
    } catch (error: any) {
      console.error('❌ [API] Error getting download URL:', error);

      const errorResponse = {
        error: 'Failed to get download URL',
        details: error?.message || String(error),
        timestamp: new Date().toISOString()
      };

      if (app.get('env') === 'development') {
        errorResponse.hint = 'Check if file exists in GCS bucket and credentials are valid.';
        errorResponse.stack = error?.stack;
      }

      res.status(500).json(errorResponse);
    }
  });

  // Test endpoint to verify GCS permissions (no auth for debugging)
  app.get('/api/objects/test-permissions', async (req: any, res) => {
    try {
      console.log('🧪 [TEST] Testing GCS bucket permissions');

      const { objectStorageClient } = await import('./objectStorage');
      const bucket = objectStorageClient.bucket('healthymamabucket');

      // Test 1: Check if bucket exists and is accessible
      const [exists] = await bucket.exists();
      console.log('🧪 [TEST] Bucket exists:', exists);

      if (!exists) {
        return res.json({
          success: false,
          error: 'Bucket does not exist or is not accessible',
          tests: { bucketExists: false }
        });
      }

      // Test 2: Try to get bucket metadata (requires storage.buckets.get permission)
      try {
        const [metadata] = await bucket.getMetadata();
        console.log('🧪 [TEST] Bucket metadata access: SUCCESS');
      } catch (metadataError: any) {
        console.log('🧪 [TEST] Bucket metadata access: FAILED', metadataError?.message);
      }

      // Test 3: Try to create a test file (requires storage.objects.create permission)
      const testFile = bucket.file('test-permissions.txt');
      try {
        await testFile.save('Test file for permissions check');
        console.log('🧪 [TEST] File creation: SUCCESS');

        // Clean up test file
        await testFile.delete();
        console.log('🧪 [TEST] File deletion: SUCCESS');

        res.json({
          success: true,
          message: 'All permissions are working correctly',
          tests: {
            bucketExists: true,
            canCreateFiles: true,
            canDeleteFiles: true
          }
        });
      } catch (createError: any) {
        console.log('🧪 [TEST] File creation: FAILED', createError?.message);
        res.json({
          success: false,
          error: 'Cannot create files in bucket - check storage.objects.create permission',
          details: createError?.message || 'Unknown error',
          tests: {
            bucketExists: true,
            canCreateFiles: false
          }
        });
      }

    } catch (error: any) {
      console.error('❌ [TEST] GCS permissions test failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to test GCS permissions',
        details: error?.message || 'Unknown error'
      });
    }
  });

  app.get('/objects/:objectPath(*)', async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error('Error serving object:', error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // Get all communities
  app.get("/api/communities", authenticateToken, async (req: any, res) => {
    try {
      const category = req.query.category as string | undefined;
      const userId = req.user?.id;
      
      const communities = await communityService.getCommunities(category, userId);
      res.json(communities);
    } catch (error) {
      console.error("Error fetching communities:", error);
      res.status(500).json({ message: "Failed to fetch communities" });
    }
  });

  // Get user's communities (for sharing modal) - MUST come before /:id route
  app.get("/api/communities/my-communities", authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // Get communities where user is a member
      const userCommunities = await db.select({
        id: communities.id,
        name: communities.name,
        description: communities.description,
        member_count: communities.member_count,
        cover_image: communities.cover_image,
      })
      .from(communities)
      .innerJoin(communityMembers, eq(communityMembers.community_id, communities.id))
      .where(eq(communityMembers.user_id, userId));

      res.json(userCommunities);
    } catch (error) {
      console.error("Error fetching user communities:", error);
      res.status(500).json({ message: "Failed to fetch user communities" });
    }
  });

  // Get community details
  app.get("/api/communities/:id", authenticateToken, async (req: any, res) => {
    try {
      const communityId = Number(req.params.id);
      const userId = req.user?.id;
      
      // Check if communityId is a valid number
      if (isNaN(communityId)) {
        return res.status(400).json({ message: "Invalid community ID" });
      }
      
      const community = await communityService.getCommunityDetails(communityId, userId);
      res.json(community);
    } catch (error) {
      console.error("Error fetching community details:", error);
      res.status(500).json({ message: "Failed to fetch community details" });
    }
  });

  // Get community stats for management dashboard
  app.get("/api/communities/:id/stats", authenticateToken, async (req: any, res) => {
    try {
      const communityId = Number(req.params.id);
      const userId = req.user?.id;
      
      // For now, return placeholder stats - can be enhanced later with real data
      const stats = {
        newMembersThisWeek: 0,
        engagementRate: 85,
        activeToday: 0,
        totalPosts: 0,
        totalComments: 0
      };
      
      res.json(stats);
    } catch (error) {
      console.error("Error fetching community stats:", error);
      res.status(500).json({ message: "Failed to fetch community stats" });
    }
  });

  // Create a new community
  app.post("/api/communities", authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const { name, description, category, cover_image } = req.body;

      if (!name || !description || !category) {
        return res.status(400).json({ message: "Name, description, and category are required" });
      }

      const community = await communityService.createCommunity(userId, {
        name,
        description,
        category,
        cover_image,
      });

      res.json(community);
    } catch (error) {
      console.error("Error creating community:", error);
      res.status(500).json({ message: "Failed to create community" });
    }
  });

  // Update a community (creator only)
  app.put("/api/communities/:id", authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const communityId = Number(req.params.id);

      // Verify the requester is the creator
      const [community] = await db.select()
        .from(communities)
        .where(eq(communities.id, communityId));

      if (!community) {
        return res.status(404).json({ message: "Community not found" });
      }

      if (community.creator_id !== userId) {
        return res.status(403).json({ message: "Only the creator can update this community" });
      }

      const { name, description, category, cover_image, is_public, settings } = req.body || {};

      const [updated] = await db.update(communities)
        .set({
          name: name ?? community.name,
          description: description ?? community.description,
          category: category ?? community.category,
          cover_image: cover_image ?? community.cover_image,
          is_public: typeof is_public === 'boolean' ? is_public : community.is_public,
          settings: settings ?? community.settings,
          updated_at: new Date(),
        })
        .where(eq(communities.id, communityId))
        .returning();

      res.json(updated);
    } catch (error) {
      console.error("Error updating community:", error);
      res.status(500).json({ message: "Failed to update community" });
    }
  });

  // Join a community
  app.post("/api/communities/:id/join", authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const communityId = Number(req.params.id);
      const member = await communityService.joinCommunity(userId, communityId);
      res.json(member);
    } catch (error: any) {
      console.error("Error joining community:", error);
      if (error.message === "Already a member of this community") {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to join community" });
    }
  });

  // Leave a community
  app.post("/api/communities/:id/leave", authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const communityId = Number(req.params.id);
      await communityService.leaveCommunity(userId, communityId);
      res.json({ message: "Successfully left community" });
    } catch (error: any) {
      console.error("Error leaving community:", error);
      if (error.message === "Creator cannot leave their own community") {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to leave community" });
    }
  });

  // ============================================
  // COMMUNITY POSTS API ROUTES
  // ============================================

  // Get community posts
  app.get("/api/communities/:id/posts", authenticateToken, async (req: any, res) => {
    try {
      const communityId = Number(req.params.id);
      const userId = req.user?.id;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;
      const type = req.query.type as string;

      const posts = await communityService.getCommunityPosts(communityId, {
        limit,
        offset,
        type,
        userId,
      });

      res.json(posts);
    } catch (error) {
      console.error("Error fetching community posts:", error);
      res.status(500).json({ message: "Failed to fetch community posts" });
    }
  });

  // Create a new community post
  app.post("/api/communities/:id/posts", authenticateToken, async (req: any, res) => {
    try {
      const communityId = Number(req.params.id);
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const { content, post_type = "discussion", meal_plan_id, images } = req.body;

      if (!content || content.trim().length === 0) {
        return res.status(400).json({ message: "Post content is required" });
      }

      if (content.length > 5000) {
        return res.status(400).json({ message: "Post content is too long (max 5000 characters)" });
      }

      const post = await communityService.createCommunityPost(userId, communityId, {
        content: content.trim(),
        post_type,
        meal_plan_id,
        images: images && Array.isArray(images) && images.length > 0 ? images : null,
      });

      res.json(post);
    } catch (error: any) {
      console.error("Error creating community post:", error);
      if (error.message === "You must be a member to perform this action") {
        return res.status(403).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to create community post" });
    }
  });

  // Delete a community post (creator only)
  app.delete("/api/communities/:id/posts/:postId", authenticateToken, async (req: any, res) => {
    try {
      const communityId = Number(req.params.id);
      const postId = Number(req.params.postId);
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // Check if user is a creator of the community
      const community = await communityService.getCommunityById(communityId);
      if (!community) {
        return res.status(404).json({ message: "Community not found" });
      }

      if (community.creator_id !== userId) {
        return res.status(403).json({ message: "Only creators can delete posts" });
      }

      // Delete the post
      const result = await communityService.deletePost(postId, communityId);
      
      if (!result) {
        return res.status(404).json({ message: "Post not found" });
      }

      res.json({ message: "Post deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting community post:", error);
      res.status(500).json({ message: "Failed to delete community post" });
    }
  });

  // Toggle like on a community post
  app.post("/api/communities/:communityId/posts/:postId/like", authenticateToken, async (req: any, res) => {
    try {
      const communityId = Number(req.params.communityId);
      const postId = Number(req.params.postId);
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const result = await communityService.togglePostLike(userId, postId, communityId);
      res.json(result);
    } catch (error: any) {
      console.error("Error toggling post like:", error);
      if (error.message === "Post not found" || error.message === "Not a member of this community") {
        return res.status(404).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to toggle post like" });
    }
  });

  // Toggle like on a community comment
  app.post("/api/communities/:communityId/posts/:postId/comments/:commentId/like", authenticateToken, async (req: any, res) => {
    try {
      const commentId = Number(req.params.commentId);
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const result = await communityService.toggleCommentLike(userId, commentId);
      res.json(result);
    } catch (error: any) {
      console.error("Error toggling comment like:", error);
      if (error.message === "Comment not found" || error.message === "Post not found" || error.message === "You must be a member to perform this action") {
        return res.status(404).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to toggle comment like" });
    }
  });

  // Share a meal plan to community
  app.post("/api/communities/:id/share-meal-plan", authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const communityId = Number(req.params.id);
      const { meal_plan_id, title, description } = req.body;

      if (!meal_plan_id || !title) {
        return res.status(400).json({ message: "meal_plan_id and title are required" });
      }

      const sharedPlan = await mealPlanSharingService.shareMealPlan(
        userId,
        communityId,
        meal_plan_id,
        title,
        description
      );

      res.json(sharedPlan);
    } catch (error) {
      console.error("Error sharing meal plan:", error);
      res.status(500).json({ message: "Failed to share meal plan" });
    }
  });

  // Get community meal plans
  app.get("/api/communities/:id/meal-plans", authenticateToken, async (req: any, res) => {
    try {
      const communityId = Number(req.params.id);
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // Check if user is a member of the community
      const membership = await communityService.getUserMembership(userId, communityId);
      if (!membership) {
        return res.status(403).json({ message: "You must be a member to view meal plans" });
      }

      const mealPlans = await communityService.getCommunityMealPlans(communityId);
      res.json(mealPlans);
    } catch (error) {
      console.error("Error fetching community meal plans:", error);
      res.status(500).json({ message: "Failed to fetch meal plans" });
    }
  });

  // Create community meal plan (creators only)
  app.post("/api/communities/:id/meal-plans", authenticateToken, async (req: any, res) => {
    try {
      const communityId = Number(req.params.id);
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // Check if user is creator of the community
      const community = await communityService.getCommunityDetails(communityId, userId);
      if (!community || community.creator_id !== userId) {
        return res.status(403).json({ message: "Only creators can add meal plans" });
      }

      const { 
        title, 
        description, 
        image_url, 
        youtube_video_id,
        ingredients, 
        instructions, 
        prep_time, 
        cook_time, 
        servings 
      } = req.body;

      if (!title || !ingredients || !instructions) {
        return res.status(400).json({ message: "Title, ingredients, and instructions are required" });
      }

      const mealPlan = await communityService.createCommunityMealPlan(userId, communityId, {
        title,
        description,
        image_url,
        youtube_video_id,
        ingredients,
        instructions,
        prep_time,
        cook_time,
        servings,
      });

      res.json(mealPlan);
    } catch (error) {
      console.error("Error creating community meal plan:", error);
      res.status(500).json({ message: "Failed to create meal plan" });
    }
  });

  // ============================================
  // COMMUNITY COMMENTS API ROUTES
  // ============================================

  // Get comments for a specific post
  app.get("/api/communities/:id/posts/:postId/comments", authenticateToken, async (req: any, res) => {
    try {
      const postId = Number(req.params.postId);
      const nested = req.query.nested === 'true';
      const userId = req.user?.id; // Get current user ID for like status

      if (nested) {
        const comments = await communityCommentsService.getNestedComments(postId, userId);
        res.json(comments);
      } else {
        // Use the communityService method that includes like status
        const comments = await communityService.getPostComments(postId, userId);
        res.json(comments);
      }
    } catch (error) {
      console.error("Error fetching comments:", error);
      res.status(500).json({ message: "Failed to fetch comments" });
    }
  });

  // Create a new comment
  app.post("/api/communities/:id/posts/:postId/comments", authenticateToken, async (req: any, res) => {
    try {
      const postId = Number(req.params.postId);
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const { content, parent_id, images } = req.body;

      if (!content || content.trim().length === 0) {
        return res.status(400).json({ message: "Comment content is required" });
      }

      if (content.length > 2000) {
        return res.status(400).json({ message: "Comment is too long (max 2000 characters)" });
      }

      const comment = await communityCommentsService.createComment({
        post_id: postId,
        author_id: userId,
        content: content.trim(),
        parent_id: parent_id || null,
        images: images && Array.isArray(images) && images.length > 0 ? images : null,
      });

      res.json(comment);
    } catch (error) {
      console.error("Error creating comment:", error);
      res.status(500).json({ message: "Failed to create comment" });
    }
  });

  // Update a comment
  app.put("/api/communities/:id/posts/:postId/comments/:commentId", authenticateToken, async (req: any, res) => {
    try {
      const commentId = Number(req.params.commentId);
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const { content, images } = req.body;

      if (!content || content.trim().length === 0) {
        return res.status(400).json({ message: "Comment content is required" });
      }

      if (content.length > 2000) {
        return res.status(400).json({ message: "Comment is too long (max 2000 characters)" });
      }

      const comment = await communityCommentsService.updateComment(commentId, userId, {
        content: content.trim(),
        images: images && Array.isArray(images) && images.length > 0 ? images : null,
      });

      if (!comment) {
        return res.status(404).json({ message: "Comment not found" });
      }

      res.json(comment);
    } catch (error) {
      console.error("Error updating comment:", error);
      res.status(500).json({ message: "Failed to update comment" });
    }
  });

  // Delete a comment
  app.delete("/api/communities/:id/posts/:postId/comments/:commentId", authenticateToken, async (req: any, res) => {
    try {
      const commentId = Number(req.params.commentId);
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const success = await communityCommentsService.deleteComment(commentId, userId);

      if (!success) {
        return res.status(404).json({ message: "Comment not found" });
      }

      res.json({ message: "Comment deleted successfully" });
    } catch (error) {
      console.error("Error deleting comment:", error);
      res.status(500).json({ message: "Failed to delete comment" });
    }
  });

  // Get community meal plans
  app.get("/api/communities/:id/meal-plans", async (req: any, res) => {
    try {
      const communityId = Number(req.params.id);
      const { featured, tags } = req.query;

      const filter: any = {};
      if (featured === 'true') filter.featured = true;
      if (tags) filter.tags = tags.split(',');

      const plans = await communityService.getCommunityMealPlans(communityId, filter);
      res.json(plans);
    } catch (error) {
      console.error("Error fetching community meal plans:", error);
      res.status(500).json({ message: "Failed to fetch community meal plans" });
    }
  });

  // Get trending meal plans
  app.get("/api/trending-meal-plans", async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const trending = await mealPlanSharingService.getTrendingMealPlans(limit);
      res.json(trending);
    } catch (error) {
      console.error("Error fetching trending meal plans:", error);
      res.status(500).json({ message: "Failed to fetch trending meal plans" });
    }
  });

  // Get recommended meal plans
  app.get("/api/recommended-meal-plans", authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const limit = parseInt(req.query.limit as string) || 10;
      const recommendations = await mealPlanSharingService.getRecommendedMealPlans(userId, limit);
      res.json(recommendations);
    } catch (error) {
      console.error("Error fetching recommended meal plans:", error);
      res.status(500).json({ message: "Failed to fetch recommended meal plans" });
    }
  });

  // Review a shared meal plan
  app.post("/api/meal-plans/:id/review", authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const sharedPlanId = Number(req.params.id);
      const { rating, comment, tried_it, modifications, images } = req.body;

      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ message: "Rating must be between 1 and 5" });
      }

      const review = await communityService.reviewMealPlan(userId, sharedPlanId, {
        rating,
        comment,
        tried_it,
        modifications,
        images,
      });

      res.json(review);
    } catch (error: any) {
      console.error("Error reviewing meal plan:", error);
      if (error.message === "You have already reviewed this meal plan") {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to review meal plan" });
    }
  });

  // Mark meal plan as tried
  app.post("/api/meal-plans/:id/try", authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const sharedPlanId = Number(req.params.id);
      await communityService.markPlanAsTried(userId, sharedPlanId);
      res.json({ message: "Marked as tried successfully" });
    } catch (error) {
      console.error("Error marking meal plan as tried:", error);
      res.status(500).json({ message: "Failed to mark meal plan as tried" });
    }
  });

  // Like a meal plan
  app.post("/api/meal-plans/:id/like", authenticateToken, async (req: any, res) => {
    try {
      const sharedPlanId = Number(req.params.id);
      await mealPlanSharingService.likeMealPlan(sharedPlanId);
      res.json({ message: "Liked successfully" });
    } catch (error) {
      console.error("Error liking meal plan:", error);
      res.status(500).json({ message: "Failed to like meal plan" });
    }
  });

  // Search meal plans
  app.get("/api/search-meal-plans", async (req: any, res) => {
    try {
      const { q, tags, maxCost, maxTime, minRating } = req.query;

      const filters: any = {};
      if (tags) filters.tags = tags.split(',');
      if (maxCost) filters.maxCost = parseFloat(maxCost);
      if (maxTime) filters.maxTime = parseInt(maxTime);
      if (minRating) filters.minRating = parseInt(minRating);

      const results = await mealPlanSharingService.searchMealPlans(q || '', filters);
      res.json(results);
    } catch (error) {
      console.error("Error searching meal plans:", error);
      res.status(500).json({ message: "Failed to search meal plans" });
    }
  });

  // ============================================
  // CREATOR ROUTES
  // ============================================

  // Get top creators - MUST BE BEFORE /:id route
  app.get("/api/creators/top", async (req: any, res) => {
    console.log("🚀 TOP CREATORS ENDPOINT HIT - DEBUG!");
    try {
      console.log(`🔍 [DEBUG] /api/creators/top called with query:`, req.query);
      const metric = (req.query.metric as 'followers' | 'plans' | 'rating') || 'followers';
      const limit = parseInt(req.query.limit as string) || 10;
      
      console.log(`📊 [DEBUG] About to call getTopCreators with metric: ${metric}, limit: ${limit}`);
      const creators = await creatorService.getTopCreators(metric, limit);
      console.log(`✅ [DEBUG] getTopCreators returned ${creators?.length || 0} creators`);
      res.json(creators);
    } catch (error) {
      console.error("❌ [DEBUG] Error fetching top creators:", error);
      res.status(500).json({ message: "Failed to fetch top creators" });
    }
  });

  // Get or create creator profile
  app.get("/api/creators/:id", async (req: any, res) => {
    try {
      const creatorId = req.params.id;
      const viewerId = req.user?.id;
      
      const profile = await creatorService.getCreatorProfile(creatorId, viewerId);
      
      if (!profile) {
        return res.status(404).json({ message: "Creator profile not found" });
      }
      
      res.json(profile);
    } catch (error) {
      console.error("Error fetching creator profile:", error);
      res.status(500).json({ message: "Failed to fetch creator profile" });
    }
  });

  // Update creator profile
  app.put("/api/creators/profile", authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const { bio, specialties, certifications, social_links } = req.body;

      const profile = await creatorService.upsertCreatorProfile(userId, {
        bio,
        specialties,
        certifications,
        social_links,
      });

      res.json(profile);
    } catch (error) {
      console.error("Error updating creator profile:", error);
      res.status(500).json({ message: "Failed to update creator profile" });
    }
  });

  // Follow a creator
  app.post("/api/creators/:id/follow", authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const creatorId = req.params.id;
      const follow = await creatorService.followCreator(userId, creatorId);
      res.json(follow);
    } catch (error: any) {
      console.error("Error following creator:", error);
      if (error.message === "Already following this creator") {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to follow creator" });
    }
  });

  // Unfollow a creator
  app.post("/api/creators/:id/unfollow", authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const creatorId = req.params.id;
      await creatorService.unfollowCreator(userId, creatorId);
      res.json({ message: "Unfollowed successfully" });
    } catch (error: any) {
      console.error("Error unfollowing creator:", error);
      res.status(500).json({ message: "Failed to unfollow creator" });
    }
  });

  // Get followed creators
  app.get("/api/creators/following", authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const creators = await creatorService.getFollowedCreators(userId);
      res.json(creators);
    } catch (error) {
      console.error("Error fetching followed creators:", error);
      res.status(500).json({ message: "Failed to fetch followed creators" });
    }
  });

  // Get meal plans from followed creators
  app.get("/api/creators/following/meal-plans", authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const limit = parseInt(req.query.limit as string) || 20;
      const plans = await creatorService.getFollowedCreatorsMealPlans(userId, limit);
      res.json(plans);
    } catch (error) {
      console.error("Error fetching followed creators meal plans:", error);
      res.status(500).json({ message: "Failed to fetch followed creators meal plans" });
    }
  });



  // Get creator's meal plans
  app.get("/api/creators/:id/meal-plans", async (req: any, res) => {
    try {
      const creatorId = req.params.id;
      const limit = parseInt(req.query.limit as string) || 20;
      
      const plans = await mealPlanSharingService.getCreatorMealPlans(creatorId, limit);
      res.json(plans);
    } catch (error) {
      console.error("Error fetching creator meal plans:", error);
      res.status(500).json({ message: "Failed to fetch creator meal plans" });
    }
  });

  // Get creator stats
  app.get("/api/creator/stats", authenticateToken, async (req: any, res) => {
    try {
      console.log(`🔍 [DEBUG] /api/creator/stats called for user:`, req.user?.id);
      const userId = req.user?.id;
      if (!userId) {
        console.log(`❌ [DEBUG] No user ID found in request`);
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      // Get follower count
      const followers = await db.select()
        .from(creatorFollowers)
        .where(eq(creatorFollowers.creator_id, userId));
      
      // Get communities
      const userCommunities = await db.select()
        .from(communities)
        .where(eq(communities.creator_id, userId));
      
      // Get shared meal plans
      const sharedPlans = await db.select()
        .from(sharedMealPlans)
        .where(eq(sharedMealPlans.sharer_id, userId));
      
      // Calculate engagement and earnings (mock data for now)
      const stats = {
        totalFollowers: followers.length,
        totalCommunities: userCommunities.length,
        totalSharedPlans: sharedPlans.length,
        totalEarnings: 0, // Will implement with Stripe
        engagementRate: 78, // Mock percentage
        averageRating: 4.5, // Mock rating
        thisMonthGrowth: 12, // Mock growth percentage
        activeMemberships: 0, // Will implement with membership system
      };
      
      res.json(stats);
    } catch (error) {
      console.error("Error fetching creator stats:", error);
      res.status(500).json({ message: "Failed to fetch creator stats" });
    }
  });

  // ==================== COMMUNITY MEAL COURSES (CREATOR ONLY) ====================
  
  // Get all courses for a community
  app.get("/api/communities/:id/courses", authenticateToken, async (req: any, res) => {
    try {
      const communityId = Number(req.params.id);
      const userId = req.user?.id;
      
      console.log(`[COURSES API] Fetching courses for community ${communityId}, user: ${userId}`);
      
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // Get courses with modules and lessons
      const courses = await db.select()
        .from(communityMealCourses)
        .where(eq(communityMealCourses.community_id, communityId))
        .orderBy(communityMealCourses.display_order);
      
      console.log(`[COURSES API] Found ${courses.length} courses`);
      
      // If no courses exist and user is creator, create default courses
      if (courses.length === 0) {
        // Check if user is creator of this community
        const [member] = await db.select()
          .from(communityMembers)
          .where(and(
            eq(communityMembers.community_id, communityId),
            eq(communityMembers.user_id, userId),
            eq(communityMembers.role, "creator")
          ));
        
        if (member) {
          console.log(`[COURSES API] Creator detected, creating default courses`);
          
          // Create default courses
          const defaultCourses = [
            {
              community_id: communityId,
              creator_id: userId,
              title: "Start Here",
              emoji: "🌟",
              description: "Essential information to get started with our meal planning community",
              category: "beginner",
              is_published: true,
              display_order: 0,
              lesson_count: 4,
            },
            {
              community_id: communityId,
              creator_id: userId,
              title: "30-Day Meal Transformation",
              emoji: "🔥",
              description: "Transform your eating habits with our comprehensive 30-day program",
              category: "intermediate",
              is_published: true,
              display_order: 1,
              lesson_count: 5,
            },
            {
              community_id: communityId,
              creator_id: userId,
              title: "Budget Nutrition Secrets",
              emoji: "💰",
              description: "Learn how to eat healthy on a budget with smart shopping strategies",
              category: "beginner",
              is_published: true,
              display_order: 2,
              lesson_count: 4,
            },
            {
              community_id: communityId,
              creator_id: userId,
              title: "Recipe Vault",
              emoji: "📚",
              description: "Access our collection of quick, healthy, and delicious recipes",
              category: "beginner",
              is_published: true,
              display_order: 3,
              lesson_count: 4,
            },
          ];
          
          const insertedCourses = await db.insert(communityMealCourses)
            .values(defaultCourses)
            .returning();
          
          console.log(`[COURSES API] Created ${insertedCourses.length} default courses`);
          
          // Return the newly created courses
          const newCourses = await db.select()
            .from(communityMealCourses)
            .where(eq(communityMealCourses.community_id, communityId))
            .orderBy(communityMealCourses.display_order);
          
          return res.json(newCourses);
        }
      }

      // Get modules for each course
      const coursesWithModules = await Promise.all(
        courses.map(async (course) => {
          const modules = await db.select()
            .from(communityMealCourseModules)
            .where(eq(communityMealCourseModules.course_id, course.id))
            .orderBy(communityMealCourseModules.module_order);

          // Get lessons for each module
          const modulesWithLessons = await Promise.all(
            modules.map(async (module) => {
              const lessons = await db.select()
                .from(communityMealLessons)
                .where(eq(communityMealLessons.module_id, module.id))
                .orderBy(communityMealLessons.lesson_order);
              return { ...module, lessons };
            })
          );

          // Also get lessons without modules
          const standaloneLessons = await db.select()
            .from(communityMealLessons)
            .where(and(
              eq(communityMealLessons.course_id, course.id),
              isNull(communityMealLessons.module_id)
            ))
            .orderBy(communityMealLessons.lesson_order);

          return { ...course, modules: modulesWithLessons, lessons: standaloneLessons };
        })
      );

      // If still no courses after all processing, return empty array
      res.json(coursesWithModules || []);
    } catch (error) {
      console.error("[COURSES API] Error fetching courses:", error);
      res.status(500).json({ message: "Failed to fetch courses", error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Create a new course (creator only)
  app.post("/api/communities/:id/courses", authenticateToken, async (req: any, res) => {
    try {
      const communityId = Number(req.params.id);
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // Verify user is creator of the community
      const [member] = await db.select()
        .from(communityMembers)
        .where(and(
          eq(communityMembers.community_id, communityId),
          eq(communityMembers.user_id, userId),
          eq(communityMembers.role, "creator")
        ));

      if (!member) {
        return res.status(403).json({ message: "Only creators can create courses" });
      }

      const courseData: InsertCommunityMealCourse = {
        community_id: communityId,
        creator_id: userId,
        title: req.body.title,
        emoji: req.body.emoji,
        description: req.body.description,
        category: req.body.category,
        cover_image: req.body.cover_image || null,
        is_published: false,
        display_order: req.body.display_order || 0,
        drip_enabled: req.body.drip_enabled || false,
        drip_days: req.body.drip_days || [],
      };

      const [newCourse] = await db.insert(communityMealCourses)
        .values(courseData)
        .returning();

      res.json(newCourse);
    } catch (error) {
      console.error("Error creating course:", error);
      res.status(500).json({ message: "Failed to create course" });
    }
  });

  // Update a course (creator only)
  app.put("/api/communities/:id/courses/:courseId", authenticateToken, async (req: any, res) => {
    try {
      const communityId = Number(req.params.id);
      const courseId = Number(req.params.courseId);
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // Verify user is creator
      const [course] = await db.select()
        .from(communityMealCourses)
        .where(and(
          eq(communityMealCourses.id, courseId),
          eq(communityMealCourses.creator_id, userId)
        ));

      if (!course) {
        return res.status(403).json({ message: "Only the creator can update this course" });
      }

      const [updatedCourse] = await db.update(communityMealCourses)
        .set({
          title: req.body.title || course.title,
          emoji: req.body.emoji || course.emoji,
          description: req.body.description || course.description,
          category: req.body.category || course.category,
          is_published: req.body.is_published ?? course.is_published,
          display_order: req.body.display_order ?? course.display_order,
          drip_enabled: req.body.drip_enabled ?? course.drip_enabled,
          drip_days: req.body.drip_days || course.drip_days,
          updated_at: new Date(),
        })
        .where(eq(communityMealCourses.id, courseId))
        .returning();

      res.json(updatedCourse);
    } catch (error) {
      console.error("Error updating course:", error);
      res.status(500).json({ message: "Failed to update course" });
    }
  });

  // Delete a course (creator only)
  app.delete("/api/communities/:id/courses/:courseId", authenticateToken, async (req: any, res) => {
    try {
      const courseId = Number(req.params.courseId);
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // Verify user is creator
      const [course] = await db.select()
        .from(communityMealCourses)
        .where(and(
          eq(communityMealCourses.id, courseId),
          eq(communityMealCourses.creator_id, userId)
        ));

      if (!course) {
        return res.status(403).json({ message: "Only the creator can delete this course" });
      }

      await db.delete(communityMealCourses)
        .where(eq(communityMealCourses.id, courseId));

      res.json({ message: "Course deleted successfully" });
    } catch (error) {
      console.error("Error deleting course:", error);
      res.status(500).json({ message: "Failed to delete course" });
    }
  });

  // ==================== MODULE ENDPOINTS ====================

  // Create a module for a course (creator only)
  app.post("/api/communities/:id/courses/:courseId/modules", authenticateToken, async (req: any, res) => {
    try {
      const courseId = Number(req.params.courseId);
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // Verify user is creator of the course
      const [course] = await db.select()
        .from(communityMealCourses)
        .where(and(
          eq(communityMealCourses.id, courseId),
          eq(communityMealCourses.creator_id, userId)
        ));

      if (!course) {
        return res.status(403).json({ message: "Only the creator can add modules to this course" });
      }

      // Get the next module order
      const modules = await db.select()
        .from(communityMealCourseModules)
        .where(eq(communityMealCourseModules.course_id, courseId))
        .orderBy(desc(communityMealCourseModules.module_order));
      
      const nextOrder = modules.length > 0 ? modules[0].module_order + 1 : 0;

      const moduleData = {
        course_id: courseId,
        title: req.body.title || "New Module",
        emoji: req.body.emoji || "📁",
        description: req.body.description || "",
        cover_image: req.body.cover_image || null,
        module_order: req.body.module_order ?? nextOrder,
        is_expanded: req.body.is_expanded ?? false,
      };

      const [newModule] = await db.insert(communityMealCourseModules)
        .values(moduleData)
        .returning();

      res.json(newModule);
    } catch (error) {
      console.error("Error creating module:", error);
      res.status(500).json({ message: "Failed to create module" });
    }
  });

  // Update a module (creator only)
  app.put("/api/communities/:id/courses/:courseId/modules/:moduleId", authenticateToken, async (req: any, res) => {
    try {
      const courseId = Number(req.params.courseId);
      const moduleId = Number(req.params.moduleId);
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // Verify user is creator of the course
      const [course] = await db.select()
        .from(communityMealCourses)
        .where(and(
          eq(communityMealCourses.id, courseId),
          eq(communityMealCourses.creator_id, userId)
        ));

      if (!course) {
        return res.status(403).json({ message: "Only the creator can update modules in this course" });
      }

      const [updatedModule] = await db.update(communityMealCourseModules)
        .set({
          title: req.body.title,
          emoji: req.body.emoji,
          description: req.body.description,
          module_order: req.body.module_order,
          is_expanded: req.body.is_expanded,
          updated_at: new Date(),
        })
        .where(eq(communityMealCourseModules.id, moduleId))
        .returning();

      res.json(updatedModule);
    } catch (error) {
      console.error("Error updating module:", error);
      res.status(500).json({ message: "Failed to update module" });
    }
  });

  // Delete a module (creator only)
  app.delete("/api/communities/:id/courses/:courseId/modules/:moduleId", authenticateToken, async (req: any, res) => {
    try {
      const courseId = Number(req.params.courseId);
      const moduleId = Number(req.params.moduleId);
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // Verify user is creator of the course
      const [course] = await db.select()
        .from(communityMealCourses)
        .where(and(
          eq(communityMealCourses.id, courseId),
          eq(communityMealCourses.creator_id, userId)
        ));

      if (!course) {
        return res.status(403).json({ message: "Only the creator can delete modules from this course" });
      }

      // Move lessons in this module to standalone (null module_id)
      await db.update(communityMealLessons)
        .set({ module_id: null })
        .where(eq(communityMealLessons.module_id, moduleId));

      // Delete the module
      await db.delete(communityMealCourseModules)
        .where(eq(communityMealCourseModules.id, moduleId));

      res.json({ message: "Module deleted successfully" });
    } catch (error) {
      console.error("Error deleting module:", error);
      res.status(500).json({ message: "Failed to delete module" });
    }
  });

  // Create a lesson (creator only)
  app.post("/api/communities/:id/courses/:courseId/lessons", authenticateToken, async (req: any, res) => {
    try {
      const courseId = Number(req.params.courseId);
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // Verify user is creator of the course
      const [course] = await db.select()
        .from(communityMealCourses)
        .where(and(
          eq(communityMealCourses.id, courseId),
          eq(communityMealCourses.creator_id, userId)
        ));

      if (!course) {
        return res.status(403).json({ message: "Only the creator can add lessons to this course" });
      }

      const lessonData: InsertCommunityMealLesson = {
        course_id: courseId,
        module_id: req.body.module_id,
        title: req.body.title,
        emoji: req.body.emoji,
        description: req.body.description,
        video_url: req.body.video_url,
        youtube_video_id: req.body.youtube_video_id,
        image_url: req.body.image_url,
        ingredients: req.body.ingredients || [],
        instructions: req.body.instructions || [],
        prep_time: req.body.prep_time || 0,
        cook_time: req.body.cook_time || 0,
        servings: req.body.servings || 4,
        difficulty_level: req.body.difficulty_level || 1,
        nutrition_info: req.body.nutrition_info || {},
        lesson_order: req.body.lesson_order || 0,
        is_published: false,
      };

      const [newLesson] = await db.insert(communityMealLessons)
        .values(lessonData)
        .returning();

      // Create default sections if provided
      if (req.body.sections && Array.isArray(req.body.sections)) {
        const sections = req.body.sections.map((section: any, index: number) => ({
          lesson_id: newLesson.id,
          section_type: section.section_type,
          title: section.title,
          content: section.content,
          template_id: section.template_id,
          display_order: section.display_order ?? index,
          is_visible: section.is_visible ?? true,
        }));

        await db.insert(communityMealLessonSections).values(sections);
      }

      // Update course lesson count
      await db.update(communityMealCourses)
        .set({ 
          lesson_count: course.lesson_count + 1,
          updated_at: new Date()
        })
        .where(eq(communityMealCourses.id, courseId));

      res.json(newLesson);
    } catch (error) {
      console.error("Error creating lesson:", error);
      res.status(500).json({ message: "Failed to create lesson" });
    }
  });

  // Update a lesson (creator only) - Alternative route that includes courseId
  app.put("/api/communities/:id/courses/:courseId/lessons/:lessonId", authenticateToken, async (req: any, res) => {
    try {
      const lessonId = Number(req.params.lessonId);
      const courseId = Number(req.params.courseId);
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // Verify user is creator by checking the course
      const [lesson] = await db.select({
        lesson: communityMealLessons,
        course: communityMealCourses,
      })
        .from(communityMealLessons)
        .innerJoin(communityMealCourses, eq(communityMealLessons.course_id, communityMealCourses.id))
        .where(and(
          eq(communityMealLessons.id, lessonId),
          eq(communityMealLessons.course_id, courseId)
        ));

      if (!lesson || lesson.course.creator_id !== userId) {
        return res.status(403).json({ message: "Only the creator can update this lesson" });
      }

      // Update lesson
      const [updatedLesson] = await db.update(communityMealLessons)
        .set({
          title: req.body.title || lesson.lesson.title,
          emoji: req.body.emoji || lesson.lesson.emoji,
          description: req.body.description || lesson.lesson.description,
          video_url: req.body.video_url || lesson.lesson.video_url,
          youtube_video_id: req.body.youtube_video_id || lesson.lesson.youtube_video_id,
          image_url: req.body.image_url || lesson.lesson.image_url,
          ingredients: req.body.ingredients || lesson.lesson.ingredients,
          instructions: req.body.instructions || lesson.lesson.instructions,
          prep_time: req.body.prep_time || lesson.lesson.prep_time,
          cook_time: req.body.cook_time || lesson.lesson.cook_time,
          servings: req.body.servings || lesson.lesson.servings,
          difficulty_level: req.body.difficulty_level || lesson.lesson.difficulty_level,
          is_published: req.body.is_published !== undefined ? req.body.is_published : lesson.lesson.is_published,
          lesson_order: req.body.lesson_order || lesson.lesson.lesson_order,
          updated_at: new Date(),
        })
        .where(eq(communityMealLessons.id, lessonId))
        .returning();

      // Update sections if provided
      if (req.body.sections && Array.isArray(req.body.sections)) {
        // Delete existing sections
        await db.delete(communityMealLessonSections)
          .where(eq(communityMealLessonSections.lesson_id, lessonId));

        // Insert new sections
        const sections = req.body.sections.map((section: any, index: number) => ({
          lesson_id: lessonId,
          section_type: section.section_type,
          title: section.title,
          content: section.content,
          template_id: section.template_id,
          display_order: section.display_order ?? index,
          is_visible: section.is_visible ?? true,
        }));

        await db.insert(communityMealLessonSections).values(sections);
      }

      res.json(updatedLesson);
    } catch (error) {
      console.error("Error updating lesson:", error);
      res.status(500).json({ message: "Failed to update lesson" });
    }
  });

  // Update a lesson (creator only)
  app.put("/api/communities/:id/lessons/:lessonId", authenticateToken, async (req: any, res) => {
    try {
      const lessonId = Number(req.params.lessonId);
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // Verify user is creator by checking the course
      const [lesson] = await db.select({
        lesson: communityMealLessons,
        course: communityMealCourses,
      })
        .from(communityMealLessons)
        .innerJoin(communityMealCourses, eq(communityMealLessons.course_id, communityMealCourses.id))
        .where(eq(communityMealLessons.id, lessonId));

      if (!lesson || lesson.course.creator_id !== userId) {
        return res.status(403).json({ message: "Only the creator can update this lesson" });
      }

      // Update lesson
      const [updatedLesson] = await db.update(communityMealLessons)
        .set({
          title: req.body.title || lesson.lesson.title,
          emoji: req.body.emoji || lesson.lesson.emoji,
          description: req.body.description || lesson.lesson.description,
          video_url: req.body.video_url || lesson.lesson.video_url,
          youtube_video_id: req.body.youtube_video_id || lesson.lesson.youtube_video_id,
          image_url: req.body.image_url || lesson.lesson.image_url,
          ingredients: req.body.ingredients || lesson.lesson.ingredients,
          instructions: req.body.instructions || lesson.lesson.instructions,
          prep_time: req.body.prep_time ?? lesson.lesson.prep_time,
          cook_time: req.body.cook_time ?? lesson.lesson.cook_time,
          servings: req.body.servings ?? lesson.lesson.servings,
          difficulty_level: req.body.difficulty_level ?? lesson.lesson.difficulty_level,
          nutrition_info: req.body.nutrition_info || lesson.lesson.nutrition_info,
          is_published: req.body.is_published ?? lesson.lesson.is_published,
          updated_at: new Date(),
        })
        .where(eq(communityMealLessons.id, lessonId))
        .returning();

      // Update sections if provided
      if (req.body.sections && Array.isArray(req.body.sections)) {
        // Delete existing sections
        await db.delete(communityMealLessonSections)
          .where(eq(communityMealLessonSections.lesson_id, lessonId));

        // Insert new sections
        const sections = req.body.sections.map((section: any, index: number) => ({
          lesson_id: lessonId,
          section_type: section.section_type,
          title: section.title,
          content: section.content,
          template_id: section.template_id,
          display_order: section.display_order ?? index,
          is_visible: section.is_visible ?? true,
        }));

        await db.insert(communityMealLessonSections).values(sections);
      }

      res.json(updatedLesson);
    } catch (error) {
      console.error("Error updating lesson:", error);
      res.status(500).json({ message: "Failed to update lesson" });
    }
  });

  // Get lesson details with sections
  app.get("/api/communities/:id/lessons/:lessonId", authenticateToken, async (req: any, res) => {
    try {
      const lessonId = Number(req.params.lessonId);
      const userId = req.user?.id;

      // Get lesson with course info
      const [lesson] = await db.select()
        .from(communityMealLessons)
        .where(eq(communityMealLessons.id, lessonId));

      if (!lesson) {
        return res.status(404).json({ message: "Lesson not found" });
      }

      // Get sections
      const sections = await db.select()
        .from(communityMealLessonSections)
        .where(eq(communityMealLessonSections.lesson_id, lessonId))
        .orderBy(communityMealLessonSections.display_order);

      // Get user progress if authenticated
      let userProgress = null;
      if (userId) {
        const [progress] = await db.select()
          .from(userMealCourseProgress)
          .where(and(
            eq(userMealCourseProgress.user_id, userId),
            eq(userMealCourseProgress.course_id, lesson.course_id)
          ));
        userProgress = progress;
      }

      res.json({
        ...lesson,
        sections,
        userProgress,
      });
    } catch (error) {
      console.error("Error fetching lesson:", error);
      res.status(500).json({ message: "Failed to fetch lesson" });
    }
  });

  // Get creator's communities
  app.get("/api/creator/communities", authenticateToken, async (req: any, res) => {
    try {
      console.log(`🔍 [DEBUG] /api/creator/communities called for user:`, req.user?.id);
      const userId = req.user?.id;
      if (!userId) {
        console.log(`❌ [DEBUG] No user ID in creator/communities request`);
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      const creatorCommunities = await db.select()
        .from(communities)
        .where(eq(communities.creator_id, userId));
      
      // Add member counts and revenue data
      const communitiesWithStats = await Promise.all(
        creatorCommunities.map(async (community) => {
          const members = await db.select()
            .from(communityMembers)
            .where(eq(communityMembers.community_id, community.id));
          
          return {
            ...community,
            memberCount: members.length,
            monthlyRevenue: 0, // Will implement with Stripe
            engagementRate: Math.floor(Math.random() * 30) + 60, // Mock percentage
          };
        })
      );
      
      res.json(communitiesWithStats);
    } catch (error) {
      console.error("Error fetching creator communities:", error);
      res.status(500).json({ message: "Failed to fetch creator communities" });
    }
  });


  // Create community post (for sharing)
  app.post("/api/community-posts", authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const { 
        community_id, 
        content, 
        post_type = 'meal_share', 
        recipe_data, 
        meal_plan_id, 
        images 
      } = req.body;

      if (!community_id || !content?.trim()) {
        return res.status(400).json({ message: "Missing required fields: community_id, content" });
      }

      // Check if user is member of the community
      const membership = await db.select()
        .from(communityMembers)
        .where(and(
          eq(communityMembers.community_id, community_id),
          eq(communityMembers.user_id, userId)
        ))
        .limit(1);

      if (membership.length === 0) {
        return res.status(403).json({ message: "Not a member of this community" });
      }

      // Create the post
      const [newPost] = await db.insert(communityPosts).values({
        community_id: community_id,
        author_id: userId,
        content: content.trim(),
        post_type: post_type,
        meal_plan_id: meal_plan_id || null,
        images: images ? JSON.stringify(images) : null,
        recipe_data: recipe_data ? JSON.stringify(recipe_data) : null,
      }).returning();

      // If recipe data is provided, create a proper meal plan structure
      if (recipe_data && post_type === 'meal_share') {
        // Debug: Log the received recipe data
        console.log('=== SERVER: Received recipe_data for sharing ===', {
          hasVideoId: !!recipe_data.video_id,
          video_id: recipe_data.video_id,
          video_title: recipe_data.video_title,
          video_channel: recipe_data.video_channel,
          title: recipe_data.title,
          hasIngredients: !!recipe_data.ingredients
        });
        
        // Create a proper meal plan structure from recipe data to ensure tabs work
        const tempMealPlan = {
          id: `recipe_${newPost.id}`, // Use post ID for unique identifier
          name: recipe_data.title || 'Shared Recipe',
          description: recipe_data.description || '',
          meal_plan: {
            day_1: {
              breakfast: {
                name: recipe_data.title || 'Shared Recipe',
                description: recipe_data.description || '',
                ingredients: recipe_data.ingredients || [],
                instructions: recipe_data.instructions || [],
                prep_time: recipe_data.time_minutes || 30,
                cuisine: recipe_data.cuisine || '',
                difficulty: 'Medium',
                // Add nutrition if available
                nutrition: recipe_data.nutrition || recipe_data.nutrition_info || null,
                // Add image if available
                image_url: recipe_data.image_url || null,
                // Add video fields if available
                video_id: recipe_data.video_id || null,
                video_title: recipe_data.video_title || null,
                video_channel: recipe_data.video_channel || null
              }
            }
          }
        };

        // Update the post with the meal plan data in the recipe_data column
        await db.update(communityPosts)
          .set({ 
            recipe_data: JSON.stringify(tempMealPlan)
          })
          .where(eq(communityPosts.id, newPost.id));
      }

      res.status(201).json({ message: "Post created successfully", post: newPost });
    } catch (error) {
      console.error("Error creating community post:", error);
      res.status(500).json({ message: "Failed to create post" });
    }
  });

  // Favorites API routes
  // Get user's favorites
  app.get("/api/favorites", authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const favorites = await storage.getUserFavorites(userId);
      res.json(favorites);
    } catch (error) {
      console.error("Error fetching favorites:", error);
      res.status(500).json({ message: "Failed to fetch favorites" });
    }
  });

  // Add item to favorites
  app.post("/api/favorites", authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const { item_type, item_id, title, description, image_url, time_minutes, cuisine, diet, video_id, video_title, video_channel, metadata } = req.body;

      if (!item_type || !item_id || !title) {
        return res.status(400).json({ message: "Missing required fields: item_type, item_id, title" });
      }

      // Check if already favorited
      const isAlreadyFavorited = await storage.isFavorited(userId, item_type, item_id);
      if (isAlreadyFavorited) {
        return res.status(409).json({ message: "Item already favorited" });
      }

      const favorite = await storage.addToFavorites({
        user_id: userId,
        item_type,
        item_id,
        title,
        description,
        image_url,
        time_minutes,
        cuisine,
        diet,
        video_id,
        video_title,
        video_channel,
        metadata
      });

      res.status(201).json(favorite);
    } catch (error) {
      console.error("Error adding to favorites:", error);
      res.status(500).json({ message: "Failed to add to favorites" });
    }
  });

  // Remove item from favorites
  app.delete("/api/favorites/:itemType/:itemId", authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const { itemType, itemId } = req.params;

      const success = await storage.removeFromFavorites(userId, itemType, itemId);
      if (success) {
        res.json({ message: "Removed from favorites" });
      } else {
        res.status(404).json({ message: "Favorite not found" });
      }
    } catch (error) {
      console.error("Error removing from favorites:", error);
      res.status(500).json({ message: "Failed to remove from favorites" });
    }
  });

  // Smart Meal Plan Extractor API endpoint with intelligent routing
  app.post("/api/extract-meal-plan", authenticateToken, async (req: any, res) => {
    try {
      console.log("🔥 [BACKEND DEBUG] Extract meal plan endpoint hit");
      const { url } = req.body;
      const userId = req.user?.id;
      
      console.log("🔥 [BACKEND DEBUG] Request details:", {
        url: url,
        userId: userId,
        hasAuth: !!userId,
        body: req.body
      });
      
      if (!userId) {
        console.log("❌ [BACKEND DEBUG] User not authenticated");
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      if (!url) {
        console.log("❌ [BACKEND DEBUG] URL is missing from request");
        return res.status(400).json({ message: "URL is required" });
      }
      
      console.log(`🎯 [BACKEND DEBUG] Starting smart extraction for: ${url}`);
      
      // Use the smart router to determine extraction strategy
      console.log("📦 [BACKEND DEBUG] Importing SmartExtractionRouter...");
      const { default: SmartExtractionRouter } = await import('./services/smartExtractionRouter.js');
      console.log("📦 [BACKEND DEBUG] SmartExtractionRouter imported successfully");
      
      const smartRouter = new SmartExtractionRouter();
      console.log("🔧 [BACKEND DEBUG] SmartRouter instance created");
      
      console.log("🚀 [BACKEND DEBUG] Calling extractFromUrl...");
      const result = await smartRouter.extractFromUrl(url, { maxRecipes: 10 });
      console.log("📤 [BACKEND DEBUG] SmartRouter result:", result);
      
      if (!result.success) {
        console.log("❌ [BACKEND DEBUG] SmartRouter failed:", result.error);
        console.log("❌ [BACKEND DEBUG] Failure metadata:", result.metadata);
        return res.status(500).json({
          success: false,
          error: result.error,
          metadata: result.metadata
        });
      }

      // Handle different result types
      if (result.type === 'single-recipe') {
        // Single recipe extraction (direct recipe URL)
        console.log(`✅ Single recipe extracted: "${result.recipe.title}"`);
        
        res.json({
          success: true,
          recipe: result.recipe,
          metadata: result.metadata
        });
        
      } else if (result.type === 'multi-recipe') {
        // Multiple recipes from homepage/category page
        console.log(`✅ Multiple recipes extracted: ${result.recipes.length} recipes`);
        
        // For backwards compatibility, return the best quality recipe as primary
        // (recipe with most ingredients and instructions)
        const bestRecipe = result.recipes.reduce((best, current) => {
          const currentScore = (current.recipe.ingredients?.length || 0) + (current.recipe.instructions?.length || 0);
          const bestScore = (best.recipe.ingredients?.length || 0) + (best.recipe.instructions?.length || 0);
          return currentScore > bestScore ? current : best;
        });
        
        const primaryRecipe = bestRecipe?.recipe;
        
        if (!primaryRecipe) {
          return res.status(500).json({
            success: false,
            error: 'No recipes could be extracted from the discovered URLs'
          });
        }
        
        res.json({
          success: true,
          recipe: primaryRecipe,
          allRecipes: result.recipes.map(r => r.recipe), // Include all full recipes
          metadata: {
            ...bestRecipe?.metadata,
            multipleRecipesFound: true,
            totalRecipesExtracted: result.recipes.length,
            allRecipes: result.recipes.map(r => ({
              title: r.recipe.title,
              url: r.url,
              ingredients: r.recipe.ingredients?.length || 0,
              instructions: r.recipe.instructions?.length || 0
            })),
            extractionSummary: result.summary
          }
        });
      }
      
    } catch (error) {
      console.error('🚨 [BACKEND DEBUG] Meal extraction critical error:', error);
      console.error('🚨 [BACKEND DEBUG] Error stack:', error.stack);
      console.error('🚨 [BACKEND DEBUG] Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
      res.status(500).json({ 
        success: false, 
        error: 'Failed to extract meal plan data',
        details: error.message 
      });
    }
  });

  // Batch extract multiple recipes from a website
  app.post("/api/batch-extract-recipes", authenticateToken, async (req: any, res) => {
    try {
      const { homepageUrl, maxRecipes = 50 } = req.body;
      
      if (!homepageUrl) {
        return res.status(400).json({ 
          success: false, 
          error: 'Homepage URL is required' 
        });
      }

      console.log(`🚀 Starting batch extraction from: ${homepageUrl}`);
      console.log(`📊 Max recipes: ${maxRecipes}`);

      // Dynamic import for batch extraction service
      const { default: BatchExtractionService } = await import('./services/batchExtractionService.js');
      const batchExtractor = new BatchExtractionService();

      // Start batch extraction
      const result = await batchExtractor.extractRecipesFromSite(homepageUrl, maxRecipes);

      if (result.success) {
        console.log(`✅ Batch extraction completed: ${result.summary.successfulExtractions} recipes extracted`);
        res.json(result);
      } else {
        console.log(`❌ Batch extraction failed: ${result.error}`);
        res.status(500).json(result);
      }

    } catch (error) {
      console.error('🚨 Batch extraction error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to start batch extraction',
        details: error.message 
      });
    }
  });

  // Get batch extraction progress (for future real-time updates)
  app.get("/api/batch-extract-progress/:sessionId", authenticateToken, async (req: any, res) => {
    try {
      // TODO: Implement session-based progress tracking
      res.json({ 
        message: "Progress tracking not yet implemented",
        sessionId: req.params.sessionId 
      });
    } catch (error) {
      console.error('Progress tracking error:', error);
      res.status(500).json({ message: "Failed to get progress" });
    }
  });

  // Check if item is favorited
  app.get("/api/favorites/:itemType/:itemId/check", authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const { itemType, itemId } = req.params;
      const isFavorited = await storage.isFavorited(userId, itemType, itemId);
      
      res.json({ isFavorited });
    } catch (error) {
      console.error("Error checking favorite status:", error);
      res.status(500).json({ message: "Failed to check favorite status" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
