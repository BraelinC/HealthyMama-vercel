import { db } from "./db";
import { users, recipes, userRecipes, mealPlans, profiles, userAchievements, mealCompletions, groceryListCache, foodLogs, foodDatabase, userFavorites, type User, type UpsertUser, type Recipe, type InsertRecipe, type UserRecipe, type InsertUserRecipe, type MealPlan, type Profile, type InsertProfile, type UserAchievement, type InsertUserAchievement, type MealCompletion, type InsertMealCompletion, type GroceryListCache, type InsertGroceryListCache, type FoodLog, type InsertFoodLog, type FoodDatabaseItem, type InsertFoodDatabaseItem, type UserFavorite, type InsertUserFavorite, type IStorage } from "../shared/schema";
import { eq, desc, and, sql, like, gte, lte } from "drizzle-orm";

export class DatabaseStorage implements IStorage {
  // User operations
  // (IMPORTANT) these user operations are mandatory for Replit Auth.
  async getUser(id: string | number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, String(id)));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(userData: {
    email: string;
    phone: string;
    password_hash: string;
    full_name: string;
    account_type?: string;
    trial_ends_at?: Date;
    subscription_status?: string;
    stripe_customer_id?: string;
  }): Promise<User> {
    // Generate a simple sequential ID for standard auth
    const timestamp = Date.now();
    const randomSuffix = Math.floor(Math.random() * 1000);
    const userId = `user_${timestamp}_${randomSuffix}`;
    
    const [user] = await db
      .insert(users)
      .values({
        id: userId,
        email: userData.email,
        phone: userData.phone,
        password_hash: userData.password_hash,
        full_name: userData.full_name,
        firstName: userData.full_name.split(' ')[0],
        lastName: userData.full_name.split(' ').slice(1).join(' ') || null,
        account_type: userData.account_type || 'free_trial',
        trial_ends_at: userData.trial_ends_at,
        subscription_status: userData.subscription_status || 'active',
        stripe_customer_id: userData.stripe_customer_id,
      })
      .returning();
    
    return user;
  }

  async updateUser(id: string, updates: any): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async updateUserGoogleId(id: string, googleId: string): Promise<void> {
    await db
      .update(users)
      .set({ google_id: googleId, updatedAt: new Date() })
      .where(eq(users.id, id));
  }

  async getUserByStripeCustomerId(customerId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.stripe_customer_id, customerId));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    try {
      // First, check if user exists by email (since email is unique and stable)
      if (userData.email) {
        const [existingByEmail] = await db.select().from(users).where(eq(users.email, userData.email));
        if (existingByEmail) {
          // User exists by email, update their information
          const [user] = await db
            .update(users)
            .set({
              firstName: userData.firstName,
              lastName: userData.lastName,
              profileImageUrl: userData.profileImageUrl,
              updatedAt: new Date(),
            })
            .where(eq(users.email, userData.email))
            .returning();
          console.log('✅ Updated existing user by email:', user.id);
          return user;
        }
      }

      // Check if user exists by ID
      if (userData.id) {
        const existing = await this.getUser(userData.id);
        if (existing) {
          // User exists, update their information
          const [user] = await db
            .update(users)
            .set({
              email: userData.email,
              firstName: userData.firstName,
              lastName: userData.lastName,
              profileImageUrl: userData.profileImageUrl,
              updatedAt: new Date(),
            })
            .where(eq(users.id, userData.id))
            .returning();
          console.log('✅ Updated existing user by ID:', user.id);
          return user;
        }
      }

      // User doesn't exist, try to insert with the specified ID
      // We need to override the default UUID generation
      const insertData = { ...userData };
      const [user] = await db
        .insert(users)
        .values(insertData)
        .returning();
      console.log('✅ Created new user:', user.id);
      return user;
    } catch (error: any) {
      console.log('🔍 Insert error:', error);
      // If there's still a conflict, handle specific cases
      if (error?.code === '23505') { // Unique constraint violation
        if (error.constraint === 'users_email_key' && userData.email) {
          // Conflict on email, update by email
          const [user] = await db
            .update(users)
            .set({
              firstName: userData.firstName,
              lastName: userData.lastName,
              profileImageUrl: userData.profileImageUrl,
              updatedAt: new Date(),
            })
            .where(eq(users.email, userData.email))
            .returning();
          console.log('✅ Updated user after email conflict:', user.id);
          return user;
        } else if (error.constraint === 'users_pkey' && userData.id) {
          // ID conflict, check if user exists
          const existing = await this.getUser(userData.id);
          if (existing) {
            console.log('✅ Found existing user after ID conflict:', existing.id);
            return existing;
          }
        }
      }
      // Re-throw the error if we can't handle it
      console.error('Error in upsertUser:', error);
      throw error;
    }
  }

  // Recipe methods
  async createRecipe(recipe: InsertRecipe): Promise<Recipe> {
    const [createdRecipe] = await db
      .insert(recipes)
      .values(recipe)
      .returning();
    
    return createdRecipe;
  }

  async getRecipe(id: number): Promise<Recipe | undefined> {
    const [recipe] = await db.select().from(recipes).where(eq(recipes.id, id));
    return recipe;
  }

  async getPopularRecipes(): Promise<Recipe[]> {
    // First try to get the 4 baseline recipes with working YouTube thumbnails
    const baselineRecipes = await db.select().from(recipes)
      .where(eq(recipes.id, 210));

    const recipe211 = await db.select().from(recipes).where(eq(recipes.id, 211));
    const recipe212 = await db.select().from(recipes).where(eq(recipes.id, 212)); 
    const recipe213 = await db.select().from(recipes).where(eq(recipes.id, 213));

    let result = [...baselineRecipes, ...recipe211, ...recipe212, ...recipe213];

    // If we need more recipes to reach 6, add others
    if (result.length < 6) {
      const otherRecipes = await db.select().from(recipes)
        .orderBy(desc(recipes.created_at))
        .limit(6 - result.length);

      // Only add recipes that aren't already in our baseline set
      const filteredOthers = otherRecipes.filter(recipe => 
        !result.some(existing => existing.id === recipe.id)
      );

      result = [...result, ...filteredOthers];
    }

    return result.slice(0, 6);
  }

  async getSavedRecipes(userId?: string): Promise<Recipe[]> {
    if (userId) {
      return await db.select().from(recipes)
        .where(and(eq(recipes.is_saved, true), eq(recipes.user_id, userId)))
        .orderBy(desc(recipes.created_at));
    }

    return await db.select().from(recipes)
      .where(eq(recipes.is_saved, true))
      .orderBy(desc(recipes.created_at));
  }

  async getGeneratedRecipes(userId?: string): Promise<Recipe[]> {
    if (userId) {
      return await db.select().from(recipes)
        .where(and(eq(recipes.is_saved, false), eq(recipes.user_id, userId)))
        .orderBy(desc(recipes.created_at));
    }

    return await db.select().from(recipes)
      .where(eq(recipes.is_saved, false))
      .orderBy(desc(recipes.created_at));
  }

  async getUserCreatedRecipes(userId: string): Promise<UserRecipe[]> {
    return await db.select().from(userRecipes)
      .where(eq(userRecipes.user_id, userId))
      .orderBy(desc(userRecipes.created_at));
  }

  async createUserRecipe(recipe: InsertUserRecipe): Promise<UserRecipe> {
    const [createdRecipe] = await db
      .insert(userRecipes)
      .values(recipe)
      .returning();
    
    return createdRecipe;
  }

  async deleteUserRecipe(recipeId: number, userId: string): Promise<boolean> {
    const result = await db
      .delete(userRecipes)
      .where(and(eq(userRecipes.id, recipeId), eq(userRecipes.user_id, userId)));
    
    return result.rowCount > 0;
  }

  async getRecipeById(recipeId: number): Promise<any> {
    try {
      const recipe = await db
        .select()
        .from(recipes)
        .where(eq(recipes.id, recipeId))
        .limit(1);

      return recipe.length > 0 ? recipe[0] : null;
    } catch (error) {
      console.error("Error getting recipe by ID:", error);
      throw error;
    }
  }

  async saveRecipe(recipeId: number): Promise<any> {
    try {
      console.log(`DatabaseStorage: Saving recipe ${recipeId}`);

      // First get the recipe to check if it exists
      const existingRecipe = await this.getRecipeById(recipeId);

      if (!existingRecipe) {
        console.log(`DatabaseStorage: Recipe ${recipeId} not found`);
        return null;
      }

      console.log(`DatabaseStorage: Found recipe ${recipeId}, updating is_saved to true`);

      // Update the recipe to mark it as saved
      await db
        .update(recipes)
        .set({ is_saved: true })
        .where(eq(recipes.id, recipeId));

      console.log(`DatabaseStorage: Successfully updated recipe ${recipeId}`);

      // Return the updated recipe
      const updatedRecipe = { ...existingRecipe, is_saved: true };
      return updatedRecipe;
    } catch (error) {
      console.error("DatabaseStorage: Error saving recipe:", error);
      throw error;
    }
  }

  async unsaveRecipe(recipeId: number): Promise<void> {
    try {
      console.log(`DatabaseStorage: Unsaving recipe ${recipeId}`);

      const result = await db
        .update(recipes)
        .set({ is_saved: false })
        .where(eq(recipes.id, recipeId));

      console.log(`DatabaseStorage: Successfully unsaved recipe ${recipeId}`);
    } catch (error) {
      console.error("DatabaseStorage: Error unsaving recipe:", error);
      throw error;
    }
  }

  // Meal plan operations
  async getSavedMealPlans(userId: string): Promise<MealPlan[]> {
    try {
      // Optimize query with limit for better performance
      const plans = await db.select()
        .from(mealPlans)
        .where(eq(mealPlans.userId, userId))
        .orderBy(desc(mealPlans.updatedAt))
        .limit(50); // Limit to most recent 50 meal plans

      console.log('Database returned meal plans:', plans?.length || 0);
      // Ensure we always return an array
      return Array.isArray(plans) ? plans : [];
    } catch (error) {
      console.error('Database error fetching meal plans:', error);
      return [];
    }
  }

  async saveMealPlan(data: {
    userId: string;
    name: string;
    description: string;
    mealPlan: any;
    isAutoSaved?: boolean;
  }): Promise<MealPlan> {
    const [savedPlan] = await db.insert(mealPlans)
      .values({
        userId: data.userId,
        name: data.name,
        description: data.description,
        mealPlan: data.mealPlan,
        isAutoSaved: data.isAutoSaved || false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return savedPlan;
  }

  async updateMealPlan(planId: number, userId: string, data: {
    name: string;
    description: string;
    mealPlan: any;
  }): Promise<MealPlan | null> {
    try {
      console.log('Updating meal plan in database:', { planId, userId, dataKeys: Object.keys(data) });

      const [updatedPlan] = await db.update(mealPlans)
        .set({
          name: data.name,
          description: data.description,
          mealPlan: data.mealPlan,
          updatedAt: new Date(),
        })
        .where(eq(mealPlans.id, planId))
        .returning();

      console.log('Database update result:', updatedPlan ? 'success' : 'no result');
      return updatedPlan || null;
    } catch (error) {
      console.error('Database error updating meal plan:', error);
      throw error;
    }
  }

  async getMealPlan(planId: number, userId: string): Promise<MealPlan | null> {
    const [plan] = await db.select()
      .from(mealPlans)
      .where(eq(mealPlans.id, planId));

    return plan || null;
  }

  async deleteMealPlan(planId: number, userId: string): Promise<boolean> {
    try {
      console.log('Deleting meal plan from database:', { planId, userId });

      const result = await db.delete(mealPlans)
        .where(eq(mealPlans.id, planId))
        .returning();

      const success = result.length > 0;
      console.log('Database delete result:', success ? 'success' : 'no rows affected');
      return success;
    } catch (error) {
      console.error('Database error deleting meal plan:', error);
      return false;
    }
  }

  // Profile methods
  async getProfile(userId: string): Promise<Profile | undefined> {
    const [profile] = await db.select().from(profiles).where(eq(profiles.user_id, userId));
    return profile;
  }

  async createProfile(profile: InsertProfile): Promise<Profile> {
    try {
      console.log('DatabaseStorage: Creating profile with data:', profile);
      
      const [createdProfile] = await db
        .insert(profiles)
        .values({
          user_id: profile.user_id,
          profile_name: profile.profile_name,
          primary_goal: profile.primary_goal,
          family_size: profile.family_size || 1,
          members: profile.members || [],
          profile_type: profile.profile_type || 'family',
          preferences: profile.preferences || [],
          goals: profile.goals || [],
          cultural_background: profile.cultural_background || [],
          questionnaire_answers: profile.questionnaire_answers || {},
          questionnaire_selections: profile.questionnaire_selections || [],
        })
        .returning();
      
      console.log('DatabaseStorage: Successfully created profile:', createdProfile);
      return createdProfile;
    } catch (error) {
      console.error('DatabaseStorage: Error creating profile:', error);
      throw error;
    }
  }

  async updateProfile(userId: string, profile: Partial<InsertProfile>): Promise<Profile | null> {
    try {
      const [updatedProfile] = await db
        .update(profiles)
        .set({
          profile_name: profile.profile_name,
          primary_goal: profile.primary_goal,
          family_size: profile.family_size,
          members: profile.members,
          profile_type: profile.profile_type,
          preferences: profile.preferences,
          goals: profile.goals,
          cultural_background: profile.cultural_background,
          questionnaire_answers: profile.questionnaire_answers,
          questionnaire_selections: profile.questionnaire_selections,
          updated_at: new Date(),
        })
        .where(eq(profiles.user_id, userId))
        .returning();
      return updatedProfile || null;
    } catch (error) {
      console.error('Database error updating profile:', error);
      return null;
    }
  }

  // Achievement methods
  async getUserAchievements(userId: string): Promise<UserAchievement[]> {
    const achievements = await db.select()
      .from(userAchievements)
      .where(eq(userAchievements.user_id, userId))
      .orderBy(desc(userAchievements.created_at));
    return achievements;
  }

  async initializeUserAchievements(userId: string): Promise<UserAchievement[]> {
    // Define all available achievements
    const achievementDefinitions = [
      {
        achievement_id: "first_steps",
        title: "First Steps",
        description: "Generate your first meal plan",
        category: "cooking",
        max_progress: 1,
        points: 100,
        rarity: "common"
      },
      {
        achievement_id: "meal_master",
        title: "Meal Master", 
        description: "Generate 10 meal plans",
        category: "cooking",
        max_progress: 10,
        points: 500,
        rarity: "rare"
      },
      {
        achievement_id: "healthy_start",
        title: "Healthy Start",
        description: "Save your first healthy meal plan",
        category: "wellness",
        max_progress: 1,
        points: 150,
        rarity: "common"
      }
    ];

    const insertData = achievementDefinitions.map(def => ({
      user_id: userId,
      achievement_id: def.achievement_id,
      title: def.title,
      description: def.description,
      category: def.category,
      is_unlocked: false,
      progress: 0,
      max_progress: def.max_progress,
      points: def.points,
      rarity: def.rarity,
      unlocked_date: null
    }));

    const createdAchievements = await db.insert(userAchievements)
      .values(insertData)
      .returning();
    
    return createdAchievements;
  }

  async updateUserAchievement(userId: string, achievementId: string, data: {
    progress?: number;
    is_unlocked?: boolean;
    unlocked_date?: Date;
  }): Promise<UserAchievement | null> {
    const [updatedAchievement] = await db
      .update(userAchievements)
      .set({
        progress: data.progress,
        is_unlocked: data.is_unlocked,
        unlocked_date: data.unlocked_date,
        updated_at: new Date()
      })
      .where(and(
        eq(userAchievements.user_id, userId),
        eq(userAchievements.achievement_id, achievementId)
      ))
      .returning();
    
    return updatedAchievement || null;
  }

  async getUserAchievement(userId: string, achievementId: string): Promise<UserAchievement | null> {
    const [achievement] = await db.select()
      .from(userAchievements)
      .where(and(
        eq(userAchievements.user_id, userId),
        eq(userAchievements.achievement_id, achievementId)
      ));
    
    return achievement || null;
  }

  // Meal completion methods
  async getMealCompletions(userId: string, mealPlanId: number): Promise<MealCompletion[]> {
    const completions = await db.select()
      .from(mealCompletions)
      .where(and(
        eq(mealCompletions.user_id, userId),
        eq(mealCompletions.meal_plan_id, mealPlanId)
      ));
    
    return completions;
  }

  async toggleMealCompletion(userId: string, mealPlanId: number, dayKey: string, mealType: string): Promise<MealCompletion> {
    // First check if completion record exists
    const [existing] = await db.select()
      .from(mealCompletions)
      .where(and(
        eq(mealCompletions.user_id, userId),
        eq(mealCompletions.meal_plan_id, mealPlanId),
        eq(mealCompletions.day_key, dayKey),
        eq(mealCompletions.meal_type, mealType)
      ));

    if (existing) {
      // Toggle the completion status
      const [updated] = await db.update(mealCompletions)
        .set({
          is_completed: !existing.is_completed,
          completed_at: !existing.is_completed ? new Date() : null,
          updated_at: new Date()
        })
        .where(and(
          eq(mealCompletions.user_id, userId),
          eq(mealCompletions.meal_plan_id, mealPlanId),
          eq(mealCompletions.day_key, dayKey),
          eq(mealCompletions.meal_type, mealType)
        ))
        .returning();
      
      return updated;
    } else {
      // Create new completion record (mark as completed)
      const [created] = await db.insert(mealCompletions)
        .values({
          user_id: userId,
          meal_plan_id: mealPlanId,
          day_key: dayKey,
          meal_type: mealType,
          is_completed: true,
          completed_at: new Date()
        })
        .returning();
      
      return created;
    }
  }

  async getMealCompletion(userId: string, mealPlanId: number, dayKey: string, mealType: string): Promise<MealCompletion | null> {
    const [completion] = await db.select()
      .from(mealCompletions)
      .where(and(
        eq(mealCompletions.user_id, userId),
        eq(mealCompletions.meal_plan_id, mealPlanId),
        eq(mealCompletions.day_key, dayKey),
        eq(mealCompletions.meal_type, mealType)
      ));
    
    return completion || null;
  }

  async completeMealPlan(userId: string, mealPlanId: number): Promise<MealPlan | null> {
    try {
      console.log(`🔍 COMPLETE PLAN DEBUG: Starting for user ${userId}, plan ${mealPlanId}`);
      
      // Get the meal plan first to verify it exists and belongs to the user
      const [plan] = await db.select()
        .from(mealPlans)
        .where(and(
          eq(mealPlans.id, mealPlanId),
          eq(mealPlans.userId, userId)
        ));

      if (!plan) {
        console.log(`❌ COMPLETE PLAN DEBUG: No meal plan found for user ${userId} and plan ${mealPlanId}`);
        return null;
      }

      console.log(`✅ COMPLETE PLAN DEBUG: Found meal plan ${mealPlanId} for user ${userId}`);

      // Check existing completions before deletion
      const existingCompletions = await db.select()
        .from(mealCompletions)
        .where(and(
          eq(mealCompletions.meal_plan_id, mealPlanId),
          eq(mealCompletions.user_id, userId)
        ));

      console.log(`📊 COMPLETE PLAN DEBUG: Found ${existingCompletions.length} completions to delete`);

      // Use a transaction to ensure both operations complete atomically
      return await db.transaction(async (tx) => {
        console.log(`🔄 COMPLETE PLAN DEBUG: Starting transaction for plan ${mealPlanId}`);
        
        // First delete associated meal completions to avoid foreign key constraint
        const deletedCompletions = await tx.delete(mealCompletions)
          .where(and(
            eq(mealCompletions.meal_plan_id, mealPlanId),
            eq(mealCompletions.user_id, userId)
          ));

        console.log(`🗑️ COMPLETE PLAN DEBUG: Deleted meal completions for plan ${mealPlanId}:`, deletedCompletions);

        // Verify completions are actually deleted
        const remainingCompletions = await tx.select()
          .from(mealCompletions)
          .where(eq(mealCompletions.meal_plan_id, mealPlanId));

        console.log(`🔍 COMPLETE PLAN DEBUG: Remaining completions after deletion: ${remainingCompletions.length}`);
        
        if (remainingCompletions.length > 0) {
          console.log(`⚠️ COMPLETE PLAN DEBUG: Still found completions:`, remainingCompletions);
        }

        // Then delete the meal plan to remove it from active plans
        console.log(`🗑️ COMPLETE PLAN DEBUG: Now deleting meal plan ${mealPlanId}`);
        const deletedPlan = await tx.delete(mealPlans)
          .where(and(
            eq(mealPlans.id, mealPlanId),
            eq(mealPlans.userId, userId)
          ));

        console.log(`✅ COMPLETE PLAN DEBUG: Successfully deleted meal plan ${mealPlanId}:`, deletedPlan);

        return plan;
      });
    } catch (error) {
      console.error('❌ COMPLETE PLAN DEBUG: Database error completing meal plan:', error);
      return null;
    }
  }
  
  // Grocery list cache methods
  async getGroceryListCache(mealPlanId: number, userId: string): Promise<GroceryListCache | null> {
    try {
      const [cache] = await db.select()
        .from(groceryListCache)
        .where(and(
          eq(groceryListCache.meal_plan_id, mealPlanId),
          eq(groceryListCache.user_id, userId)
        ));
      
      // Check if cache is expired
      if (cache && cache.expires_at && new Date(cache.expires_at) < new Date()) {
        // Cache is expired, delete it
        await this.deleteGroceryListCache(mealPlanId, userId);
        return null;
      }
      
      return cache || null;
    } catch (error) {
      console.error('Error getting grocery list cache:', error);
      return null;
    }
  }
  
  async saveGroceryListCache(data: InsertGroceryListCache): Promise<GroceryListCache> {
    try {
      // Delete any existing cache for this meal plan
      await this.deleteGroceryListCache(data.meal_plan_id, data.user_id);
      
      // Set expiration to 7 days from now if not specified
      const expiresAt = data.expires_at || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      
      const [cache] = await db.insert(groceryListCache)
        .values({
          ...data,
          expires_at: expiresAt
        })
        .returning();
      
      console.log('✅ Saved grocery list cache for meal plan:', data.meal_plan_id);
      return cache;
    } catch (error) {
      console.error('Error saving grocery list cache:', error);
      throw error;
    }
  }
  
  async deleteGroceryListCache(mealPlanId: number, userId: string): Promise<boolean> {
    try {
      await db.delete(groceryListCache)
        .where(and(
          eq(groceryListCache.meal_plan_id, mealPlanId),
          eq(groceryListCache.user_id, userId)
        ));
      return true;
    } catch (error) {
      console.error('Error deleting grocery list cache:', error);
      return false;
    }
  }
  
  // Food log methods for calorie tracking
  async createFoodLog(data: InsertFoodLog): Promise<FoodLog> {
    try {
      const [log] = await db.insert(foodLogs)
        .values(data)
        .returning();
      
      console.log('✅ Created food log:', log.id);
      return log;
    } catch (error) {
      console.error('Error creating food log:', error);
      throw error;
    }
  }
  
  async getFoodLogs(userId: string, date?: Date): Promise<FoodLog[]> {
    try {
      if (date) {
        // Get logs for specific date
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        
        return await db.select()
          .from(foodLogs)
          .where(and(
            eq(foodLogs.user_id, userId),
            gte(foodLogs.logged_at, startOfDay),
            lte(foodLogs.logged_at, endOfDay)
          ))
          .orderBy(desc(foodLogs.logged_at));
      } else {
        // Get today's logs
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        return await db.select()
          .from(foodLogs)
          .where(and(
            eq(foodLogs.user_id, userId),
            gte(foodLogs.logged_at, today)
          ))
          .orderBy(desc(foodLogs.logged_at));
      }
    } catch (error) {
      console.error('Error getting food logs:', error);
      return [];
    }
  }
  
  async getFoodLogsByDateRange(userId: string, startDate: Date, endDate: Date): Promise<FoodLog[]> {
    try {
      return await db.select()
        .from(foodLogs)
        .where(and(
          eq(foodLogs.user_id, userId),
          gte(foodLogs.logged_at, startDate),
          lte(foodLogs.logged_at, endDate)
        ))
        .orderBy(desc(foodLogs.logged_at));
    } catch (error) {
      console.error('Error getting food logs by date range:', error);
      return [];
    }
  }
  
  async deleteFoodLog(id: number, userId: string): Promise<boolean> {
    try {
      await db.delete(foodLogs)
        .where(and(
          eq(foodLogs.id, id),
          eq(foodLogs.user_id, userId)
        ));
      return true;
    } catch (error) {
      console.error('Error deleting food log:', error);
      return false;
    }
  }
  
  // Food database methods
  async searchFoodDatabase(query: string): Promise<FoodDatabaseItem[]> {
    try {
      return await db.select()
        .from(foodDatabase)
        .where(like(foodDatabase.name, `%${query}%`))
        .limit(20);
    } catch (error) {
      console.error('Error searching food database:', error);
      return [];
    }
  }
  
  async getFoodDatabaseItem(name: string): Promise<FoodDatabaseItem | null> {
    try {
      const [item] = await db.select()
        .from(foodDatabase)
        .where(eq(foodDatabase.name, name.toLowerCase()));
      return item || null;
    } catch (error) {
      console.error('Error getting food database item:', error);
      return null;
    }
  }
  
  async createFoodDatabaseItem(data: InsertFoodDatabaseItem): Promise<FoodDatabaseItem> {
    try {
      const [item] = await db.insert(foodDatabase)
        .values({
          ...data,
          name: data.name.toLowerCase()
        })
        .returning();
      
      console.log('✅ Added food to database:', item.name);
      return item;
    } catch (error) {
      console.error('Error creating food database item:', error);
      throw error;
    }
  }

  // Favorites methods
  async getUserFavorites(userId: string): Promise<UserFavorite[]> {
    try {
      // Optimize query with limit to prevent large result sets from slowing down the response
      return await db.select()
        .from(userFavorites)
        .where(eq(userFavorites.user_id, userId))
        .orderBy(desc(userFavorites.created_at))
        .limit(100); // Limit to most recent 100 favorites for better performance
    } catch (error) {
      console.error('Error getting user favorites:', error);
      return [];
    }
  }

  async addToFavorites(data: InsertUserFavorite): Promise<UserFavorite> {
    try {
      const [favorite] = await db.insert(userFavorites)
        .values(data)
        .returning();
      
      console.log('✅ Added to favorites:', favorite.title);
      return favorite;
    } catch (error) {
      console.error('Error adding to favorites:', error);
      throw error;
    }
  }

  async removeFromFavorites(userId: string, itemType: string, itemId: string): Promise<boolean> {
    try {
      await db.delete(userFavorites)
        .where(and(
          eq(userFavorites.user_id, userId),
          eq(userFavorites.item_type, itemType),
          eq(userFavorites.item_id, itemId)
        ));
      console.log('✅ Removed from favorites:', itemType, itemId);
      return true;
    } catch (error) {
      console.error('Error removing from favorites:', error);
      return false;
    }
  }

  async isFavorited(userId: string, itemType: string, itemId: string): Promise<boolean> {
    try {
      const [favorite] = await db.select()
        .from(userFavorites)
        .where(and(
          eq(userFavorites.user_id, userId),
          eq(userFavorites.item_type, itemType),
          eq(userFavorites.item_id, itemId)
        ))
        .limit(1);
      
      return !!favorite;
    } catch (error) {
      console.error('Error checking if favorited:', error);
      return false;
    }
  }
}