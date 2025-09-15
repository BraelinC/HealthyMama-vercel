/**
 * Smart Cultural Meal Selector
 * 
 * Intelligently selects when to use cultural meals based on:
 * - Cultural weight in user preferences
 * - Meal slot context (variety distribution)
 * - Available cultural meals
 * - Previous meal selections
 */

import type { GoalWeights } from '../shared/schema';

interface MealSlotContext {
  day: number;
  mealType: string;
  slotIndex: number;
  previousMeals: any[];
}

interface CulturalMeal {
  id: string;
  title: string;
  culture: string;
  ingredients: string[];
  instructions: string[];
  cookTime: number;
  difficulty: number;
  nutrition?: any;
}

export class SmartCulturalSelector {
  /**
   * Determine if a cultural meal should be used for this slot
   */
  shouldUseCulturalMeal(
    context: any,
    mealSlotContext: MealSlotContext,
    weights: GoalWeights
  ): boolean {
    // No cultural meals available
    if (!context.availableCulturalMeals || context.availableCulturalMeals.length === 0) {
      return false;
    }

    // Calculate if we've used enough cultural meals
    const culturalMealsUsed = context.culturalMealsUsed || 0;
    const optimalCount = context.optimalCulturalMealCount || 0;
    
    // If we've already hit our optimal count, only add more if cultural weight is very high
    if (culturalMealsUsed >= optimalCount) {
      return weights.cultural > 0.8;
    }

    // Base probability on cultural weight
    let probability = weights.cultural;

    // Increase probability if we're behind on cultural meal usage
    const progress = mealSlotContext.slotIndex / context.totalMeals;
    const culturalProgress = culturalMealsUsed / optimalCount;
    
    if (culturalProgress < progress) {
      // We're behind schedule, increase probability
      probability += 0.2;
    }

    // Vary by meal type - cultural dinners are more common
    if (mealSlotContext.mealType === 'dinner') {
      probability += 0.1;
    } else if (mealSlotContext.mealType === 'breakfast') {
      probability -= 0.1;
    }

    // Check recent meals to avoid clustering
    const recentMeals = mealSlotContext.previousMeals.slice(-3);
    const recentCulturalCount = recentMeals.filter(m => m.culturalSource).length;
    
    if (recentCulturalCount >= 2) {
      // Too many cultural meals recently, reduce probability
      probability -= 0.3;
    }

    // Clamp probability between 0 and 1
    probability = Math.max(0, Math.min(1, probability));

    // Make decision based on probability
    return Math.random() < probability;
  }

  /**
   * Select the best cultural meal for this slot
   */
  selectBestCulturalMeal(
    availableMeals: CulturalMeal[],
    weights: GoalWeights,
    mealSlotContext: MealSlotContext
  ): CulturalMeal {
    if (availableMeals.length === 0) {
      throw new Error('No cultural meals available to select from');
    }

    // Score each meal based on weights and context
    const scoredMeals = availableMeals.map(meal => {
      let score = 0;

      // Time weight - prefer quicker meals
      if (weights.time > 0.5) {
        const timeScore = meal.cookTime <= 30 ? 1 : meal.cookTime <= 45 ? 0.7 : 0.4;
        score += timeScore * weights.time;
      }

      // Cost weight - prefer meals with common ingredients
      if (weights.cost > 0.5) {
        const commonIngredients = ['rice', 'beans', 'chicken', 'eggs', 'pasta', 'potatoes'];
        const costScore = meal.ingredients.filter(ing => 
          commonIngredients.some(common => ing.toLowerCase().includes(common))
        ).length / meal.ingredients.length;
        score += costScore * weights.cost;
      }

      // Health weight - prefer balanced nutrition
      if (weights.health > 0.5 && meal.nutrition) {
        const healthScore = this.calculateHealthScore(meal.nutrition);
        score += healthScore * weights.health;
      }

      // Variety weight - avoid repeating cultures
      if (weights.variety > 0.5) {
        const recentCultures = mealSlotContext.previousMeals
          .filter(m => m.culturalSource)
          .map(m => m.culturalSource)
          .slice(-5);
        
        const varietyScore = recentCultures.includes(meal.culture) ? 0.3 : 1;
        score += varietyScore * weights.variety;
      }

      // Meal type appropriateness
      const appropriatenessScore = this.getMealTypeScore(meal, mealSlotContext.mealType);
      score += appropriatenessScore * 0.2;

      return { meal, score };
    });

    // Sort by score and select the best
    scoredMeals.sort((a, b) => b.score - a.score);
    
    // Add some randomness to avoid always picking the same meal
    const topCandidates = scoredMeals.slice(0, Math.min(3, scoredMeals.length));
    const selectedIndex = Math.floor(Math.random() * topCandidates.length);
    
    return topCandidates[selectedIndex].meal;
  }

  /**
   * Calculate health score based on nutrition
   */
  private calculateHealthScore(nutrition: any): number {
    if (!nutrition) return 0.5;

    let score = 0;
    
    // Balanced macros
    const totalMacros = (nutrition.protein_g || 0) + (nutrition.carbs_g || 0) + (nutrition.fat_g || 0);
    if (totalMacros > 0) {
      const proteinRatio = (nutrition.protein_g || 0) / totalMacros;
      const carbRatio = (nutrition.carbs_g || 0) / totalMacros;
      const fatRatio = (nutrition.fat_g || 0) / totalMacros;
      
      // Ideal ratios: 30% protein, 40% carbs, 30% fat
      score += 1 - Math.abs(proteinRatio - 0.3) * 2;
      score += 1 - Math.abs(carbRatio - 0.4) * 2;
      score += 1 - Math.abs(fatRatio - 0.3) * 2;
      score /= 3;
    }

    // Reasonable calorie count
    const calories = nutrition.calories || 0;
    if (calories >= 300 && calories <= 800) {
      score = (score + 1) / 2;
    } else {
      score = (score + 0.5) / 2;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Score meal appropriateness for meal type
   */
  private getMealTypeScore(meal: CulturalMeal, mealType: string): number {
    const title = meal.title.toLowerCase();
    
    switch (mealType) {
      case 'breakfast':
        if (title.includes('breakfast') || title.includes('morning') || 
            title.includes('pancake') || title.includes('egg') || 
            title.includes('oatmeal') || title.includes('cereal')) {
          return 1;
        }
        return 0.3;
        
      case 'lunch':
        if (title.includes('sandwich') || title.includes('salad') || 
            title.includes('soup') || title.includes('wrap')) {
          return 1;
        }
        return 0.7;
        
      case 'dinner':
        if (title.includes('dinner') || title.includes('roast') || 
            title.includes('steak') || title.includes('curry')) {
          return 1;
        }
        return 0.8;
        
      case 'snack':
        if (title.includes('snack') || title.includes('bite') || 
            title.includes('bar') || title.includes('smoothie')) {
          return 1;
        }
        return 0.2;
        
      default:
        return 0.5;
    }
  }
}