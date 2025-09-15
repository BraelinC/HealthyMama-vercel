/**
 * Simple, direct meal plan generator that works reliably
 * Generates complete meal plans for any number of days at low cost
 */

interface MealPlanRequest {
  numDays: number;
  mealsPerDay: number;
  cookTime: number;
  difficulty: number;
  nutritionGoal?: string;
  dietaryRestrictions?: string;
  availableIngredients?: string;
  excludeIngredients?: string;
}

/**
 * Generate a complete meal plan using a simple, reliable approach
 */
export async function generateMealPlan(request: MealPlanRequest) {
  const { numDays, mealsPerDay, cookTime, difficulty, nutritionGoal, dietaryRestrictions } = request;

  // Use batch optimization for 2-day blocks
  const { generateOptimizedBatch, extractBatchIngredients } = await import('./batchMealOptimizer');
  
  const mealPlan: any = { meal_plan: {} };
  let totalSavings = 0;
  let allIngredients: string[] = [];
  let previousIngredients: string[] = [];

  // Generate in 2-day batches for optimal ingredient reuse
  for (let day = 1; day <= numDays; day += 2) {
    const isLastBatch = day + 1 > numDays;
    
    if (isLastBatch) {
      // Handle single remaining day
      const { generateIngredientOptimizedMeal } = await import('./smartIngredientOptimizer');
      mealPlan.meal_plan[`day_${day}`] = {};
      
      const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'].slice(0, mealsPerDay);
      for (const mealType of mealTypes) {
        const meal = await generateIngredientOptimizedMeal(
          mealType, day, previousIngredients, cookTime, difficulty, nutritionGoal, dietaryRestrictions
        );
        mealPlan.meal_plan[`day_${day}`][mealType] = meal;
        if (meal.ingredients) allIngredients.push(...meal.ingredients);
      }
    } else {
      // Generate 2-day batch
      const batch = await generateOptimizedBatch({
        startDay: day,
        mealsPerDay,
        cookTime,
        difficulty,
        nutritionGoal,
        dietaryRestrictions,
        previousIngredients
      });

      // Add batch days to meal plan
      mealPlan.meal_plan[`day_${day}`] = batch.day_1;
      mealPlan.meal_plan[`day_${day + 1}`] = batch.day_2;

      // Track savings and ingredients
      totalSavings += batch.estimated_savings;
      const batchIngredients = extractBatchIngredients(batch);
      allIngredients.push(...batchIngredients);
      previousIngredients = batchIngredients; // Pass to next batch
    }
  }

  // Generate optimized shopping list
  const uniqueIngredients = [...new Set(allIngredients)];
  const ingredientFrequency: { [key: string]: number } = {};
  allIngredients.forEach(ing => {
    ingredientFrequency[ing] = (ingredientFrequency[ing] || 0) + 1;
  });

  // Create smart shopping list with bulk recommendations
  const shoppingList = uniqueIngredients.map(ingredient => {
    const count = ingredientFrequency[ingredient];
    if (count >= 4) return `${ingredient} (bulk size - save 35%)`;
    if (count >= 3) return `${ingredient} (bulk size - save 25%)`;
    if (count >= 2) return `${ingredient} (save 15%)`;
    return ingredient;
  });

  mealPlan.shopping_list = shoppingList;
  mealPlan.estimated_savings = Math.round(totalSavings * 100) / 100;
  mealPlan.ingredient_frequency = ingredientFrequency;
  
  mealPlan.prep_tips = [
    `Estimated grocery savings: $${mealPlan.estimated_savings.toFixed(2)} from smart ingredient reuse`,
    "Focus on bulk buying for ingredients used 3+ times",
    "Prep shared ingredients in batches to save time",
    "Store bulk ingredients properly to prevent waste"
  ];

  console.log(`Generated ${numDays}-day meal plan with $${mealPlan.estimated_savings} estimated savings`);
  return mealPlan;
}

// Single meal generation moved to smartIngredientOptimizer.ts for better reusability

/**
 * Generate shopping list from meal plan
 */
function generateShoppingList(mealPlan: any): string[] {
  const ingredients = new Set<string>();
  
  Object.values(mealPlan).forEach((day: any) => {
    Object.values(day).forEach((meal: any) => {
      if (meal.ingredients) {
        meal.ingredients.forEach((ingredient: string) => ingredients.add(ingredient));
      }
    });
  });
  
  return Array.from(ingredients);
}