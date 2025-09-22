import { sql } from 'drizzle-orm';
import { pgTable, text, serial, integer, boolean, json, timestamp, uuid, varchar, index, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  phone: varchar("phone", { length: 20 }),
  password_hash: varchar("password_hash", { length: 255 }),
  full_name: varchar("full_name", { length: 255 }),
  google_id: varchar("google_id"),
  is_creator: boolean("is_creator").default(false), // Dynamic creator status
  
  // Subscription/Trial fields
  account_type: varchar("account_type", { length: 50 }).default("free_trial"), // "free_trial", "monthly", "lifetime"
  trial_ends_at: timestamp("trial_ends_at"), // When the free trial ends
  subscription_status: varchar("subscription_status", { length: 50 }).default("active"), // "active", "cancelled", "expired"
  stripe_customer_id: varchar("stripe_customer_id", { length: 255 }), // Stripe customer ID for billing
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;



// Profile model for user preferences and family info
export const profiles = pgTable("profiles", {
  id: serial("id").primaryKey(),
  user_id: varchar("user_id").references(() => users.id).notNull(),
  profile_name: text("profile_name"), // e.g., "Smith Family" or "Jessica"
  primary_goal: text("primary_goal"), // e.g., "Save Money", "Eat Healthier", "Gain Muscle", "Family Wellness"
  family_size: integer("family_size").default(1),
  members: json("members").default([]), // Array of family member objects
  profile_type: text("profile_type").default("family"), // "individual" or "family"
  preferences: json("preferences").default([]), // For individual profiles
  goals: json("goals").default([]), // For individual profiles
  cultural_background: json("cultural_background").default([]), // Array of cultural cuisine tags
  questionnaire_answers: json("questionnaire_answers").default({}), // Questionnaire answers for smart profile
  questionnaire_selections: json("questionnaire_selections").default([]), // Selected options from questionnaire
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// Family member type definition
export const familyMemberSchema = z.object({
  name: z.string().optional(),
  ageGroup: z.enum(["Child", "Teen", "Adult"]).optional(),
  preferences: z.array(z.string()).default([]), // dietary preferences, allergies, dislikes
  dietaryRestrictions: z.array(z.string()).default([]), // mandatory dietary restrictions for this member
  goals: z.array(z.string()).default([]), // individual goals
});

export const insertProfileSchema = createInsertSchema(profiles).pick({
  user_id: true,
  profile_name: true,
  primary_goal: true,
  family_size: true,
  members: true,
  profile_type: true,
  preferences: true,
  goals: true,
  cultural_background: true,
  questionnaire_answers: true,
  questionnaire_selections: true,
}).extend({
  members: z.array(familyMemberSchema).optional(),
  profile_type: z.enum(["individual", "family"]).optional(),
  preferences: z.array(z.string()).optional(),
  goals: z.array(z.string()).optional(),
  cultural_background: z.array(z.string()).optional(),
  questionnaire_answers: z.record(z.array(z.string())).optional(),
  questionnaire_selections: z.array(z.object({
    questionId: z.string(),
    questionTitle: z.string(),
    optionId: z.string(),
    optionLabel: z.string(),
    optionDescription: z.string(),
  })).optional(),
});

export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Profile = typeof profiles.$inferSelect;
export type FamilyMember = z.infer<typeof familyMemberSchema>;

// Weight-Based Profile System - Simplified approach for better meal planning
export const goalWeightsSchema = z.object({
  cost: z.number().min(0).max(1).default(0.5),        // Save money priority (0-1)
  health: z.number().min(0).max(1).default(0.5),      // Nutrition/wellness priority (0-1)
  cultural: z.number().min(0).max(1).default(0.5),    // Cultural cuisine priority (0-1)
  variety: z.number().min(0).max(1).default(0.5),     // Meal diversity priority (0-1)
  time: z.number().min(0).max(1).default(0.5),        // Quick/easy meal priority (0-1)
});

export const simplifiedUserProfileSchema = z.object({
  // Mandatory (100% compliance)
  dietaryRestrictions: z.array(z.string()).default([]),
  
  // Weight-based priorities
  goalWeights: goalWeightsSchema,
  
  // Basic info
  culturalBackground: z.array(z.string()).default([]),
  familySize: z.number().min(1).max(12).default(1),
  availableIngredients: z.array(z.string()).optional(),
  
  // Optional questionnaire data
  profileName: z.string().optional(),
  questionnaire_answers: z.record(z.array(z.string())).optional(),
  questionnaire_selections: z.array(z.object({
    questionId: z.string(),
    questionTitle: z.string(),
    optionId: z.string(),
    optionLabel: z.string(),
    optionDescription: z.string(),
  })).optional(),
});

export const mealPlanRequestSchema = z.object({
  profile: simplifiedUserProfileSchema,
  numDays: z.number().min(1).max(14).default(7),
  mealsPerDay: z.number().min(1).max(4).default(3),
  maxCookTime: z.number().min(10).max(180).optional(),
  maxDifficulty: z.number().min(1).max(5).optional(),
});

export const weightBasedMealSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  ingredients: z.array(z.string()),
  instructions: z.array(z.string()),
  nutrition: z.object({
    calories: z.number(),
    protein_g: z.number(),
    carbs_g: z.number(),
    fat_g: z.number(),
  }),
  cook_time_minutes: z.number(),
  difficulty: z.number(),
  
  // Weight-based metadata
  objectiveOverlap: z.array(z.string()).default([]),      // Which objectives this meal satisfies
  heroIngredients: z.array(z.string()).default([]),       // Which hero ingredients used
  culturalSource: z.string().optional(),                  // If from predetermined cultural meals
  weightSatisfaction: goalWeightsSchema,                   // How well it satisfies each weight
  adaptationNotes: z.array(z.string()).optional(),        // If meal was adapted from predetermined
});

export type GoalWeights = z.infer<typeof goalWeightsSchema>;
export type SimplifiedUserProfile = z.infer<typeof simplifiedUserProfileSchema>;
export type MealPlanRequest = z.infer<typeof mealPlanRequestSchema>;
export type WeightBasedMeal = z.infer<typeof weightBasedMealSchema>;

// Helper function to merge dietary restrictions from all family members
export function mergeFamilyDietaryRestrictions(members: FamilyMember[]): string[] {
  console.log('🔗 Merging family dietary restrictions from', members.length, 'members');
  const allRestrictions = new Set<string>();
  
  members.forEach((member, index) => {
    console.log(`   Member ${index + 1} (${member.name || 'Unnamed'}):`, {
      dietaryRestrictions: member.dietaryRestrictions || [],
      preferences: member.preferences || []
    });
    
    // Add mandatory dietary restrictions
    if (member.dietaryRestrictions && Array.isArray(member.dietaryRestrictions)) {
      member.dietaryRestrictions.forEach(restriction => {
        if (restriction && restriction.trim()) {
          allRestrictions.add(restriction.trim());
          console.log(`     ✅ Added restriction: "${restriction.trim()}"`);
        }
      });
    }
    
    // Also check preferences for dietary restrictions (backward compatibility)
    if (member.preferences && Array.isArray(member.preferences)) {
      member.preferences.forEach(pref => {
        const lowerPref = pref.toLowerCase().trim();
        // Common dietary restriction keywords
        if (lowerPref.includes('allerg') || lowerPref.includes('intoleran') || 
            lowerPref.includes('free') || lowerPref.includes('vegan') || 
            lowerPref.includes('vegetarian') || lowerPref.includes('kosher') ||
            lowerPref.includes('halal') || lowerPref.includes('diet')) {
          allRestrictions.add(pref.trim());
          console.log(`     ⚠️ Found dietary restriction in preferences: "${pref.trim()}"`);
        }
      });
    }
  });
  
  const finalRestrictions = Array.from(allRestrictions);
  console.log('🔗 Final merged restrictions:', finalRestrictions);
  return finalRestrictions;
}

// Recipe model
export const recipes = pgTable("recipes", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  image_url: text("image_url"),
  time_minutes: integer("time_minutes"),
  cuisine: text("cuisine"),
  diet: text("diet"),
  ingredients: json("ingredients").notNull(),
  instructions: json("instructions").notNull(),
  nutrition_info: json("nutrition_info"),
  video_id: text("video_id"),
  video_title: text("video_title"),
  video_channel: text("video_channel"),
  is_saved: boolean("is_saved").default(false),
  created_at: timestamp("created_at").defaultNow(),
  user_id: varchar("user_id").references(() => users.id),
});

export const insertRecipeSchema = createInsertSchema(recipes).pick({
  title: true,
  description: true,
  image_url: true,
  time_minutes: true,
  cuisine: true,
  diet: true,
  ingredients: true,
  instructions: true,
  nutrition_info: true,
  video_id: true,
  video_title: true,
  video_channel: true,
  is_saved: true,
  user_id: true,
});

export type InsertRecipe = z.infer<typeof insertRecipeSchema>;
export type Recipe = typeof recipes.$inferSelect;

// User-created recipes table for custom recipes created by users
export const userRecipes = pgTable("user_recipes", {
  id: serial("id").primaryKey(),
  user_id: varchar("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  description: text("description"),
  image_url: text("image_url"),
  time_minutes: integer("time_minutes"),
  cuisine: text("cuisine"),
  diet: text("diet"),
  ingredients: json("ingredients").notNull(),
  instructions: json("instructions").notNull(),
  nutrition_info: json("nutrition_info"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userIdx: index("user_recipes_user_idx").on(table.user_id),
}));

export const insertUserRecipeSchema = createInsertSchema(userRecipes).pick({
  user_id: true,
  title: true,
  description: true,
  image_url: true,
  time_minutes: true,
  cuisine: true,
  diet: true,
  ingredients: true,
  instructions: true,
  nutrition_info: true,
});

export type InsertUserRecipe = z.infer<typeof insertUserRecipeSchema>;
export type UserRecipe = typeof userRecipes.$inferSelect;

// Meal plans table for saved meal plans
export const mealPlans = pgTable("meal_plans", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: varchar("name").notNull(),
  description: text("description"),
  mealPlan: json("meal_plan").notNull(),
  isAutoSaved: boolean("is_auto_saved").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type MealPlan = typeof mealPlans.$inferSelect;
export type InsertMealPlan = typeof mealPlans.$inferInsert;

// User favorites table for saving favorite meals
export const userFavorites = pgTable("user_favorites", {
  id: serial("id").primaryKey(),
  user_id: varchar("user_id").notNull().references(() => users.id),
  item_type: varchar("item_type").notNull(), // "recipe", "meal_plan", "youtube_video"
  item_id: varchar("item_id").notNull(), // Foreign key to the item being favorited
  title: text("title").notNull(),
  description: text("description"),
  image_url: text("image_url"),
  time_minutes: integer("time_minutes"),
  cuisine: text("cuisine"),
  diet: text("diet"),
  video_id: text("video_id"), // For YouTube videos
  video_title: text("video_title"),
  video_channel: text("video_channel"),
  metadata: json("metadata"), // Additional data specific to the item type
  created_at: timestamp("created_at").defaultNow(),
}, (table) => ({
  userItemIdx: index("user_favorites_user_item_idx").on(table.user_id, table.item_type, table.item_id),
  userIdx: index("user_favorites_user_idx").on(table.user_id),
}));

export const insertUserFavoriteSchema = createInsertSchema(userFavorites).pick({
  user_id: true,
  item_type: true,
  item_id: true,
  title: true,
  description: true,
  image_url: true,
  time_minutes: true,
  cuisine: true,
  diet: true,
  video_id: true,
  video_title: true,
  video_channel: true,
  metadata: true,
});

export type UserFavorite = typeof userFavorites.$inferSelect;
export type InsertUserFavorite = z.infer<typeof insertUserFavoriteSchema>;

// Global Cultural Cuisine Cache - shared across all users
export const culturalCuisineCache = pgTable("cultural_cuisine_cache", {
  id: serial("id").primaryKey(),
  cuisine_name: text("cuisine_name").notNull(),
  meals_data: json("meals_data").notNull(), // Array of meal objects
  summary_data: json("summary_data").notNull(), // Common ingredients and techniques
  data_version: text("data_version").notNull().default("1.0.0"),
  quality_score: integer("quality_score").default(0),
  access_count: integer("access_count").default(0),
  last_accessed: timestamp("last_accessed").defaultNow(),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
}, (table) => ({
  cuisineNameIdx: index("cuisine_name_idx").on(table.cuisine_name),
}));

export const insertCulturalCuisineCacheSchema = createInsertSchema(culturalCuisineCache).pick({
  cuisine_name: true,
  meals_data: true,
  summary_data: true,
  data_version: true,
  quality_score: true,
});

export type CulturalCuisineCache = typeof culturalCuisineCache.$inferSelect;
export type InsertCulturalCuisineCache = z.infer<typeof insertCulturalCuisineCacheSchema>;

// User saved cultural meals table - personal collections
export const userSavedCulturalMeals = pgTable("user_saved_cultural_meals", {
  id: serial("id").primaryKey(),
  user_id: varchar("user_id").notNull(),
  cuisine_name: text("cuisine_name").notNull(),
  meals_data: json("meals_data").notNull(), // Array of meal objects
  summary_data: json("summary_data").notNull(), // Common ingredients and techniques
  custom_name: text("custom_name"), // User can name their saved collection
  notes: text("notes"), // User notes about the saved meals
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userCuisineIdx: index("user_cuisine_idx").on(table.user_id, table.cuisine_name),
}));

export const insertUserSavedCulturalMealsSchema = createInsertSchema(userSavedCulturalMeals).pick({
  user_id: true,
  cuisine_name: true,
  meals_data: true,
  summary_data: true,
  custom_name: true,
  notes: true,
});

export type UserSavedCulturalMeals = typeof userSavedCulturalMeals.$inferSelect;
export type InsertUserSavedCulturalMeals = z.infer<typeof insertUserSavedCulturalMealsSchema>;

// User achievements table for tracking user progress
export const userAchievements = pgTable("user_achievements", {
  id: serial("id").primaryKey(),
  user_id: varchar("user_id").notNull().references(() => users.id),
  achievement_id: text("achievement_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  is_unlocked: boolean("is_unlocked").default(false),
  progress: integer("progress").default(0),
  max_progress: integer("max_progress").notNull(),
  points: integer("points").notNull(),
  rarity: text("rarity").notNull(), // "common", "rare", "epic", "legendary"
  unlocked_date: timestamp("unlocked_date"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userAchievementIdx: index("user_achievement_idx").on(table.user_id, table.achievement_id),
}));

export const insertUserAchievementSchema = createInsertSchema(userAchievements).pick({
  user_id: true,
  achievement_id: true,
  title: true,
  description: true,
  category: true,
  is_unlocked: true,
  progress: true,
  max_progress: true,
  points: true,
  rarity: true,
  unlocked_date: true,
});

export type UserAchievement = typeof userAchievements.$inferSelect;
export type InsertUserAchievement = z.infer<typeof insertUserAchievementSchema>;

// Meal completions table for tracking completed meals
export const mealCompletions = pgTable("meal_completions", {
  id: serial("id").primaryKey(),
  user_id: varchar("user_id").notNull().references(() => users.id),
  meal_plan_id: integer("meal_plan_id").notNull().references(() => mealPlans.id),
  day_key: text("day_key").notNull(), // e.g., "day_1", "day_2"
  meal_type: text("meal_type").notNull(), // "breakfast", "lunch", "dinner", "snack"
  is_completed: boolean("is_completed").default(false),
  completed_at: timestamp("completed_at"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userMealIdx: index("user_meal_idx").on(table.user_id, table.meal_plan_id, table.day_key, table.meal_type),
}));

export const insertMealCompletionSchema = createInsertSchema(mealCompletions).pick({
  user_id: true,
  meal_plan_id: true,
  day_key: true,
  meal_type: true,
  is_completed: true,
  completed_at: true,
});

export type MealCompletion = typeof mealCompletions.$inferSelect;
export type InsertMealCompletion = z.infer<typeof insertMealCompletionSchema>;

// Grocery List Cache table for storing pre-calculated shopping lists
export const groceryListCache = pgTable("grocery_list_cache", {
  id: serial("id").primaryKey(),
  meal_plan_id: integer("meal_plan_id").notNull().references(() => mealPlans.id),
  user_id: varchar("user_id").notNull().references(() => users.id),
  consolidated_ingredients: json("consolidated_ingredients").notNull(), // Pre-calculated consolidated ingredients
  shopping_url: text("shopping_url"), // Cached Instacart URL
  savings: json("savings"), // Savings information
  recommendations: json("recommendations"), // Shopping recommendations
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
  expires_at: timestamp("expires_at"), // Optional expiration for cache invalidation
}, (table) => ({
  mealPlanIdx: index("grocery_cache_meal_plan_idx").on(table.meal_plan_id),
  userIdx: index("grocery_cache_user_idx").on(table.user_id),
}));

export const insertGroceryListCacheSchema = createInsertSchema(groceryListCache).pick({
  meal_plan_id: true,
  user_id: true,
  consolidated_ingredients: true,
  shopping_url: true,
  savings: true,
  recommendations: true,
  expires_at: true,
});

export type GroceryListCache = typeof groceryListCache.$inferSelect;
export type InsertGroceryListCache = z.infer<typeof insertGroceryListCacheSchema>;

// Food logs table for calorie tracking
export const foodLogs = pgTable("food_logs", {
  id: serial("id").primaryKey(),
  user_id: varchar("user_id").notNull().references(() => users.id),
  image_url: text("image_url"), // Store photo reference
  foods: json("foods").notNull(), // Array of detected/added foods
  total_calories: integer("total_calories").notNull(),
  total_protein: integer("total_protein"),
  total_carbs: integer("total_carbs"),
  total_fat: integer("total_fat"),
  meal_type: text("meal_type"), // breakfast, lunch, dinner, snack
  logged_at: timestamp("logged_at").defaultNow(),
  created_at: timestamp("created_at").defaultNow(),
}, (table) => ({
  userIdx: index("food_logs_user_idx").on(table.user_id),
  loggedAtIdx: index("food_logs_logged_at_idx").on(table.logged_at),
}));

export const insertFoodLogSchema = createInsertSchema(foodLogs).pick({
  user_id: true,
  image_url: true,
  foods: true,
  total_calories: true,
  total_protein: true,
  total_carbs: true,
  total_fat: true,
  meal_type: true,
  logged_at: true,
});

export type FoodLog = typeof foodLogs.$inferSelect;
export type InsertFoodLog = z.infer<typeof insertFoodLogSchema>;

// Local food database for quick calorie lookups
export const foodDatabase = pgTable("food_database", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  calories_per_100g: integer("calories_per_100g").notNull(),
  protein_per_100g: integer("protein_per_100g"),
  carbs_per_100g: integer("carbs_per_100g"),
  fat_per_100g: integer("fat_per_100g"),
  common_portion: integer("common_portion").default(100), // typical serving in grams
  category: text("category"), // fruit, vegetable, meat, etc.
  created_at: timestamp("created_at").defaultNow(),
}, (table) => ({
  nameIdx: index("food_database_name_idx").on(table.name),
}));

export const insertFoodDatabaseSchema = createInsertSchema(foodDatabase).pick({
  name: true,
  calories_per_100g: true,
  protein_per_100g: true,
  carbs_per_100g: true,
  fat_per_100g: true,
  common_portion: true,
  category: true,
});

export type FoodDatabaseItem = typeof foodDatabase.$inferSelect;
export type InsertFoodDatabaseItem = z.infer<typeof insertFoodDatabaseSchema>;

// ============================================
// COMMUNITY TABLES FOR MEAL PLAN SHARING
// ============================================

// Communities table
export const communities = pgTable("communities", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description").notNull(),
  creator_id: varchar("creator_id").notNull().references(() => users.id),
  cover_image: text("cover_image"),
  category: text("category").notNull(), // "budget", "family", "cultural", "health", etc.
  member_count: integer("member_count").default(0),
  is_public: boolean("is_public").default(true),
  settings: json("settings").default({}),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
}, (table) => ({
  creatorIdx: index("communities_creator_idx").on(table.creator_id),
  categoryIdx: index("communities_category_idx").on(table.category),
}));

// Community members table
export const communityMembers = pgTable("community_members", {
  id: serial("id").primaryKey(),
  community_id: integer("community_id").notNull().references(() => communities.id),
  user_id: varchar("user_id").notNull().references(() => users.id),
  role: text("role").notNull().default("member"), // "creator", "moderator", "member"
  points: integer("points").default(0),
  level: integer("level").default(1),
  joined_at: timestamp("joined_at").defaultNow(),
}, (table) => ({
  communityUserIdx: index("community_user_idx").on(table.community_id, table.user_id),
  userIdx: index("community_members_user_idx").on(table.user_id),
}));

// Shared meal plans table
export const sharedMealPlans = pgTable("shared_meal_plans", {
  id: serial("id").primaryKey(),
  community_id: integer("community_id").notNull().references(() => communities.id),
  meal_plan_id: integer("meal_plan_id").notNull().references(() => mealPlans.id),
  sharer_id: varchar("sharer_id").notNull().references(() => users.id),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  tags: json("tags").default([]), // ["budget-friendly", "quick", "family", etc.]
  preview_images: json("preview_images").default([]), // Array of image URLs
  metrics: json("metrics").default({}), // {cost_per_serving, prep_time, difficulty, nutrition_score}
  likes: integer("likes").default(0),
  tries: integer("tries").default(0),
  success_rate: integer("success_rate"), // percentage 0-100
  is_featured: boolean("is_featured").default(false),
  created_at: timestamp("created_at").defaultNow(),
}, (table) => ({
  communityIdx: index("shared_plans_community_idx").on(table.community_id),
  sharerIdx: index("shared_plans_sharer_idx").on(table.sharer_id),
  featuredIdx: index("shared_plans_featured_idx").on(table.is_featured),
}));

// Meal plan reviews table
export const mealPlanReviews = pgTable("meal_plan_reviews", {
  id: serial("id").primaryKey(),
  shared_plan_id: integer("shared_plan_id").notNull().references(() => sharedMealPlans.id),
  reviewer_id: varchar("reviewer_id").notNull().references(() => users.id),
  rating: integer("rating").notNull(), // 1-5 stars
  comment: text("comment"),
  images: json("images").default([]), // Array of result photo URLs
  tried_it: boolean("tried_it").default(false),
  modifications: text("modifications"), // What they changed
  helpful_count: integer("helpful_count").default(0),
  created_at: timestamp("created_at").defaultNow(),
}, (table) => ({
  planIdx: index("reviews_plan_idx").on(table.shared_plan_id),
  reviewerIdx: index("reviews_reviewer_idx").on(table.reviewer_id),
}));

// Meal plan remixes table
export const mealPlanRemixes = pgTable("meal_plan_remixes", {
  id: serial("id").primaryKey(),
  original_plan_id: integer("original_plan_id").notNull().references(() => sharedMealPlans.id),
  remixer_id: varchar("remixer_id").notNull().references(() => users.id),
  remixed_plan_id: integer("remixed_plan_id").notNull().references(() => mealPlans.id),
  community_id: integer("community_id").references(() => communities.id),
  changes_made: json("changes_made").notNull(), // Description of modifications
  created_at: timestamp("created_at").defaultNow(),
}, (table) => ({
  originalIdx: index("remixes_original_idx").on(table.original_plan_id),
  remixerIdx: index("remixes_remixer_idx").on(table.remixer_id),
}));

// Community discussions table
export const communityDiscussions = pgTable("community_discussions", {
  id: serial("id").primaryKey(),
  community_id: integer("community_id").notNull().references(() => communities.id),
  meal_plan_id: integer("meal_plan_id").references(() => sharedMealPlans.id),
  author_id: varchar("author_id").notNull().references(() => users.id),
  parent_id: integer("parent_id"), // For threaded discussions
  content: text("content").notNull(),
  likes: integer("likes").default(0),
  is_pinned: boolean("is_pinned").default(false),
  created_at: timestamp("created_at").defaultNow(),
}, (table) => ({
  communityIdx: index("discussions_community_idx").on(table.community_id),
  planIdx: index("discussions_plan_idx").on(table.meal_plan_id),
  authorIdx: index("discussions_author_idx").on(table.author_id),
}));

// Creator profiles table
export const creatorProfiles = pgTable("creator_profiles", {
  id: serial("id").primaryKey(),
  user_id: varchar("user_id").notNull().references(() => users.id).unique(),
  bio: text("bio"),
  specialties: json("specialties").default([]), // ["budget meals", "family cooking", etc.]
  certifications: json("certifications").default([]), // Professional credentials
  follower_count: integer("follower_count").default(0),
  total_plans_shared: integer("total_plans_shared").default(0),
  average_rating: integer("average_rating"), // Out of 5
  verified_nutritionist: boolean("verified_nutritionist").default(false),
  social_links: json("social_links").default({}),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userIdx: index("creator_profiles_user_idx").on(table.user_id),
}));

// Creator followers table
export const creatorFollowers = pgTable("creator_followers", {
  id: serial("id").primaryKey(),
  creator_id: varchar("creator_id").notNull().references(() => users.id),
  follower_id: varchar("follower_id").notNull().references(() => users.id),
  followed_at: timestamp("followed_at").defaultNow(),
}, (table) => ({
  creatorFollowerIdx: index("creator_follower_idx").on(table.creator_id, table.follower_id),
  followerIdx: index("followers_follower_idx").on(table.follower_id),
}));

// Community challenges table
export const communityChallenges = pgTable("community_challenges", {
  id: serial("id").primaryKey(),
  community_id: integer("community_id").notNull().references(() => communities.id),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  requirements: json("requirements").notNull(), // Challenge criteria
  start_date: timestamp("start_date").notNull(),
  end_date: timestamp("end_date").notNull(),
  prize_description: text("prize_description"),
  submissions: json("submissions").default([]), // Array of submission IDs
  winner_id: varchar("winner_id").references(() => users.id),
  created_at: timestamp("created_at").defaultNow(),
}, (table) => ({
  communityIdx: index("challenges_community_idx").on(table.community_id),
  dateIdx: index("challenges_date_idx").on(table.start_date, table.end_date),
}));

// Community posts table for general discussions, questions, announcements, etc.
export const communityPosts = pgTable("community_posts", {
  id: serial("id").primaryKey(),
  community_id: integer("community_id").notNull().references(() => communities.id),
  author_id: varchar("author_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  post_type: text("post_type").notNull().default("discussion"), // "discussion", "question", "announcement", "meal_share"
  meal_plan_id: integer("meal_plan_id").references(() => mealPlans.id), // For meal share posts
  recipe_data: text("recipe_data"), // JSON string of recipe data for meal_share posts
  images: text("images"), // JSON string of image URLs
  likes: integer("likes").default(0),
  comments_count: integer("comments_count").default(0),
  is_pinned: boolean("is_pinned").default(false),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
}, (table) => ({
  communityIdx: index("community_posts_community_idx").on(table.community_id),
  authorIdx: index("community_posts_author_idx").on(table.author_id),
  typeIdx: index("community_posts_type_idx").on(table.post_type),
  createdIdx: index("community_posts_created_idx").on(table.created_at),
}));

// Community post comments table
export const communityPostComments = pgTable("community_post_comments", {
  id: serial("id").primaryKey(),
  post_id: integer("post_id").notNull().references(() => communityPosts.id, { onDelete: "cascade" }),
  author_id: varchar("author_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  parent_id: integer("parent_id"), // For nested replies
  images: text("images"), // JSON string of image URLs (same as posts)
  likes: integer("likes").default(0),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
}, (table) => ({
  postIdx: index("post_comments_post_idx").on(table.post_id),
  authorIdx: index("post_comments_author_idx").on(table.author_id),
  parentIdx: index("post_comments_parent_idx").on(table.parent_id),
}));

// Community post likes table
export const communityPostLikes = pgTable("community_post_likes", {
  id: serial("id").primaryKey(),
  post_id: integer("post_id").references(() => communityPosts.id, { onDelete: "cascade" }),
  user_id: varchar("user_id").notNull().references(() => users.id),
  created_at: timestamp("created_at").defaultNow(),
}, (table) => ({
  postUserIdx: index("post_likes_post_user_idx").on(table.post_id, table.user_id),
}));

// Community comment likes table
export const communityCommentLikes = pgTable("community_comment_likes", {
  id: serial("id").primaryKey(),
  comment_id: integer("comment_id").notNull().references(() => communityPostComments.id, { onDelete: "cascade" }),
  user_id: varchar("user_id").notNull().references(() => users.id),
  created_at: timestamp("created_at").defaultNow(),
}, (table) => ({
  commentUserIdx: index("comment_likes_comment_user_idx").on(table.comment_id, table.user_id),
}));

// Type exports for community tables
export type Community = typeof communities.$inferSelect;
export type InsertCommunity = typeof communities.$inferInsert;

export type CommunityMember = typeof communityMembers.$inferSelect;
export type InsertCommunityMember = typeof communityMembers.$inferInsert;

export type SharedMealPlan = typeof sharedMealPlans.$inferSelect;
export type InsertSharedMealPlan = typeof sharedMealPlans.$inferInsert;

// Community Meal Courses table (like Skool's Classroom structure)
export const communityMealCourses = pgTable("community_meal_courses", {
  id: serial("id").primaryKey(),
  community_id: integer("community_id").notNull().references(() => communities.id),
  creator_id: varchar("creator_id").notNull().references(() => users.id),
  title: varchar("title", { length: 255 }).notNull(),
  emoji: varchar("emoji", { length: 10 }), // Optional emoji for the course
  description: text("description"),
  cover_image: text("cover_image"),
  category: varchar("category", { length: 100 }), // "beginner", "intermediate", "advanced"
  lesson_count: integer("lesson_count").default(0),
  total_duration: integer("total_duration").default(0), // total cook time in minutes
  is_published: boolean("is_published").default(false),
  display_order: integer("display_order").default(0),
  drip_enabled: boolean("drip_enabled").default(false), // Enable drip content
  drip_days: json("drip_days").default([]), // Days after enrollment when lessons unlock
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
}, (table) => ({
  communityIdx: index("meal_courses_community_idx").on(table.community_id),
  creatorIdx: index("meal_courses_creator_idx").on(table.creator_id),
  publishedIdx: index("meal_courses_published_idx").on(table.is_published),
}));

// Community Meal Lessons table (individual meal plans within a course)
export const communityMealLessons = pgTable("community_meal_lessons", {
  id: serial("id").primaryKey(),
  course_id: integer("course_id").notNull().references(() => communityMealCourses.id, { onDelete: "cascade" }),
  module_id: integer("module_id").references(() => communityMealCourseModules.id, { onDelete: "set null" }), // Optional module grouping
  title: varchar("title", { length: 255 }).notNull(),
  emoji: varchar("emoji", { length: 10 }), // Optional emoji for the lesson
  description: text("description"),
  video_url: text("video_url"), // Direct video URL for lesson
  ingredients: json("ingredients").notNull().default([]), // Array of ingredient strings
  instructions: json("instructions").notNull().default([]), // Array of instruction strings
  image_url: text("image_url"),
  youtube_video_id: varchar("youtube_video_id", { length: 50 }),
  prep_time: integer("prep_time").default(0), // minutes
  cook_time: integer("cook_time").default(0), // minutes
  servings: integer("servings").default(4),
  difficulty_level: integer("difficulty_level").default(1), // 1-5
  nutrition_info: json("nutrition_info").default({}), // {calories, protein, carbs, fat}
  lesson_order: integer("lesson_order").notNull(),
  is_published: boolean("is_published").default(false),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
}, (table) => ({
  courseIdx: index("meal_lessons_course_idx").on(table.course_id),
  orderIdx: index("meal_lessons_order_idx").on(table.course_id, table.lesson_order),
  publishedIdx: index("meal_lessons_published_idx").on(table.is_published),
}));

// Community Meal Course Modules (Sets/Sections within a course)
export const communityMealCourseModules = pgTable("community_meal_course_modules", {
  id: serial("id").primaryKey(),
  course_id: integer("course_id").notNull().references(() => communityMealCourses.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  emoji: varchar("emoji", { length: 10 }), // Optional emoji for the module
  description: text("description"),
  cover_image: text("cover_image"), // Optional cover image URL for the module
  module_order: integer("module_order").notNull(),
  is_expanded: boolean("is_expanded").default(false), // Whether module is expanded by default
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
}, (table) => ({
  courseIdx: index("meal_modules_course_idx").on(table.course_id),
  orderIdx: index("meal_modules_order_idx").on(table.course_id, table.module_order),
}));

// Lesson Sections table (About This Lesson, Key Takeaways, etc.)
export const communityMealLessonSections = pgTable("community_meal_lesson_sections", {
  id: serial("id").primaryKey(),
  lesson_id: integer("lesson_id").notNull().references(() => communityMealLessons.id, { onDelete: "cascade" }),
  section_type: varchar("section_type", { length: 50 }).notNull(), // "about", "key_takeaways", "action_steps", "custom"
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  template_id: varchar("template_id", { length: 50 }), // "meal_prep", "shopping_guide", "techniques", "nutrition", "time_management", "cultural"
  display_order: integer("display_order").notNull(),
  is_visible: boolean("is_visible").default(true),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
}, (table) => ({
  lessonIdx: index("lesson_sections_lesson_idx").on(table.lesson_id),
  orderIdx: index("lesson_sections_order_idx").on(table.lesson_id, table.display_order),
}));

// User progress tracking for meal courses
export const userMealCourseProgress = pgTable("user_meal_course_progress", {
  id: serial("id").primaryKey(),
  user_id: varchar("user_id").notNull().references(() => users.id),
  course_id: integer("course_id").notNull().references(() => communityMealCourses.id, { onDelete: "cascade" }),
  completed_lessons: json("completed_lessons").default([]), // Array of lesson IDs
  current_lesson_id: integer("current_lesson_id"),
  progress_percentage: integer("progress_percentage").default(0), // 0-100
  started_at: timestamp("started_at").defaultNow(),
  last_accessed: timestamp("last_accessed").defaultNow(),
}, (table) => ({
  userCourseIdx: index("progress_user_course_idx").on(table.user_id, table.course_id),
  userIdx: index("progress_user_idx").on(table.user_id),
}));

export type CommunityMealCourse = typeof communityMealCourses.$inferSelect;
export type InsertCommunityMealCourse = typeof communityMealCourses.$inferInsert;
export type CommunityMealCourseModule = typeof communityMealCourseModules.$inferSelect;
export type InsertCommunityMealCourseModule = typeof communityMealCourseModules.$inferInsert;
export type CommunityMealLesson = typeof communityMealLessons.$inferSelect;
export type InsertCommunityMealLesson = typeof communityMealLessons.$inferInsert;
export type CommunityMealLessonSection = typeof communityMealLessonSections.$inferSelect;
export type InsertCommunityMealLessonSection = typeof communityMealLessonSections.$inferInsert;
export type UserMealCourseProgress = typeof userMealCourseProgress.$inferSelect;
export type InsertUserMealCourseProgress = typeof userMealCourseProgress.$inferInsert;

export type MealPlanReview = typeof mealPlanReviews.$inferSelect;
export type InsertMealPlanReview = typeof mealPlanReviews.$inferInsert;

export type MealPlanRemix = typeof mealPlanRemixes.$inferSelect;
export type InsertMealPlanRemix = typeof mealPlanRemixes.$inferInsert;

export type CommunityDiscussion = typeof communityDiscussions.$inferSelect;
export type InsertCommunityDiscussion = typeof communityDiscussions.$inferInsert;

export type CreatorProfile = typeof creatorProfiles.$inferSelect;
export type InsertCreatorProfile = typeof creatorProfiles.$inferInsert;

export type CreatorFollower = typeof creatorFollowers.$inferSelect;
export type InsertCreatorFollower = typeof creatorFollowers.$inferInsert;

export type CommunityChallenge = typeof communityChallenges.$inferSelect;
export type InsertCommunityChallenge = typeof communityChallenges.$inferInsert;

export type CommunityPost = typeof communityPosts.$inferSelect;
export type InsertCommunityPost = typeof communityPosts.$inferInsert;

export type CommunityPostComment = typeof communityPostComments.$inferSelect;
export type InsertCommunityPostComment = typeof communityPostComments.$inferInsert;

export type CommunityPostLike = typeof communityPostLikes.$inferSelect;
export type InsertCommunityPostLike = typeof communityPostLikes.$inferInsert;

// ============================================
// COMMUNITY CHAT + MEMORY TABLES
// ============================================

// Per-user, per-community chat session
export const chatSessions = pgTable("chat_sessions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  user_id: varchar("user_id").notNull().references(() => users.id),
  community_id: integer("community_id").notNull().references(() => communities.id),
  title: varchar("title", { length: 255 }),
  created_at: timestamp("created_at").defaultNow(),
  last_message_at: timestamp("last_message_at").defaultNow(),
}, (table) => ({
  userCommunityIdx: index("chat_sessions_user_community_idx").on(table.user_id, table.community_id),
}));

// Messages inside a session
export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  session_id: uuid("session_id").notNull().references(() => chatSessions.id, { onDelete: "cascade" }),
  community_id: integer("community_id").notNull().references(() => communities.id),
  user_id: varchar("user_id"), // nullable for assistant/system
  role: varchar("role", { length: 20 }).notNull(), // 'user' | 'assistant' | 'system'
  content: text("content").notNull(),
  token_count: integer("token_count"),
  metadata: jsonb("metadata").default({}),
  created_at: timestamp("created_at").defaultNow(),
}, (table) => ({
  sessionIdx: index("chat_messages_session_idx").on(table.session_id),
  communityIdx: index("chat_messages_community_idx").on(table.community_id),
}));

// Creator-configured AI settings per community
export const communityAIConfigs = pgTable("community_ai_configs", {
  id: serial("id").primaryKey(),
  community_id: integer("community_id").notNull().references(() => communities.id).unique(),
  system_prompt: text("system_prompt").notNull(),
  model: varchar("model", { length: 64 }).default("gpt-4o-mini"),
  temperature: integer("temperature").default(7), // 0-10 scale
  max_tokens: integer("max_tokens").default(800),
  top_p: integer("top_p").default(10), // 0-10 scale
  frequency_penalty: integer("frequency_penalty").default(0), // 0-20 scale (0-2.0 actual)
  presence_penalty: integer("presence_penalty").default(0), // 0-20 scale (0-2.0 actual)
  stop_sequences: jsonb("stop_sequences").default([]), // Array of stop strings
  response_format: varchar("response_format", { length: 20 }).default("text"), // "text" | "json"
  tools: jsonb("tools").default([]),
  memory_enabled: boolean("memory_enabled").default(true),
  short_term_limit: integer("short_term_limit").default(20),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// Short-term memory for chat sessions (rolling window)
export const chatSessionMemory = pgTable("chat_session_memory", {
  id: serial("id").primaryKey(),
  session_id: uuid("session_id").notNull().references(() => chatSessions.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 20 }).notNull(), // 'user' | 'assistant' | 'system'
  content: text("content").notNull(),
  token_count: integer("token_count"),
  sequence_order: integer("sequence_order").notNull(), // Order within session
  created_at: timestamp("created_at").defaultNow(),
}, (table) => ({
  sessionIdx: index("session_memory_session_idx").on(table.session_id),
  orderIdx: index("session_memory_order_idx").on(table.session_id, table.sequence_order),
}));

// Chat analytics for tracking usage and performance
export const chatAnalytics = pgTable("chat_analytics", {
  id: serial("id").primaryKey(),
  community_id: integer("community_id").notNull().references(() => communities.id),
  user_id: varchar("user_id").references(() => users.id),
  session_id: uuid("session_id").references(() => chatSessions.id, { onDelete: "cascade" }),
  model_used: varchar("model_used", { length: 64 }),
  tokens_input: integer("tokens_input").default(0),
  tokens_output: integer("tokens_output").default(0),
  response_time_ms: integer("response_time_ms"),
  error_type: varchar("error_type", { length: 100 }), // null if successful
  user_rating: integer("user_rating"), // 1-5 stars, optional feedback
  cost_estimate: integer("cost_estimate"), // Cost in cents
  created_at: timestamp("created_at").defaultNow(),
}, (table) => ({
  communityIdx: index("analytics_community_idx").on(table.community_id),
  userIdx: index("analytics_user_idx").on(table.user_id),
  sessionIdx: index("analytics_session_idx").on(table.session_id),
  dateIdx: index("analytics_date_idx").on(table.created_at),
}));

// Cookbook entries (chunked knowledge) per community
export const cookbookEntries = pgTable("cookbook_entries", {
  id: serial("id").primaryKey(),
  community_id: integer("community_id").notNull().references(() => communities.id),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  tags: jsonb("tags").default([]),
  embedding: jsonb("embedding"), // float[] stored as JSON
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
}, (table) => ({
  communityIdx: index("cookbook_community_idx").on(table.community_id),
  titleIdx: index("cookbook_title_idx").on(table.title),
}));

// Long-term, community-scoped memory per user
export const communityMemoryItems = pgTable("community_memory_items", {
  id: serial("id").primaryKey(),
  user_id: varchar("user_id").notNull().references(() => users.id),
  community_id: integer("community_id").notNull().references(() => communities.id),
  memory_type: varchar("memory_type", { length: 40 }).notNull(), // 'fact' | 'preference' | 'summary' | 'note'
  content: text("content").notNull(),
  embedding: jsonb("embedding"), // Vector embedding for semantic search
  importance_score: integer("importance_score").default(50), // 0-100, higher = more important
  access_count: integer("access_count").default(0), // How often this memory is accessed
  last_accessed: timestamp("last_accessed").defaultNow(),
  decay_factor: integer("decay_factor").default(100), // 0-100, decreases over time
  metadata: jsonb("metadata").default({}),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userCommunityIdx: index("memory_user_community_idx").on(table.user_id, table.community_id),
  importanceIdx: index("memory_importance_idx").on(table.importance_score),
  typeIdx: index("memory_type_idx").on(table.memory_type),
  accessIdx: index("memory_access_idx").on(table.last_accessed),
}));

// Type exports for chat + memory
export type ChatSession = typeof chatSessions.$inferSelect;
export type InsertChatSession = typeof chatSessions.$inferInsert;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;
export type ChatSessionMemory = typeof chatSessionMemory.$inferSelect;
export type InsertChatSessionMemory = typeof chatSessionMemory.$inferInsert;
export type ChatAnalytics = typeof chatAnalytics.$inferSelect;
export type InsertChatAnalytics = typeof chatAnalytics.$inferInsert;
export type CommunityAIConfig = typeof communityAIConfigs.$inferSelect;
export type InsertCommunityAIConfig = typeof communityAIConfigs.$inferInsert;
export type CookbookEntry = typeof cookbookEntries.$inferSelect;
export type InsertCookbookEntry = typeof cookbookEntries.$inferInsert;
export type CommunityMemoryItem = typeof communityMemoryItems.$inferSelect;
export type InsertCommunityMemoryItem = typeof communityMemoryItems.$inferInsert;

// Storage interfaces
export interface IStorage {
  // User operations
  // (IMPORTANT) these user operations are mandatory for Replit Auth.
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Recipe methods
  createRecipe(recipe: InsertRecipe): Promise<Recipe>;
  getRecipe(id: number): Promise<Recipe | undefined>;
  getPopularRecipes(): Promise<Recipe[]>;
  getSavedRecipes(userId?: string): Promise<Recipe[]>;
  getGeneratedRecipes(userId?: string): Promise<Recipe[]>;
  saveRecipe(id: number): Promise<Recipe | undefined>;
  unsaveRecipe(id: number): Promise<void>;
  
  // Meal plan methods
  getSavedMealPlans(userId: string): Promise<MealPlan[]>;
  saveMealPlan(data: {
    userId: string;
    name: string;
    description: string;
    mealPlan: any;
  }): Promise<MealPlan>;
  updateMealPlan(planId: number, userId: string, data: {
    name: string;
    description: string;
    mealPlan: any;
  }): Promise<MealPlan | null>;
  getMealPlan(planId: number, userId: string): Promise<MealPlan | null>;
  deleteMealPlan(planId: number, userId: string): Promise<boolean>;

  // Profile methods
  getProfile(userId: string): Promise<Profile | undefined>;
  createProfile(profile: InsertProfile): Promise<Profile>;
  updateProfile(userId: string, profile: Partial<InsertProfile>): Promise<Profile | null>;
  
  // Achievement methods
  getUserAchievements(userId: string): Promise<UserAchievement[]>;
  initializeUserAchievements(userId: string): Promise<UserAchievement[]>;
  updateUserAchievement(userId: string, achievementId: string, data: {
    progress?: number;
    is_unlocked?: boolean;
    unlocked_date?: Date;
  }): Promise<UserAchievement | null>;
  getUserAchievement(userId: string, achievementId: string): Promise<UserAchievement | null>;

  // Meal completion methods
  getMealCompletions(userId: string, mealPlanId: number): Promise<MealCompletion[]>;
  toggleMealCompletion(userId: string, mealPlanId: number, dayKey: string, mealType: string): Promise<MealCompletion>;
  getMealCompletion(userId: string, mealPlanId: number, dayKey: string, mealType: string): Promise<MealCompletion | null>;
  completeMealPlan(userId: string, mealPlanId: number): Promise<MealPlan | null>;
  
  // Grocery list cache methods
  getGroceryListCache(mealPlanId: number, userId: string): Promise<GroceryListCache | null>;
  saveGroceryListCache(data: InsertGroceryListCache): Promise<GroceryListCache>;
  deleteGroceryListCache(mealPlanId: number, userId: string): Promise<boolean>;
  
  // Food log methods for calorie tracking
  createFoodLog(data: InsertFoodLog): Promise<FoodLog>;
  getFoodLogs(userId: string, date?: Date): Promise<FoodLog[]>;
  getFoodLogsByDateRange(userId: string, startDate: Date, endDate: Date): Promise<FoodLog[]>;
  deleteFoodLog(id: number, userId: string): Promise<boolean>;
  
  // Food database methods
  searchFoodDatabase(query: string): Promise<FoodDatabaseItem[]>;
  getFoodDatabaseItem(name: string): Promise<FoodDatabaseItem | null>;
  createFoodDatabaseItem(data: InsertFoodDatabaseItem): Promise<FoodDatabaseItem>;
  
  // Favorites methods
  getUserFavorites(userId: string): Promise<UserFavorite[]>;
  addToFavorites(data: InsertUserFavorite): Promise<UserFavorite>;
  removeFromFavorites(userId: string, itemType: string, itemId: string): Promise<boolean>;
  isFavorited(userId: string, itemType: string, itemId: string): Promise<boolean>;
}

// Extend MemStorage in storage.ts to include recipe functionality
