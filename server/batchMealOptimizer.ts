/**
 * Batch-optimized meal planner that generates 2-day blocks with smart ingredient reuse
 * Significantly reduces API costs and improves ingredient optimization
 * Now includes intelligent cooking time and difficulty calculation
 */

import { enhanceMealWithIntelligentTiming, validateMealConstraints, getDifficultyAdjustedPromptSuffix } from "./intelligentPromptBuilder";

interface BatchMealRequest {
  startDay: number;
  mealsPerDay: number;
  cookTime: number;
  difficulty: number;
  primaryGoal?: string; // UNIFIED: Use primaryGoal instead of nutritionGoal
  nutritionGoal?: string; // Keep for backward compatibility
  dietaryRestrictions?: string;
  previousIngredients?: string[];
}

interface BatchMealResponse {
  day_1: any;
  day_2: any;
  ingredient_summary: {
    reused_ingredients: string[];
    total_ingredients: string[];
    reuse_count: { [ingredient: string]: number };
  };
  estimated_savings: number;
}

/**
 * Generate optimized 2-day meal batch using single ChatGPT call
 */
export async function generateOptimizedBatch(request: BatchMealRequest): Promise<BatchMealResponse> {
  const { startDay, mealsPerDay, cookTime, difficulty, primaryGoal, nutritionGoal, dietaryRestrictions, previousIngredients } = request;
  
  // UNIFIED GOAL SYSTEM: Use primaryGoal, fallback to nutritionGoal for compatibility
  const unifiedGoal = primaryGoal || nutritionGoal || 'balanced nutrition';

  const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'].slice(0, mealsPerDay);
  const previousIngredientHint = previousIngredients && previousIngredients.length > 0 
    ? `Try to reuse these ingredients from previous days: ${previousIngredients.slice(0, 5).join(', ')}.` 
    : '';

  const timingGuidance = getDifficultyAdjustedPromptSuffix(difficulty);
  
  const prompt = `Generate a cost-efficient 2-day meal plan (Day ${startDay} and Day ${startDay + 1}) optimized for ingredient reuse and bulk buying.

CRITICAL REQUIREMENTS:
- Generate exactly ${mealsPerDay} meals per day (${mealTypes.join(', ')})
- At least 3-4 ingredients must be reused across multiple meals within these 2 days
- Each meal must be unique and different
- Max cook time: ${cookTime} minutes per meal (including prep + cooking time)
- Difficulty: MAXIMUM ${difficulty}/5 (use 0.5 increments: 1, 1.5, 2, 2.5, 3, etc.)
- CRITICAL: ALL recipes must have difficulty <= ${difficulty}
- Use precise difficulty ratings in 0.5 increments for accurate complexity assessment
- Goal: ${unifiedGoal}
${dietaryRestrictions ? `- Dietary restrictions: ${dietaryRestrictions}` : ''}
${previousIngredientHint}

OPTIMIZATION STRATEGY:
- Prioritize ingredients that can be used in 3+ meals (triggers bulk savings)
- Use common, affordable ingredients
- Balance nutrition: 1 protein + 1 carb + 1-2 vegetables per meal
- Vary cooking methods but reuse core ingredients

${timingGuidance}

OUTPUT FORMAT (JSON):
{
  "day_1": {
    ${mealTypes.map(meal => `"${meal}": {"title": "Recipe Name", "cook_time_minutes": 20, "difficulty": ${difficulty}, "ingredients": ["ingredient1", "ingredient2", "ingredient3"]}`).join(',\n    ')}
  },
  "day_2": {
    ${mealTypes.map(meal => `"${meal}": {"title": "Different Recipe Name", "cook_time_minutes": 25, "difficulty": ${difficulty}, "ingredients": ["ingredient1", "ingredient4", "ingredient5"]}`).join(',\n    ')}
  },
  "ingredient_summary": {
    "reused_ingredients": ["ingredient1", "ingredient2"],
    "total_ingredients": ["ingredient1", "ingredient2", "ingredient3", "ingredient4", "ingredient5"],
    "reuse_count": {"ingredient1": 4, "ingredient2": 3}
  },
  "estimated_savings": 8.50
}

MAXIMIZE INGREDIENT REUSE for bulk buying opportunities!`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a cost-optimization meal planner. Generate meals that maximize ingredient reuse across a 2-day batch to reduce grocery costs and enable bulk buying. CRITICAL: Respect the user\'s difficulty level - never exceed the specified maximum difficulty. Always return valid JSON with the exact structure requested.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 1200
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const batchResult = JSON.parse(data.choices[0].message.content);

    // Validate difficulty constraints before returning
    validateDifficultyConstraints(batchResult, difficulty);

    // Validate and enhance the response
    return enhanceBatchResponse(batchResult, startDay, request);

  } catch (error) {
    console.error('Batch generation error:', error);
    return generateFallbackBatch(request);
  }
}

/**
 * Enhance batch response with additional optimization data and intelligent timing
 */
function enhanceBatchResponse(batchResult: any, startDay: number, originalRequest?: BatchMealRequest): BatchMealResponse {
  // Calculate actual savings based on ingredient reuse
  const reuseCount = batchResult.ingredient_summary?.reuse_count || {};
  let calculatedSavings = 0;

  Object.entries(reuseCount).forEach(([ingredient, count]: [string, any]) => {
    const basePrice = getIngredientBasePrice(ingredient);
    if (count >= 4) calculatedSavings += basePrice * 0.35; // 35% savings
    else if (count >= 3) calculatedSavings += basePrice * 0.25; // 25% savings
    else if (count >= 2) calculatedSavings += basePrice * 0.15; // 15% savings
  });

  // Enhance all meals with intelligent timing if we have the request data
  let enhancedDay1 = batchResult.day_1;
  let enhancedDay2 = batchResult.day_2;
  let timingAnalysis = {};

  if (originalRequest) {
    // Process day 1 meals
    enhancedDay1 = {};
    Object.keys(batchResult.day_1).forEach(mealType => {
      const meal = batchResult.day_1[mealType];
      enhancedDay1[mealType] = enhanceMealWithIntelligentTiming(meal);
    });
    
    // Process day 2 meals
    enhancedDay2 = {};
    Object.keys(batchResult.day_2).forEach(mealType => {
      const meal = batchResult.day_2[mealType];
      enhancedDay2[mealType] = enhanceMealWithIntelligentTiming(meal);
    });

    // Calculate timing analysis
    const allMeals = Object.values(enhancedDay1).concat(Object.values(enhancedDay2));
    timingAnalysis = {
      total_prep_time: allMeals.reduce((sum: number, meal: any) => sum + (meal.prep_time_minutes || 0), 0),
      total_cook_time: allMeals.reduce((sum: number, meal: any) => sum + (meal.actual_cook_time_minutes || 0), 0),
      average_difficulty: allMeals.reduce((sum: number, meal: any) => sum + (meal.difficulty || 0), 0) / allMeals.length
    };
  }

  return {
    day_1: enhancedDay1,
    day_2: enhancedDay2,
    ingredient_summary: batchResult.ingredient_summary,
    estimated_savings: Math.round(calculatedSavings * 100) / 100,
    ...(originalRequest && { timing_analysis: timingAnalysis })
  };
}

/**
 * Generate fallback batch if API fails
 */
function generateFallbackBatch(request: BatchMealRequest): BatchMealResponse {
  const { startDay, mealsPerDay } = request;
  const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'].slice(0, mealsPerDay);
  
  const commonIngredients = ['chicken', 'spinach', 'rice', 'onion', 'garlic'];
  const batch: any = { day_1: {}, day_2: {} };

  mealTypes.forEach((mealType, index) => {
    batch.day_1[mealType] = {
      title: `Quick ${mealType} Day ${startDay}`,
      cook_time_minutes: 20,
      difficulty: 2,
      ingredients: [commonIngredients[index % 3], commonIngredients[(index + 1) % 3], commonIngredients[(index + 2) % 3]]
    };
    
    batch.day_2[mealType] = {
      title: `Simple ${mealType} Day ${startDay + 1}`,
      cook_time_minutes: 25,
      difficulty: 2,
      ingredients: [commonIngredients[index % 3], commonIngredients[(index + 2) % 3], 'vegetables']
    };
  });

  return {
    day_1: batch.day_1,
    day_2: batch.day_2,
    ingredient_summary: {
      reused_ingredients: commonIngredients.slice(0, 3),
      total_ingredients: [...commonIngredients, 'vegetables'],
      reuse_count: { 'chicken': 4, 'spinach': 3, 'rice': 3 }
    },
    estimated_savings: 6.50
  };
}

/**
 * Get base price for ingredient calculations
 */
function getIngredientBasePrice(ingredient: string): number {
  const priceMap: { [key: string]: number } = {
    'chicken': 4.00, 'beef': 6.00, 'salmon': 7.00, 'turkey': 4.50,
    'spinach': 3.00, 'broccoli': 2.50, 'bell pepper': 2.00, 'onion': 1.50,
    'rice': 2.00, 'pasta': 2.50, 'bread': 3.00, 'potatoes': 2.00,
    'garlic': 1.00, 'olive oil': 1.50, 'cheese': 4.00, 'eggs': 3.00
  };
  
  for (const [key, price] of Object.entries(priceMap)) {
    if (ingredient.toLowerCase().includes(key) || key.includes(ingredient.toLowerCase())) {
      return price;
    }
  }
  
  return 2.50; // Default price
}

/**
 * Extract all ingredients from a batch for cross-batch optimization
 */
export function extractBatchIngredients(batch: BatchMealResponse): string[] {
  const ingredients: string[] = [];
  
  [batch.day_1, batch.day_2].forEach(day => {
    Object.values(day).forEach((meal: any) => {
      if (meal.ingredients) {
        ingredients.push(...meal.ingredients);
      }
    });
  });
  
  return [...new Set(ingredients)]; // Remove duplicates
}

/**
 * Validate and round difficulty to closest 0.5 increment within constraints
 */
function validateDifficultyConstraints(batchResult: any, maxDifficulty: number) {
  const days = [batchResult.day_1, batchResult.day_2];
  
  days.forEach((day, dayIndex) => {
    if (!day) return;
    
    Object.entries(day).forEach(([mealType, meal]: [string, any]) => {
      if (meal && typeof meal.difficulty === 'number') {
        // Round to nearest 0.5 increment
        const roundedDifficulty = Math.round(meal.difficulty * 2) / 2;
        
        // Ensure it doesn't exceed the maximum
        const finalDifficulty = Math.min(roundedDifficulty, maxDifficulty);
        
        if (meal.difficulty !== finalDifficulty) {
          console.log(`Adjusted difficulty: ${mealType} on day ${dayIndex + 1} from ${meal.difficulty} to ${finalDifficulty}`);
          meal.difficulty = finalDifficulty;
        }
      }
    });
  });
}