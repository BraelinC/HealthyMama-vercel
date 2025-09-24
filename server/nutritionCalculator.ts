/**
 * Enhanced nutrition calculator with proper serving size calculations
 * Uses realistic ingredient quantities and provides per-serving breakdowns
 */

interface NutritionData {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
}

interface ServingAwareNutrition extends NutritionData {
  servings: number;
  perServing: NutritionData;
}

/**
 * Parse ingredient quantity and unit from text
 */
function parseIngredientQuantity(ingredientText: string): { 
  quantity: number; 
  unit: string; 
  foodName: string;
} {
  const text = ingredientText.toLowerCase().trim();
  
  // Common quantity patterns
  const patterns = [
    // Fractions: 1/2, 3/4, etc.
    /^(\d+\/\d+)\s*(\w+)?\s+(.+)/,
    // Decimals: 1.5, 0.25, etc.
    /^(\d*\.?\d+)\s*(\w+)?\s+(.+)/,
    // Range: 1-2, 2-3, etc.
    /^(\d+)-\d+\s*(\w+)?\s+(.+)/,
    // Just number: 2 cups, 1 pound, etc.
    /^(\d+)\s*(\w+)?\s+(.+)/
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let quantity = 1;
      if (match[1].includes('/')) {
        const [num, den] = match[1].split('/').map(Number);
        quantity = num / den;
      } else {
        quantity = parseFloat(match[1]);
      }
      
      const unit = match[2] || '';
      const foodName = match[3].trim();
      
      return { quantity, unit, foodName };
    }
  }
  
  // Default fallback
  return { quantity: 1, unit: '', foodName: text };
}

/**
 * Convert units to standard measurements for nutrition calculation
 */
function convertToGrams(quantity: number, unit: string, foodType: string): number {
  const unitConversions: { [key: string]: number } = {
    // Weight units (already in grams or convert to grams)
    'g': 1,
    'gram': 1,
    'grams': 1,
    'kg': 1000,
    'kilogram': 1000,
    'lb': 453.592,
    'lbs': 453.592,
    'pound': 453.592,
    'pounds': 453.592,
    'oz': 28.3495,
    'ounce': 28.3495,
    'ounces': 28.3495,
    
    // Volume to weight conversions (approximate)
    'cup': 240,        // ml, varies by ingredient
    'cups': 240,
    'tbsp': 15,        // ml
    'tablespoon': 15,
    'tablespoons': 15,
    'tsp': 5,          // ml
    'teaspoon': 5,
    'teaspoons': 5,
    'ml': 1,           // for liquids, 1ml ≈ 1g
    'milliliter': 1,
    'l': 1000,         // liters
    'liter': 1000,
    'liters': 1000,
  };

  // Food-specific density adjustments
  const densityAdjustments: { [key: string]: number } = {
    'flour': 0.5,      // flour is lighter
    'sugar': 0.8,      // sugar is denser
    'oil': 0.9,        // oil is less dense than water
    'butter': 0.9,     // butter density
    'rice': 0.8,       // dry rice
    'pasta': 0.6,      // dry pasta
  };

  let grams = quantity * (unitConversions[unit.toLowerCase()] || 100);
  
  // Apply density adjustment for volume measurements
  if (['cup', 'cups', 'tbsp', 'tablespoon', 'tablespoons', 'tsp', 'teaspoon', 'teaspoons'].includes(unit.toLowerCase())) {
    for (const [food, adjustment] of Object.entries(densityAdjustments)) {
      if (foodType.toLowerCase().includes(food)) {
        grams *= adjustment;
        break;
      }
    }
  }
  
  return Math.max(grams, 10); // Minimum 10g to avoid zero calories
}

/**
 * Calculate nutrition for a single ingredient with proper scaling
 */
async function calculateIngredientNutrition(
  ingredientText: string, 
  usdaNutrition: any
): Promise<NutritionData> {
  const { quantity, unit, foodName } = parseIngredientQuantity(ingredientText);
  const grams = convertToGrams(quantity, unit, foodName);
  
  // Scale USDA nutrition data (per 100g) to actual ingredient amount
  const scale = grams / 100;
  
  const calories = (usdaNutrition.calories || 0) * scale;
  const protein = (usdaNutrition.protein || 0) * scale;
  const carbs = (usdaNutrition.carbs || 0) * scale;
  const fat = (usdaNutrition.fat || 0) * scale;
  const fiber = (usdaNutrition.fiber || 0) * scale;
  const sugar = (usdaNutrition.sugar || 0) * scale;
  const sodium = (usdaNutrition.sodium || 0) * scale;

  console.log(`Nutrition for ${ingredientText}: ${Math.round(calories)}cal (${grams}g scaled from ${quantity} ${unit})`);
  
  return {
    calories: Math.round(calories),
    protein: Math.round(protein * 100) / 100,
    carbs: Math.round(carbs * 100) / 100,
    fat: Math.round(fat * 100) / 100,
    fiber: Math.round(fiber * 100) / 100,
    sugar: Math.round(sugar * 100) / 100,
    sodium: Math.round(sodium * 100) / 100
  };
}

/**
 * Estimate number of servings from recipe context
 */
function estimateServings(recipe: any): number {
  const title = recipe.title?.toLowerCase() || '';
  const instructions = recipe.instructions?.join(' ').toLowerCase() || '';
  const description = recipe.description?.toLowerCase() || '';
  
  // Look for serving size hints in recipe text
  const servingPatterns = [
    /serves?\s+(\d+)/,
    /(\d+)\s+servings?/,
    /makes?\s+(\d+)/,
    /portions?\s+(\d+)/,
    /(\d+)\s+portions?/,
    /feeds?\s+(\d+)/,
    /for\s+(\d+)\s+people/
  ];
  
  const allText = `${title} ${instructions} ${description}`;
  
  for (const pattern of servingPatterns) {
    const match = allText.match(pattern);
    if (match) {
      const servings = parseInt(match[1]);
      if (servings >= 1 && servings <= 12) {
        return servings;
      }
    }
  }
  
  // Estimate based on recipe type and ingredient quantities
  const hasLargeQuantities = recipe.ingredients?.some((ing: any) => {
    const ingredientText = typeof ing === 'string' ? ing : ing.display_text || ing.name || String(ing);
    const text = String(ingredientText).toLowerCase();
    return text.includes('lb') || text.includes('pound') || 
           text.includes('2 cup') || text.includes('3 cup') ||
           text.includes('large') || text.includes('whole');
  });
  
  // Default serving estimates
  if (title.includes('family') || hasLargeQuantities) return 6;
  if (title.includes('single') || title.includes('one')) return 1;
  if (title.includes('couple') || title.includes('two')) return 2;
  
  return 4; // Default to 4 servings
}

/**
 * Calculate complete recipe nutrition with proper serving breakdown
 */
export async function calculateRecipeNutrition(
  recipe: any,
  getUSDANutrition: (foodName: string) => Promise<any>
): Promise<ServingAwareNutrition> {
  const servings = estimateServings(recipe);
  console.log(`Estimated servings for "${recipe.title}": ${servings}`);
  
  let totalNutrition: NutritionData = {
    calories: 0, protein: 0, carbs: 0, fat: 0,
    fiber: 0, sugar: 0, sodium: 0
  };
  
  if (recipe.ingredients && recipe.ingredients.length > 0) {
    for (const ingredient of recipe.ingredients) {
      const ingredientText = typeof ingredient === 'string' 
        ? ingredient 
        : ingredient.display_text || ingredient.name || String(ingredient);
      
      try {
        // Ensure ingredientText is a string before processing
        const cleanIngredientText = String(ingredientText).trim();
        if (!cleanIngredientText) continue;
        
        const { foodName } = parseIngredientQuantity(cleanIngredientText);
        const usdaNutrition = await getUSDANutrition(foodName);
        
        if (usdaNutrition) {
          const nutrition = await calculateIngredientNutrition(cleanIngredientText, usdaNutrition);
          
          totalNutrition.calories += nutrition.calories;
          totalNutrition.protein += nutrition.protein;
          totalNutrition.carbs += nutrition.carbs;
          totalNutrition.fat += nutrition.fat;
          totalNutrition.fiber += nutrition.fiber;
          totalNutrition.sugar += nutrition.sugar;
          totalNutrition.sodium += nutrition.sodium;
        }
      } catch (error) {
        console.error(`Error calculating nutrition for ${ingredientText}:`, error);
      }
    }
  }
  
  // Calculate per-serving nutrition
  const perServing: NutritionData = {
    calories: Math.round(totalNutrition.calories / servings),
    protein: Math.round((totalNutrition.protein / servings) * 100) / 100,
    carbs: Math.round((totalNutrition.carbs / servings) * 100) / 100,
    fat: Math.round((totalNutrition.fat / servings) * 100) / 100,
    fiber: Math.round((totalNutrition.fiber / servings) * 100) / 100,
    sugar: Math.round((totalNutrition.sugar / servings) * 100) / 100,
    sodium: Math.round((totalNutrition.sodium / servings) * 100) / 100
  };
  
  console.log(`Total nutrition: ${totalNutrition.calories}cal for ${servings} servings`);
  console.log(`Per serving: ${perServing.calories}cal, ${perServing.protein}g protein, ${perServing.carbs}g carbs, ${perServing.fat}g fat`);
  
  return {
    ...totalNutrition,
    servings,
    perServing
  };
}