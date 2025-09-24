/**
 * Smart Cultural Meal Selector
 * 
 * Implements intelligent cultural meal insertion logic with weight-based decision making.
 * Maintains 20-35% optimal cultural meal ratio with dynamic thresholds and smart rotation.
 */

import type { GoalWeights } from './WeightBasedMealPlanner';

export interface CulturalMeal {
  id: string;
  name: string;
  description: string;
  culture: string;
  ingredients: string[];
  instructions: string[];
  nutrition: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  };
  cook_time_minutes: number;
  difficulty: number;
  
  // Cultural meal specific metadata
  authenticity_score: number;
  dietary_compatibility: string[];
  cultural_significance?: string;
  adaptation_notes?: string[];
  usage_tracking: {
    last_used: Date | null;
    usage_count: number;
    user_rating?: number;
  };
}

export interface MealSlotContext {
  day: number;
  mealType: string;
  slotIndex: number;
  previousMeals: any[];
}

export interface CulturalMealCompatibility {
  meal: CulturalMeal;
  compatibility_score: number;
  goal_alignment: {
    cost: number;
    health: number;
    cultural: number;
    variety: number;
    time: number;
  };
  dietary_safe: boolean;
  adaptation_needed: boolean;
  recently_used: boolean;
}

export class SmartCulturalMealSelector {
  private readonly OPTIMAL_CULTURAL_PERCENTAGE = {
    min: 0.20,  // 20% minimum
    baseline: 0.25,  // 25% baseline
    max: 0.35   // 35% maximum
  };

  private readonly DYNAMIC_THRESHOLDS = {
    low_cultural_weight: 0.2,
    medium_cultural_weight: 0.4,
    high_cultural_weight: 0.6
  };

  private readonly RECENCY_DAYS = 14; // Avoid same meal within 2 weeks

  /**
   * Calculate optimal number of cultural meals for a meal plan
   */
  calculateOptimalCulturalMealCount(totalMeals: number, culturalWeight: number): number {
    console.log(`Calculating cultural meal count for ${totalMeals} meals with weight ${culturalWeight}`);

    // Base calculation: 25% baseline with weight adjustment
    const basePortion = totalMeals * this.OPTIMAL_CULTURAL_PERCENTAGE.baseline;
    const weightAdjustment = culturalWeight * 0.15; // Up to 15% more if high weight
    const optimalCount = Math.ceil(basePortion + (basePortion * weightAdjustment));
    
    // Clamp to sensible ranges based on total meals
    let clampedCount: number;
    if (totalMeals <= 5) {
      clampedCount = Math.min(Math.max(optimalCount, 1), 2); // 1-2 for 5 meals
    } else if (totalMeals <= 7) {
      clampedCount = Math.min(Math.max(optimalCount, 1), 3); // 1-3 for 7 meals  
    } else if (totalMeals <= 14) {
      clampedCount = Math.min(Math.max(optimalCount, 2), 4); // 2-4 for 14 meals
    } else {
      clampedCount = Math.min(Math.max(optimalCount, 3), 6); // 3-6 for larger plans
    }

    console.log(`Optimal cultural meals: ${clampedCount} (${((clampedCount / totalMeals) * 100).toFixed(1)}% of total)`);
    return clampedCount;
  }

  /**
   * Determine if a cultural meal should be used for this slot
   */
  shouldUseCulturalMeal(
    planningContext: any,
    mealSlotContext: MealSlotContext,
    userGoalWeights: GoalWeights
  ): boolean {
    const {
      culturalMealsUsed,
      optimalCulturalMealCount,
      availableCulturalMeals,
      totalMeals
    } = planningContext;

    // Quick checks
    if (culturalMealsUsed >= optimalCulturalMealCount) {
      console.log(`Cultural meal quota reached: ${culturalMealsUsed}/${optimalCulturalMealCount}`);
      return false;
    }

    if (availableCulturalMeals.length === 0) {
      console.log('No available cultural meals');
      return false;
    }

    // Check cultural weight threshold
    const culturalWeight = userGoalWeights.cultural;
    if (culturalWeight < this.DYNAMIC_THRESHOLDS.low_cultural_weight) {
      console.log(`Cultural weight too low: ${culturalWeight} < ${this.DYNAMIC_THRESHOLDS.low_cultural_weight}`);
      return false;
    }

    // Check if we have compatible meals for this slot
    const compatibleMeals = this.getCompatibleMealsForSlot(
      availableCulturalMeals,
      mealSlotContext,
      userGoalWeights
    );

    if (compatibleMeals.length === 0) {
      console.log('No compatible cultural meals for this slot');
      return false;
    }

    // Dynamic probability based on cultural weight and remaining slots
    const remainingSlots = totalMeals - mealSlotContext.slotIndex;
    const remainingCulturalNeeded = optimalCulturalMealCount - culturalMealsUsed;
    const urgency = remainingCulturalNeeded / remainingSlots;

    // Base probability from cultural weight
    let probability = culturalWeight;
    
    // Adjust for urgency (if we need to use more cultural meals soon)
    if (urgency > 0.5) {
      probability += 0.2; // Boost probability if urgent
    }
    
    // Adjust for variety (avoid clustering cultural meals)
    const recentCulturalMeals = mealSlotContext.previousMeals
      .slice(-3) // Check last 3 meals
      .filter(meal => meal.culturalSource);
    
    if (recentCulturalMeals.length >= 2) {
      probability -= 0.3; // Reduce probability to spread out cultural meals
    }

    const shouldUse = Math.random() < probability;
    
    console.log(`Cultural meal decision for slot ${mealSlotContext.slotIndex}: ${shouldUse} (probability: ${probability.toFixed(2)})`);
    return shouldUse;
  }

  /**
   * Select the best cultural meal for a specific slot
   */
  selectBestCulturalMeal(
    availableCulturalMeals: CulturalMeal[],
    userGoalWeights: GoalWeights,
    mealSlotContext: MealSlotContext
  ): CulturalMeal {
    console.log(`Selecting best cultural meal from ${availableCulturalMeals.length} options`);

    // Get compatibility scores for all meals
    const scoredMeals = availableCulturalMeals.map(meal => 
      this.scoreMealCompatibility(meal, userGoalWeights, mealSlotContext)
    ).filter(scored => scored.dietary_safe && !scored.recently_used);

    if (scoredMeals.length === 0) {
      console.warn('No safe, recent cultural meals available - using first available');
      return availableCulturalMeals[0];
    }

    // Sort by compatibility score
    scoredMeals.sort((a, b) => b.compatibility_score - a.compatibility_score);

    // Add some randomization to top choices to prevent predictability
    const topChoices = scoredMeals.slice(0, Math.min(3, scoredMeals.length));
    const selectedMeal = topChoices[Math.floor(Math.random() * topChoices.length)];

    console.log(`Selected cultural meal: ${selectedMeal.meal.name} (score: ${selectedMeal.compatibility_score.toFixed(2)})`);
    
    // Update usage tracking
    this.updateMealUsageTracking(selectedMeal.meal);

    return selectedMeal.meal;
  }

  /**
   * Score how well a cultural meal fits the current context
   */
  private scoreMealCompatibility(
    meal: CulturalMeal,
    userGoalWeights: GoalWeights,
    mealSlotContext: MealSlotContext
  ): CulturalMealCompatibility {
    let totalScore = 0;
    const goalAlignment = {
      cost: 0,
      health: 0,
      cultural: 0,
      variety: 0,
      time: 0
    };

    // Cost alignment (simple ingredients, bulk-friendly)
    goalAlignment.cost = this.scoreCostAlignment(meal);
    
    // Health alignment (nutritional density, balanced macros)
    goalAlignment.health = this.scoreHealthAlignment(meal);
    
    // Cultural alignment (authenticity, cultural significance)
    goalAlignment.cultural = meal.authenticity_score || 0.7;
    
    // Variety alignment (different from recent meals)
    goalAlignment.variety = this.scoreVarietyAlignment(meal, mealSlotContext);
    
    // Time alignment (fits cooking time preferences)
    goalAlignment.time = this.scoreTimeAlignment(meal, userGoalWeights.time);

    // Calculate weighted total score
    totalScore = 
      (goalAlignment.cost * userGoalWeights.cost) +
      (goalAlignment.health * userGoalWeights.health) +
      (goalAlignment.cultural * userGoalWeights.cultural) +
      (goalAlignment.variety * userGoalWeights.variety) +
      (goalAlignment.time * userGoalWeights.time);

    // Normalize to 0-1 range
    totalScore = Math.min(1.0, totalScore);

    return {
      meal,
      compatibility_score: totalScore,
      goal_alignment: goalAlignment,
      dietary_safe: true, // Assuming pre-filtered
      adaptation_needed: false, // Would be determined by adaptation engine
      recently_used: this.isRecentlyUsed(meal)
    };
  }

  /**
   * Get cultural meals compatible with the current slot
   */
  private getCompatibleMealsForSlot(
    availableCulturalMeals: CulturalMeal[],
    mealSlotContext: MealSlotContext,
    userGoalWeights: GoalWeights
  ): CulturalMeal[] {
    return availableCulturalMeals.filter(meal => {
      // Filter out recently used meals
      if (this.isRecentlyUsed(meal)) {
        return false;
      }

      // Filter by meal type appropriateness (breakfast vs dinner dishes)
      if (!this.isMealTypeAppropriate(meal, mealSlotContext.mealType)) {
        return false;
      }

      // Filter by goal compatibility (basic threshold)
      const compatibility = this.scoreMealCompatibility(meal, userGoalWeights, mealSlotContext);
      return compatibility.compatibility_score >= 0.3; // Minimum compatibility threshold
    });
  }

  // Scoring helper methods
  private scoreCostAlignment(meal: CulturalMeal): number {
    // Score based on ingredient simplicity and cost-effectiveness
    const simpleIngredients = meal.ingredients.filter(ingredient => 
      this.isSimpleIngredient(ingredient)
    ).length;
    
    const ingredientScore = Math.min(1.0, simpleIngredients / meal.ingredients.length);
    const cookTimeScore = meal.cook_time_minutes <= 30 ? 1.0 : Math.max(0.3, 1.0 - (meal.cook_time_minutes - 30) / 60);
    
    return (ingredientScore + cookTimeScore) / 2;
  }

  private scoreHealthAlignment(meal: CulturalMeal): number {
    const { calories, protein_g } = meal.nutrition;
    
    // Score based on reasonable calorie range and protein content
    let healthScore = 0.5; // Base score
    
    // Calorie appropriateness (300-600 for main meals)
    if (calories >= 300 && calories <= 600) {
      healthScore += 0.25;
    }
    
    // Protein content (good if >= 20g)
    if (protein_g >= 20) {
      healthScore += 0.25;
    }
    
    return Math.min(1.0, healthScore);
  }

  private scoreVarietyAlignment(meal: CulturalMeal, mealSlotContext: MealSlotContext): number {
    // Score higher if meal brings variety compared to recent meals
    const recentCuisines = mealSlotContext.previousMeals
      .slice(-5) // Check last 5 meals
      .map(m => m.culturalSource || m.cuisine_type)
      .filter(Boolean);
    
    const hasSimilarRecent = recentCuisines.includes(meal.culture);
    return hasSimilarRecent ? 0.3 : 0.9;
  }

  private scoreTimeAlignment(meal: CulturalMeal, timeWeight: number): number {
    // Score based on cooking time vs user's time priority
    if (timeWeight >= 0.7) {
      // High time priority - prefer quick meals
      return meal.cook_time_minutes <= 20 ? 1.0 : Math.max(0.2, 1.0 - (meal.cook_time_minutes - 20) / 40);
    } else if (timeWeight >= 0.4) {
      // Medium time priority - moderate cooking time OK
      return meal.cook_time_minutes <= 45 ? 0.8 : Math.max(0.3, 1.0 - (meal.cook_time_minutes - 45) / 60);
    } else {
      // Low time priority - cooking time less important
      return 0.7;
    }
  }

  // Utility helper methods
  private isSimpleIngredient(ingredient: string): boolean {
    const simpleIngredients = [
      'rice', 'pasta', 'chicken', 'beef', 'pork', 'eggs', 'beans', 'lentils',
      'onion', 'garlic', 'tomato', 'potato', 'carrot', 'bell pepper',
      'olive oil', 'salt', 'pepper', 'herbs', 'spices'
    ];
    
    return simpleIngredients.some(simple => 
      ingredient.toLowerCase().includes(simple)
    );
  }

  private isMealTypeAppropriate(meal: CulturalMeal, mealType: string): boolean {
    // Basic meal type appropriateness check
    const breakfastKeywords = ['pancake', 'waffle', 'omelette', 'egg', 'toast', 'porridge', 'oatmeal'];
    const dinnerKeywords = ['stew', 'roast', 'curry', 'pasta', 'rice dish', 'soup'];
    
    const mealName = meal.name.toLowerCase();
    
    if (mealType === 'breakfast') {
      // For breakfast, prefer breakfast-appropriate dishes or simple dishes
      return breakfastKeywords.some(keyword => mealName.includes(keyword)) || 
             meal.cook_time_minutes <= 15;
    } else if (mealType === 'dinner') {
      // For dinner, avoid typical breakfast dishes
      return !breakfastKeywords.some(keyword => mealName.includes(keyword));
    }
    
    // For lunch and snacks, most things are appropriate
    return true;
  }

  private isRecentlyUsed(meal: CulturalMeal): boolean {
    if (!meal.usage_tracking.last_used) {
      return false;
    }
    
    const daysSinceUsed = (Date.now() - meal.usage_tracking.last_used.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceUsed < this.RECENCY_DAYS;
  }

  private updateMealUsageTracking(meal: CulturalMeal): void {
    meal.usage_tracking.last_used = new Date();
    meal.usage_tracking.usage_count += 1;
    
    console.log(`Updated usage tracking for ${meal.name}: count ${meal.usage_tracking.usage_count}`);
  }

  /**
   * Get statistics about cultural meal usage in a plan
   */
  getCulturalMealStats(mealPlan: any[], totalMeals: number): {
    cultural_meal_count: number;
    cultural_percentage: number;
    cultural_distribution: Record<string, number>;
    variety_score: number;
  } {
    const culturalMeals = mealPlan.filter(meal => meal.culturalSource);
    const culturalCount = culturalMeals.length;
    const culturalPercentage = (culturalCount / totalMeals) * 100;
    
    // Count by culture type
    const cultureDistribution: Record<string, number> = {};
    culturalMeals.forEach(meal => {
      const culture = meal.culturalSource;
      cultureDistribution[culture] = (cultureDistribution[culture] || 0) + 1;
    });
    
    // Calculate variety score (higher is better)
    const uniqueCultures = Object.keys(cultureDistribution).length;
    const varietyScore = culturalCount > 0 ? uniqueCultures / culturalCount : 0;
    
    return {
      cultural_meal_count: culturalCount,
      cultural_percentage: Math.round(culturalPercentage * 10) / 10,
      cultural_distribution: cultureDistribution,
      variety_score: Math.round(varietyScore * 100) / 100
    };
  }

  /**
   * Validate cultural meal insertion meets optimal targets
   */
  validateCulturalMealInsertion(
    mealPlan: any[],
    totalMeals: number,
    targetCulturalCount: number
  ): {
    is_optimal: boolean;
    actual_count: number;
    target_count: number;
    percentage: number;
    within_range: boolean;
    recommendations: string[];
  } {
    const stats = this.getCulturalMealStats(mealPlan, totalMeals);
    const isOptimal = stats.cultural_meal_count === targetCulturalCount;
    const withinRange = stats.cultural_percentage >= 20 && stats.cultural_percentage <= 35;
    
    const recommendations: string[] = [];
    
    if (stats.cultural_percentage < 20) {
      recommendations.push('Consider increasing cultural meal frequency');
    } else if (stats.cultural_percentage > 35) {
      recommendations.push('Consider reducing cultural meal frequency for better variety');
    }
    
    if (stats.variety_score < 0.5) {
      recommendations.push('Improve cultural variety by using different cuisine types');
    }
    
    return {
      is_optimal: isOptimal,
      actual_count: stats.cultural_meal_count,
      target_count: targetCulturalCount,
      percentage: stats.cultural_percentage,
      within_range: withinRange,
      recommendations
    };
  }
}