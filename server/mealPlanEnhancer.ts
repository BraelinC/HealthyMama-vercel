/**
 * Meal Plan Enhancement Service
 * 
 * Enhances generated meal plans with familiar dish names, cultural authenticity,
 * and improved presentation for users
 */

import { mapToFamiliarDishName, validateDishCuisineMatch } from './familiarDishNameMapper';

export interface MealPlanEnhancementResult {
  enhancedMealPlan: any;
  enhancementStats: {
    totalMeals: number;
    enhancedMeals: number;
    familiarNameChanges: number;
    cuisineCorrections: number;
    averageConfidence: number;
  };
  enhancementLog: string[];
}

/**
 * Enhance entire meal plan with familiar dish names and cultural consistency
 */
export async function enhanceMealPlanNames(
  mealPlan: any,
  culturalBackground?: string[],
  targetCuisineDistribution?: Record<string, number>
): Promise<MealPlanEnhancementResult> {
  
  if (!mealPlan?.meal_plan) {
    return {
      enhancedMealPlan: mealPlan,
      enhancementStats: {
        totalMeals: 0,
        enhancedMeals: 0,
        familiarNameChanges: 0,
        cuisineCorrections: 0,
        averageConfidence: 0
      },
      enhancementLog: ['No meal plan structure found']
    };
  }

  const enhancedMealPlan = JSON.parse(JSON.stringify(mealPlan)); // Deep copy
  const enhancementLog: string[] = [];
  let totalMeals = 0;
  let enhancedMeals = 0;
  let familiarNameChanges = 0;
  let cuisineCorrections = 0;
  let totalConfidence = 0;

  // Process each day and meal
  for (const dayKey in enhancedMealPlan.meal_plan) {
    const day = enhancedMealPlan.meal_plan[dayKey];
    
    for (const mealType in day) {
      const meal = day[mealType];
      totalMeals++;
      
      if (meal.title) {
        try {
          // Determine expected cuisine for this meal
          const expectedCuisine = determineExpectedCuisine(
            mealType,
            dayKey,
            culturalBackground,
            targetCuisineDistribution
          );
          
          // Map to familiar name
          const mapping = mapToFamiliarDishName(
            meal.title,
            expectedCuisine,
            meal.ingredients
          );
          
          totalConfidence += mapping.confidence;
          
          // Check if name should be updated
          if (mapping.confidence > 0.6 && mapping.familiarName !== meal.title) {
            const oldTitle = meal.title;
            meal.title = mapping.familiarName;
            meal.cuisine_type = mapping.cuisine;
            familiarNameChanges++;
            enhancedMeals++;
            
            enhancementLog.push(
              `${dayKey}_${mealType}: "${oldTitle}" → "${mapping.familiarName}" (${mapping.cuisine}, confidence: ${mapping.confidence.toFixed(2)})`
            );
          }
          
          // Validate cuisine consistency if expected cuisine is defined
          if (expectedCuisine && mapping.cuisine !== expectedCuisine) {
            const validation = validateDishCuisineMatch(meal.title, expectedCuisine);
            
            if (!validation.isMatch && validation.suggestedCorrection) {
              meal.title = validation.suggestedCorrection;
              meal.cuisine_type = expectedCuisine;
              cuisineCorrections++;
              
              enhancementLog.push(
                `${dayKey}_${mealType}: Cuisine correction to ${expectedCuisine} → "${validation.suggestedCorrection}"`
              );
            }
          }
          
          // Add enhancement metadata to meal
          meal.name_enhancement = {
            original_title: meal.title === mapping.familiarName ? undefined : meal.title,
            mapping_confidence: mapping.confidence,
            detected_cuisine: mapping.cuisine,
            enhanced: mapping.confidence > 0.6
          };
          
        } catch (error) {
          enhancementLog.push(`${dayKey}_${mealType}: Enhancement error - ${error.message}`);
        }
      }
    }
  }

  const averageConfidence = totalMeals > 0 ? totalConfidence / totalMeals : 0;

  // Add enhancement summary to meal plan
  enhancedMealPlan.enhancement_summary = {
    total_meals: totalMeals,
    enhanced_meals: enhancedMeals,
    familiar_name_changes: familiarNameChanges,
    cuisine_corrections: cuisineCorrections,
    average_confidence: Math.round(averageConfidence * 100) / 100,
    enhancement_timestamp: new Date().toISOString()
  };

  return {
    enhancedMealPlan,
    enhancementStats: {
      totalMeals,
      enhancedMeals,
      familiarNameChanges,
      cuisineCorrections,
      averageConfidence
    },
    enhancementLog
  };
}

/**
 * Enhance individual meal with familiar naming
 */
export function enhanceMealName(
  meal: any,
  expectedCuisine?: string,
  mealType?: string
): {
  enhancedMeal: any;
  wasEnhanced: boolean;
  enhancement: any;
} {
  
  if (!meal?.title) {
    return {
      enhancedMeal: meal,
      wasEnhanced: false,
      enhancement: { error: 'No meal title provided' }
    };
  }

  const mapping = mapToFamiliarDishName(
    meal.title,
    expectedCuisine,
    meal.ingredients
  );

  const wasEnhanced = mapping.confidence > 0.6 && mapping.familiarName !== meal.title;
  
  const enhancedMeal = {
    ...meal,
    title: wasEnhanced ? mapping.familiarName : meal.title,
    cuisine_type: mapping.cuisine,
    name_enhancement: {
      original_title: wasEnhanced ? meal.title : undefined,
      mapping_confidence: mapping.confidence,
      detected_cuisine: mapping.cuisine,
      enhanced: wasEnhanced,
      meal_type: mealType
    }
  };

  return {
    enhancedMeal,
    wasEnhanced,
    enhancement: {
      original: meal.title,
      familiar: mapping.familiarName,
      cuisine: mapping.cuisine,
      confidence: mapping.confidence
    }
  };
}

/**
 * Determine expected cuisine for a meal based on cultural distribution
 */
function determineExpectedCuisine(
  mealType: string,
  dayKey: string,
  culturalBackground?: string[],
  targetDistribution?: Record<string, number>
): string | undefined {
  
  if (!culturalBackground || culturalBackground.length === 0) {
    return undefined;
  }

  // If target distribution is specified, use it
  if (targetDistribution) {
    // Simple distribution logic - can be enhanced
    const totalMeals = Object.values(targetDistribution).reduce((sum, count) => sum + count, 0);
    if (totalMeals > 0) {
      // Return cuisine with highest target percentage
      const maxCuisine = Object.entries(targetDistribution)
        .reduce((max, [cuisine, count]) => 
          count > max.count ? { cuisine, count } : max,
          { cuisine: '', count: 0 }
        );
      return maxCuisine.cuisine;
    }
  }

  // Default: rotate through cultural backgrounds
  const dayNumber = parseInt(dayKey.replace('day_', '')) || 1;
  const cuisineIndex = (dayNumber - 1) % culturalBackground.length;
  
  return culturalBackground[cuisineIndex];
}

/**
 * Get enhancement statistics for a meal plan
 */
export function analyzeMealPlanNamingQuality(mealPlan: any): {
  totalMeals: number;
  recognizableMeals: number;
  cuisineDistribution: Record<string, number>;
  qualityScore: number;
  recommendations: string[];
} {
  
  if (!mealPlan?.meal_plan) {
    return {
      totalMeals: 0,
      recognizableMeals: 0,
      cuisineDistribution: {},
      qualityScore: 0,
      recommendations: ['No meal plan structure found']
    };
  }

  let totalMeals = 0;
  let recognizableMeals = 0;
  const cuisineDistribution: Record<string, number> = {};
  const recommendations: string[] = [];
  let totalConfidence = 0;

  // Analyze each meal
  for (const dayKey in mealPlan.meal_plan) {
    const day = mealPlan.meal_plan[dayKey];
    
    for (const mealType in day) {
      const meal = day[mealType];
      totalMeals++;
      
      if (meal.title) {
        const mapping = mapToFamiliarDishName(meal.title);
        totalConfidence += mapping.confidence;
        
        if (mapping.confidence > 0.6) {
          recognizableMeals++;
        }
        
        // Track cuisine distribution
        const cuisine = meal.cuisine_type || mapping.cuisine || 'Unknown';
        cuisineDistribution[cuisine] = (cuisineDistribution[cuisine] || 0) + 1;
      }
    }
  }

  const qualityScore = totalMeals > 0 ? (totalConfidence / totalMeals) * 100 : 0;
  const recognitionRate = totalMeals > 0 ? (recognizableMeals / totalMeals) * 100 : 0;

  // Generate recommendations
  if (recognitionRate < 70) {
    recommendations.push('Consider using more familiar dish names for better user recognition');
  }
  
  if (Object.keys(cuisineDistribution).length > 5) {
    recommendations.push('Meal plan has high cuisine variety - consider focusing on fewer cuisines for better consistency');
  }
  
  if (qualityScore < 60) {
    recommendations.push('Dish names could be more recognizable - focus on well-known dishes');
  }

  return {
    totalMeals,
    recognizableMeals,
    cuisineDistribution,
    qualityScore: Math.round(qualityScore),
    recommendations
  };
}

/**
 * Generate familiar dish suggestions for a cuisine
 */
export function suggestFamiliarDishesForCuisine(
  cuisine: string,
  mealType: string,
  dietaryRestrictions?: string[]
): string[] {
  
  const { getFamiliarDishesByCuisine } = require('./familiarDishNameMapper');
  const dishes = getFamiliarDishesByCuisine(cuisine);
  
  // Filter by meal type and dietary restrictions
  let filteredDishes = dishes.filter(dish => {
    // Basic meal type filtering
    if (mealType === 'breakfast' && !isBreakfastDish(dish.familiarName)) {
      return false;
    }
    
    // Add dietary restriction filtering here if needed
    if (dietaryRestrictions) {
      // This would need integration with dietary validation service
    }
    
    return true;
  });
  
  return filteredDishes.slice(0, 5).map(dish => dish.familiarName);
}

function isBreakfastDish(dishName: string): boolean {
  const breakfastKeywords = [
    'pancake', 'waffle', 'omelette', 'egg', 'toast', 'cereal', 
    'porridge', 'oatmeal', 'smoothie', 'yogurt', 'muffin'
  ];
  
  return breakfastKeywords.some(keyword => 
    dishName.toLowerCase().includes(keyword)
  );
}