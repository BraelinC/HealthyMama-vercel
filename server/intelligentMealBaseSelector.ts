/**
 * Intelligent Meal Base Selection System
 * Uses questionnaire-derived weights to find optimal base meals for meal plan generation
 */

import { llamaMealRanker } from './llamaMealRanker.js';
import { culturalMealRankingEngine, type UserCulturalProfile, type MealScore, type StructuredMeal } from './culturalMealRankingEngine.js';

export interface BaseMealSelection {
  baseMeal: StructuredMeal;
  similarity_score: number;
  usage_rationale: string;
  weight_alignment: {
    cultural: number;
    health: number;
    cost: number;
    time: number;
  };
}

export interface MealPlanWithBase {
  baseMeal: BaseMealSelection;
  complementaryMeals: StructuredMeal[];
  variety_boost_meals: StructuredMeal[];
  reasoning: string;
}

export class IntelligentMealBaseSelector {
  
  /**
   * Find the best base meal that aligns with user's questionnaire-derived weights
   */
  async findOptimalBaseMeal(
    userId: number,
    userProfile: UserCulturalProfile,
    preferredCuisines: string[] = []
  ): Promise<BaseMealSelection | null> {
    
    console.log('🎯 Finding optimal base meal for user preferences');
    console.log('🔍 User weights:', userProfile.priority_weights);
    console.log('🌍 Preferred cuisines:', preferredCuisines);

    // Get cultures to search (use preferences or default to popular ones)
    const cultures = preferredCuisines.length > 0 
      ? preferredCuisines 
      : Object.keys(userProfile.cultural_preferences);

    if (cultures.length === 0) {
      cultures.push('Italian', 'Chinese', 'Indian'); // Fallback cultures
    }

    try {
      // Get ranked meals using the cultural ranking engine
      const rankedMeals = await culturalMealRankingEngine.getRankedMeals(
        userId,
        userProfile,
        15, // Get more options for better base selection
        0.4  // Lower threshold to consider more variety
      );

      console.log(`📊 Got ${rankedMeals.length} ranked meals for base selection`);

      if (rankedMeals.length === 0) {
        console.log('❌ No meals available for base selection');
        return null;
      }

      // Use AI to intelligently select the best base meal
      const aiRanking = await llamaMealRanker.rankMealsInParallel({
        meals: rankedMeals,
        userProfile,
        maxMeals: 5 // Focus on top 5 candidates
      });

      if (aiRanking.rankedMeals.length === 0) {
        console.log('❌ AI ranking failed, using top scored meal');
        return this.createBaseMealSelection(rankedMeals[0], userProfile);
      }

      // Select the top AI-ranked meal as the base
      const topMeal = aiRanking.rankedMeals[0];
      console.log(`🎯 Selected base meal: ${topMeal.meal.name} (Score: ${Math.round(topMeal.total_score * 100)}%)`);

      return this.createBaseMealSelection(topMeal, userProfile);

    } catch (error) {
      console.error('❌ Error finding optimal base meal:', error);
      return null;
    }
  }

  /**
   * Generate a complete meal plan using the selected base meal as a foundation
   */
  async generateMealPlanWithBase(
    userId: number,
    userProfile: UserCulturalProfile,
    baseMealSelection: BaseMealSelection,
    totalMeals: number = 9
  ): Promise<MealPlanWithBase> {
    
    console.log(`🍽️ Generating meal plan with base: ${baseMealSelection.baseMeal.name}`);

    // Calculate how many meals should be similar to the base vs variety meals
    const baseInfluence = this.calculateBaseInfluence(userProfile);
    const similarMealsCount = Math.ceil(totalMeals * baseInfluence);
    const varietyMealsCount = totalMeals - similarMealsCount - 1; // -1 for the base meal itself

    console.log(`📈 Base influence: ${Math.round(baseInfluence * 100)}%`);
    console.log(`🎯 Similar meals: ${similarMealsCount}, Variety meals: ${varietyMealsCount}`);

    try {
      // Get complementary meals (similar to base meal)
      const complementaryMeals = await this.findComplementaryMeals(
        userId,
        userProfile,
        baseMealSelection.baseMeal,
        similarMealsCount
      );

      // Get variety boost meals (different from base but still user-aligned)
      const varietyBoostMeals = await this.findVarietyBoostMeals(
        userId,
        userProfile,
        baseMealSelection.baseMeal,
        varietyMealsCount
      );

      const reasoning = this.generateMealPlanReasoning(
        baseMealSelection,
        complementaryMeals,
        varietyBoostMeals,
        userProfile
      );

      return {
        baseMeal: baseMealSelection,
        complementaryMeals,
        variety_boost_meals: varietyBoostMeals,
        reasoning
      };

    } catch (error) {
      console.error('❌ Error generating meal plan with base:', error);
      
      // Fallback: return base meal only
      return {
        baseMeal: baseMealSelection,
        complementaryMeals: [],
        variety_boost_meals: [],
        reasoning: `Meal plan focused on ${baseMealSelection.baseMeal.name} and similar ${baseMealSelection.baseMeal.cuisine} dishes.`
      };
    }
  }

  /**
   * Find meals that complement the base meal (similar style/cuisine)
   */
  private async findComplementaryMeals(
    userId: number,
    userProfile: UserCulturalProfile,
    baseMeal: StructuredMeal,
    count: number
  ): Promise<StructuredMeal[]> {
    
    // Create a modified profile that heavily weights the base meal's cuisine
    const complementaryProfile: UserCulturalProfile = {
      ...userProfile,
      cultural_preferences: {
        ...userProfile.cultural_preferences,
        [baseMeal.cuisine]: Math.min((userProfile.cultural_preferences[baseMeal.cuisine] || 0.5) + 0.3, 1.0)
      }
    };

    const rankedMeals = await culturalMealRankingEngine.getRankedMeals(
      userId,
      complementaryProfile,
      count * 2, // Get extra for filtering
      0.3
    );

    // Filter out the base meal itself and return similar ones
    const complementary = rankedMeals
      .filter(meal => meal.meal.id !== baseMeal.id)
      .filter(meal => meal.meal.cuisine === baseMeal.cuisine)
      .slice(0, count)
      .map(score => score.meal);

    console.log(`🤝 Found ${complementary.length} complementary meals for ${baseMeal.cuisine} cuisine`);
    return complementary;
  }

  /**
   * Find meals that add variety while still respecting user preferences
   */
  private async findVarietyBoostMeals(
    userId: number,
    userProfile: UserCulturalProfile,
    baseMeal: StructuredMeal,
    count: number
  ): Promise<StructuredMeal[]> {
    
    // Create a profile that boosts variety weight
    const varietyProfile: UserCulturalProfile = {
      ...userProfile,
      priority_weights: {
        ...userProfile.priority_weights,
        variety: Math.min(userProfile.priority_weights.variety + 0.3, 1.0)
      }
    };

    const rankedMeals = await culturalMealRankingEngine.getRankedMeals(
      userId,
      varietyProfile,
      count * 3, // Get many options for variety
      0.2 // Lower threshold for more diversity
    );

    // Filter to ensure variety (different cuisines from base meal)
    const varietyMeals = rankedMeals
      .filter(meal => meal.meal.id !== baseMeal.id)
      .filter(meal => meal.meal.cuisine !== baseMeal.cuisine)
      .slice(0, count)
      .map(score => score.meal);

    console.log(`🌟 Found ${varietyMeals.length} variety meals from different cuisines`);
    return varietyMeals;
  }

  /**
   * Calculate how much the base meal should influence the overall meal plan
   */
  private calculateBaseInfluence(userProfile: UserCulturalProfile): number {
    const weights = userProfile.priority_weights;
    
    // Higher cultural and lower variety = more base influence
    // Higher variety and time = less base influence (more diversity)
    const culturalInfluence = weights.cultural * 0.4;
    const varietyReduction = weights.variety * 0.3;
    const timeReduction = weights.time * 0.1; // Time pressure = want consistency
    
    const baseInfluence = Math.max(0.2, Math.min(0.7, culturalInfluence - varietyReduction + timeReduction));
    
    return baseInfluence;
  }

  /**
   * Create a structured base meal selection with rationale
   */
  private createBaseMealSelection(
    mealScore: MealScore,
    userProfile: UserCulturalProfile
  ): BaseMealSelection {
    
    const weights = userProfile.priority_weights;
    const scores = mealScore.component_scores;

    // Calculate how well this meal aligns with each weight priority
    const weightAlignment = {
      cultural: scores.cultural_score * weights.cultural,
      health: scores.health_score * weights.health,
      cost: scores.cost_score * weights.cost,
      time: scores.time_score * weights.time
    };

    // Generate usage rationale
    const strongestAlignment = Object.entries(weightAlignment)
      .sort(([,a], [,b]) => b - a)[0];

    const usageRationale = this.generateUsageRationale(mealScore.meal, strongestAlignment[0], userProfile);

    return {
      baseMeal: mealScore.meal,
      similarity_score: mealScore.total_score,
      usage_rationale: usageRationale,
      weight_alignment: weightAlignment
    };
  }

  /**
   * Generate a rationale for why this meal was selected as the base
   */
  private generateUsageRationale(
    meal: StructuredMeal,
    strongestAlignment: string,
    userProfile: UserCulturalProfile
  ): string {
    
    const alignmentReasons = {
      cultural: `strongly matches your ${meal.cuisine} cuisine preference`,
      health: `offers excellent nutritional balance with ${meal.cooking_techniques.join(', ')} preparation`,
      cost: `uses affordable, accessible ingredients like ${meal.ingredients.slice(0, 3).join(', ')}`,
      time: `can be prepared quickly with ${meal.estimated_prep_time + meal.estimated_cook_time} minutes total time`
    };

    const reason = alignmentReasons[strongestAlignment as keyof typeof alignmentReasons] || 'aligns well with your preferences';

    return `Selected as base meal because it ${reason}. This will guide similar meal selections in your plan.`;
  }

  /**
   * Generate reasoning for the complete meal plan
   */
  private generateMealPlanReasoning(
    baseMeal: BaseMealSelection,
    complementaryMeals: StructuredMeal[],
    varietyMeals: StructuredMeal[],
    userProfile: UserCulturalProfile
  ): string {
    
    const totalMeals = 1 + complementaryMeals.length + varietyMeals.length;
    const cuisines = [baseMeal.baseMeal.cuisine, ...complementaryMeals.map(m => m.cuisine), ...varietyMeals.map(m => m.cuisine)];
    const uniqueCuisines = [...new Set(cuisines)];

    return `Meal plan generated around ${baseMeal.baseMeal.name} as the foundation. ` +
           `Includes ${complementaryMeals.length} similar ${baseMeal.baseMeal.cuisine} dishes for consistency ` +
           `and ${varietyMeals.length} variety meals from ${uniqueCuisines.length - 1} other cuisines. ` +
           `Total ${totalMeals} meals optimized for your ${Object.entries(userProfile.priority_weights)
             .sort(([,a], [,b]) => b - a)
             .slice(0, 2)
             .map(([key]) => key)
             .join(' and ')} priorities.`;
  }
}

// Export singleton instance
export const intelligentMealBaseSelector = new IntelligentMealBaseSelector();