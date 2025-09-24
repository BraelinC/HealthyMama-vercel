import { db } from "./db";
import { 
  sharedMealPlans,
  mealPlans,
  mealPlanRemixes,
  communityDiscussions,
  profiles,
  users,
  type SharedMealPlan,
  type MealPlan,
  type InsertSharedMealPlan,
  type InsertMealPlanRemix,
} from "@shared/schema";
import { eq, and, desc, sql, inArray, gte } from "drizzle-orm";

export class MealPlanSharingService {
  // Prepare a meal plan for sharing (remove personal data, calculate metrics)
  async prepareMealPlanForSharing(mealPlanId: number, userId: string): Promise<{
    mealPlan: any;
    metrics: {
      cost_per_serving: number;
      total_prep_time: number;
      average_difficulty: number;
      nutrition_score: number;
      total_calories: number;
      total_recipes: number;
    };
    preview_images: string[];
    tags: string[];
  }> {
    // Get the meal plan
    const [plan] = await db.select()
      .from(mealPlans)
      .where(and(
        eq(mealPlans.id, mealPlanId),
        eq(mealPlans.userId, userId)
      ));

    if (!plan) {
      throw new Error("Meal plan not found or you don't have permission");
    }

    const mealPlanData = plan.mealPlan as any;

    // Calculate metrics
    let totalCost = 0;
    let totalPrepTime = 0;
    let totalDifficulty = 0;
    let totalCalories = 0;
    let recipeCount = 0;
    const previewImages: string[] = [];
    const tags = new Set<string>();

    // Process each day's meals
    for (const dayKey in mealPlanData) {
      const day = mealPlanData[dayKey];
      if (day && typeof day === 'object') {
        for (const mealType in day) {
          const meal = day[mealType];
          if (meal && typeof meal === 'object') {
            recipeCount++;
            
            // Extract metrics
            if (meal.estimatedCost) totalCost += parseFloat(meal.estimatedCost);
            if (meal.cookingTime) totalPrepTime += parseInt(meal.cookingTime);
            if (meal.difficulty) totalDifficulty += meal.difficulty;
            if (meal.nutritionInfo?.calories) totalCalories += meal.nutritionInfo.calories;
            
            // Get preview images (first 3)
            if (meal.imageUrl && previewImages.length < 3) {
              previewImages.push(meal.imageUrl);
            }
            
            // Extract tags
            if (meal.cuisine) tags.add(meal.cuisine.toLowerCase());
            if (meal.dietType) tags.add(meal.dietType.toLowerCase());
            if (totalPrepTime <= 30) tags.add("quick");
            if (totalCost / recipeCount < 5) tags.add("budget-friendly");
          }
        }
      }
    }

    // Calculate averages and scores
    const avgServings = 4; // Default assumption
    const metrics = {
      cost_per_serving: recipeCount > 0 ? Math.round((totalCost / recipeCount / avgServings) * 100) / 100 : 0,
      total_prep_time: totalPrepTime,
      average_difficulty: recipeCount > 0 ? Math.round(totalDifficulty / recipeCount) : 1,
      nutrition_score: this.calculateNutritionScore(totalCalories / recipeCount),
      total_calories: Math.round(totalCalories),
      total_recipes: recipeCount,
    };

    // Add metric-based tags
    if (metrics.cost_per_serving < 3) tags.add("ultra-budget");
    if (metrics.average_difficulty <= 2) tags.add("beginner-friendly");
    if (metrics.nutrition_score >= 80) tags.add("nutritious");

    // Remove personal data from meal plan
    const sanitizedMealPlan = this.sanitizeMealPlan(mealPlanData);

    return {
      mealPlan: sanitizedMealPlan,
      metrics,
      preview_images: previewImages,
      tags: Array.from(tags),
    };
  }

  // Share a meal plan to a community
  async shareMealPlan(
    userId: string,
    communityId: number,
    mealPlanId: number,
    title: string,
    description?: string
  ): Promise<SharedMealPlan> {
    // Prepare the meal plan
    const prepared = await this.prepareMealPlanForSharing(mealPlanId, userId);

    // Create the shared meal plan
    const [shared] = await db.insert(sharedMealPlans)
      .values({
        community_id: communityId,
        meal_plan_id: mealPlanId,
        sharer_id: userId,
        title,
        description,
        tags: prepared.tags,
        preview_images: prepared.preview_images,
        metrics: prepared.metrics,
        likes: 0,
        tries: 0,
        success_rate: null,
        is_featured: false,
      })
      .returning();

    return shared;
  }

  // Remix a shared meal plan
  async remixMealPlan(
    userId: string,
    originalPlanId: number,
    remixedMealPlanId: number,
    changes: any,
    communityId?: number
  ): Promise<any> {
    // Verify the original plan exists
    const [original] = await db.select()
      .from(sharedMealPlans)
      .where(eq(sharedMealPlans.id, originalPlanId));

    if (!original) {
      throw new Error("Original shared plan not found");
    }

    // Create the remix record
    const [remix] = await db.insert(mealPlanRemixes)
      .values({
        original_plan_id: originalPlanId,
        remixer_id: userId,
        remixed_plan_id: remixedMealPlanId,
        community_id: communityId,
        changes_made: changes,
      })
      .returning();

    return remix;
  }

  // Get personalized meal plan recommendations
  async getRecommendedMealPlans(userId: string, limit: number = 10) {
    // Get user profile to understand preferences
    const [profile] = await db.select()
      .from(profiles)
      .where(eq(profiles.user_id, userId));

    if (!profile) {
      // No profile, return trending plans
      return this.getTrendingMealPlans(limit);
    }

    // Get plans that match user preferences
    const allPlans = await db.select()
      .from(sharedMealPlans)
      .orderBy(desc(sharedMealPlans.created_at))
      .limit(limit * 3); // Get more to filter

    // Score and sort plans based on user preferences
    const scoredPlans = allPlans.map(plan => {
      let score = 0;
      
      // Check cultural match
      const cultural = profile.cultural_background as string[] || [];
      const planTags = plan.tags as string[] || [];
      const culturalMatch = cultural.some(c => planTags.includes(c.toLowerCase()));
      if (culturalMatch) score += 30;

      // Check goal match
      const goals = profile.goals as string[] || [];
      if (goals.includes("Save Money") && planTags.includes("budget-friendly")) score += 20;
      if (goals.includes("Eat Healthier") && planTags.includes("nutritious")) score += 20;
      if (goals.includes("Save Time") && planTags.includes("quick")) score += 20;

      // Boost by success rate
      if (plan.success_rate && plan.success_rate > 80) score += 15;

      // Boost by popularity
      score += Math.min(plan.tries || 0, 20); // Cap at 20 points

      return { ...plan, score };
    });

    // Sort by score and return top results
    scoredPlans.sort((a, b) => b.score - a.score);
    return scoredPlans.slice(0, limit);
  }

  // Get trending meal plans
  async getTrendingMealPlans(limit: number = 10) {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const trending = await db.select()
      .from(sharedMealPlans)
      .where(gte(sharedMealPlans.created_at, threeDaysAgo))
      .orderBy(
        desc(sql`${sharedMealPlans.likes} * 2 + ${sharedMealPlans.tries} * 3`)
      )
      .limit(limit);

    return trending;
  }

  // Like a meal plan
  async likeMealPlan(sharedPlanId: number): Promise<void> {
    await db.update(sharedMealPlans)
      .set({ 
        likes: sql`${sharedMealPlans.likes} + 1`,
      })
      .where(eq(sharedMealPlans.id, sharedPlanId));
  }

  // Get meal plan with creator info
  async getMealPlanWithCreator(sharedPlanId: number) {
    const [plan] = await db.select()
      .from(sharedMealPlans)
      .innerJoin(users, eq(sharedMealPlans.sharer_id, users.id))
      .where(eq(sharedMealPlans.id, sharedPlanId));

    if (!plan) return null;

    return {
      ...plan.shared_meal_plans,
      creator: {
        id: plan.users.id,
        name: plan.users.full_name || plan.users.firstName || "Creator",
        email: plan.users.email,
        profileImageUrl: plan.users.profileImageUrl,
      },
    };
  }

  // Search meal plans
  async searchMealPlans(query: string, filters?: {
    tags?: string[];
    maxCost?: number;
    maxTime?: number;
    minRating?: number;
  }) {
    let plans = await db.select()
      .from(sharedMealPlans)
      .orderBy(desc(sharedMealPlans.created_at));

    // Filter by search query
    if (query) {
      plans = plans.filter(p => 
        p.title.toLowerCase().includes(query.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(query.toLowerCase()))
      );
    }

    // Apply filters
    if (filters) {
      if (filters.tags && filters.tags.length > 0) {
        plans = plans.filter(p => {
          const planTags = p.tags as string[];
          return filters.tags!.some(tag => planTags.includes(tag));
        });
      }

      if (filters.maxCost) {
        plans = plans.filter(p => {
          const metrics = p.metrics as any;
          return metrics?.cost_per_serving <= filters.maxCost!;
        });
      }

      if (filters.maxTime) {
        plans = plans.filter(p => {
          const metrics = p.metrics as any;
          return metrics?.total_prep_time <= filters.maxTime!;
        });
      }

      if (filters.minRating) {
        plans = plans.filter(p => 
          p.success_rate && p.success_rate >= filters.minRating! * 20
        );
      }
    }

    return plans;
  }

  // Get meal plans by creator
  async getCreatorMealPlans(creatorId: string, limit: number = 20) {
    const plans = await db.select()
      .from(sharedMealPlans)
      .where(eq(sharedMealPlans.sharer_id, creatorId))
      .orderBy(desc(sharedMealPlans.created_at))
      .limit(limit);

    return plans;
  }

  // Private helper methods
  private calculateNutritionScore(avgCalories: number): number {
    // Simple nutrition score based on calorie range
    // Ideal range: 400-700 calories per meal
    if (avgCalories >= 400 && avgCalories <= 700) return 100;
    if (avgCalories >= 350 && avgCalories <= 800) return 80;
    if (avgCalories >= 300 && avgCalories <= 900) return 60;
    return 40;
  }

  private sanitizeMealPlan(mealPlan: any): any {
    // Remove any personal notes or user-specific data
    const sanitized = { ...mealPlan };
    
    // Remove fields that might contain personal data
    for (const dayKey in sanitized) {
      const day = sanitized[dayKey];
      if (day && typeof day === 'object') {
        for (const mealType in day) {
          const meal = day[mealType];
          if (meal && typeof meal === 'object') {
            // Remove personal notes
            delete meal.personalNotes;
            delete meal.userRating;
            delete meal.customModifications;
          }
        }
      }
    }
    
    return sanitized;
  }
}

export const mealPlanSharingService = new MealPlanSharingService();