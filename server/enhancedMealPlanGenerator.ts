/**
 * Enhanced Meal Plan Generator
 * Integrates Cultural Ranking Engine + Llama 3 8B for intelligent meal selection
 */

import { llamaMealRanker } from './llamaMealRanker.js';
import { UserCulturalProfile, StructuredMeal } from './culturalMealRankingEngine.js';

export interface EnhancedMealPlanRequest {
  userId: number;
  numDays: number;
  mealsPerDay: number;
  userProfile: UserCulturalProfile;
  servingSize?: number;
}

export interface EnhancedMealPlanResponse {
  meal_plan: {
    [day: string]: {
      [meal: string]: {
        title: string;
        description: string;
        cuisine: string;
        ingredients: string[];
        cooking_techniques: string[];
        cook_time_minutes: number;
        difficulty: number;
        nutrition: {
          calories: number;
          protein_g: number;
          carbs_g: number;
          fat_g: number;
        };
        cultural_authenticity: number;
        ranking_explanation: string;
        source: string;
      };
    };
  };
  generation_metadata: {
    type: string;
    cultural_ranking_used: boolean;
    llama_ranking_used: boolean;
    meals_analyzed: number;
    selection_reasoning: string;
    processing_time_ms: number;
  };
}

export class EnhancedMealPlanGenerator {
  
  /**
   * Generate intelligent meal plan using cultural ranking + Llama selection
   */
  public async generateMealPlan(request: EnhancedMealPlanRequest): Promise<EnhancedMealPlanResponse> {
    const startTime = Date.now();
    console.log(`🍽️ Generating enhanced meal plan: ${request.numDays} days, ${request.mealsPerDay} meals/day`);

    try {
      // Calculate total meals needed
      const totalMeals = request.numDays * request.mealsPerDay;
      
      // Use Llama + Cultural Ranking to select best meals
      const selectedMeals = await llamaMealRanker.selectMealsForPlan(
        request.userId,
        request.userProfile,
        totalMeals
      );

      if (selectedMeals.length === 0) {
        throw new Error('No meals available matching user preferences');
      }

      console.log(`✅ Selected ${selectedMeals.length} meals for plan`);

      // Build structured meal plan
      const mealPlan = this.buildMealPlanStructure(
        selectedMeals,
        request.numDays,
        request.mealsPerDay,
        request.servingSize || 1
      );

      // Generate metadata
      const metadata = {
        type: 'enhanced-cultural-ranking-v1',
        cultural_ranking_used: true,
        llama_ranking_used: true,
        meals_analyzed: selectedMeals.length,
        selection_reasoning: this.generateSelectionReasoning(selectedMeals, request.userProfile),
        processing_time_ms: Date.now() - startTime
      };

      return {
        meal_plan: mealPlan,
        generation_metadata: metadata
      };

    } catch (error) {
      console.error('❌ Enhanced meal plan generation failed:', error);
      throw error;
    }
  }

  /**
   * Build structured meal plan from selected meals
   */
  private buildMealPlanStructure(
    meals: StructuredMeal[],
    numDays: number,
    mealsPerDay: number,
    servingSize: number
  ): any {
    const mealPlan: any = {};
    const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack', 'dessert'];
    let mealIndex = 0;

    for (let day = 1; day <= numDays; day++) {
      const dayKey = `day_${day}`;
      mealPlan[dayKey] = {};

      for (let mealNum = 0; mealNum < mealsPerDay; mealNum++) {
        if (mealIndex >= meals.length) {
          // If we run out of meals, cycle back (shouldn't happen with proper selection)
          mealIndex = 0;
        }

        const meal = meals[mealIndex];
        const mealType = mealTypes[mealNum] || `meal_${mealNum + 1}`;

        mealPlan[dayKey][mealType] = {
          title: meal.name,
          description: meal.description,
          cuisine: meal.cuisine,
          ingredients: this.scaleIngredients(meal.ingredients, servingSize),
          cooking_techniques: meal.cooking_techniques,
          cook_time_minutes: meal.estimated_prep_time + meal.estimated_cook_time,
          difficulty: meal.difficulty_level,
          nutrition: this.estimateNutrition(meal, servingSize),
          cultural_authenticity: meal.authenticity_score,
          ranking_explanation: `Selected for ${meal.cuisine} authenticity and weight-based preferences`,
          source: `Cultural cache + Llama ranking`
        };

        mealIndex++;
      }
    }

    return mealPlan;
  }

  /**
   * Scale ingredients for serving size
   */
  private scaleIngredients(ingredients: string[], servingSize: number): string[] {
    if (servingSize === 1) return ingredients;
    
    return ingredients.map(ingredient => {
      // Simple scaling - in real implementation, would parse quantities
      if (servingSize > 1) {
        return `${ingredient} (x${servingSize})`;
      }
      return ingredient;
    });
  }

  /**
   * Estimate nutrition info (mock implementation)
   */
  private estimateNutrition(meal: StructuredMeal, servingSize: number) {
    // Base estimates - would be enhanced with real nutrition data
    const baseCalories = 400;
    const baseProtein = 25;
    const baseCarbs = 45;
    const baseFat = 15;

    // Adjust based on cuisine and meal type
    let calorieMultiplier = 1;
    if (meal.cuisine.toLowerCase().includes('italian')) calorieMultiplier = 1.2;
    if (meal.cuisine.toLowerCase().includes('chinese')) calorieMultiplier = 0.9;

    return {
      calories: Math.round(baseCalories * calorieMultiplier * servingSize),
      protein_g: Math.round(baseProtein * servingSize),
      carbs_g: Math.round(baseCarbs * servingSize),
      fat_g: Math.round(baseFat * servingSize)
    };
  }

  /**
   * Generate human-readable selection reasoning
   */
  private generateSelectionReasoning(meals: StructuredMeal[], userProfile: UserCulturalProfile): string {
    const cuisines = [...new Set(meals.map(m => m.cuisine))];
    const avgAuthenticity = meals.reduce((sum, m) => sum + m.authenticity_score, 0) / meals.length;
    
    const topPriority = Object.entries(userProfile.priority_weights)
      .sort(([,a], [,b]) => b - a)[0][0];

    return `Selected ${meals.length} meals from ${cuisines.join(', ')} cuisines. Average authenticity: ${(avgAuthenticity * 100).toFixed(0)}%. Prioritized ${topPriority}-focused selections using Llama 3 8B ranking.`;
  }

  /**
   * Convert user profile data to UserCulturalProfile format
   */
  public static buildUserProfile(profile: any, goalWeights: any): UserCulturalProfile {
    // Build cultural preferences from profile
    const cultural_preferences: { [cuisine: string]: number } = {};
    
    if (profile.cultural_background) {
      for (const culture of profile.cultural_background) {
        cultural_preferences[culture] = 0.9; // High preference for user's cultural background
      }
    }

    // Add preferences from family members or individual preferences
    if (profile.preferences) {
      for (const pref of profile.preferences) {
        if (pref.toLowerCase().includes('asian')) {
          cultural_preferences['Chinese'] = 0.8;
          cultural_preferences['Japanese'] = 0.7;
        }
        // Add more preference mappings as needed
      }
    }

    return {
      cultural_preferences,
      priority_weights: {
        cultural: goalWeights?.cultural || 0.5,
        health: goalWeights?.health || 0.5,
        cost: goalWeights?.cost || 0.5,
        time: goalWeights?.time || 0.5,
        variety: goalWeights?.variety || 0.5
      },
      dietary_restrictions: this.extractDietaryRestrictions(profile),
      preferences: profile.preferences || []
    };
  }

  private static extractDietaryRestrictions(profile: any): string[] {
    const restrictions: string[] = [];
    
    // From profile preferences
    if (profile.preferences) {
      for (const pref of profile.preferences) {
        const lower = pref.toLowerCase();
        if (lower.includes('egg-free') || lower.includes('no egg')) {
          restrictions.push('Egg-Free');
        }
        if (lower.includes('dairy-free') || lower.includes('no dairy')) {
          restrictions.push('Dairy-Free');
        }
        if (lower.includes('gluten-free')) {
          restrictions.push('Gluten-Free');
        }
        if (lower.includes('vegetarian')) {
          restrictions.push('Vegetarian');
        }
        if (lower.includes('vegan')) {
          restrictions.push('Vegan');
        }
      }
    }

    // From family members
    if (profile.members) {
      for (const member of profile.members) {
        if (member.dietaryRestrictions) {
          restrictions.push(...member.dietaryRestrictions);
        }
      }
    }

    return [...new Set(restrictions)]; // Remove duplicates
  }
}

// Export singleton instance
export const enhancedMealPlanGenerator = new EnhancedMealPlanGenerator();