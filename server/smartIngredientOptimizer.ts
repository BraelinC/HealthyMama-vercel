/**
 * Smart ingredient optimization for cost-effective meal planning
 * Maximizes ingredient reuse and bulk buying opportunities
 */

interface MealIngredient {
  name: string;
  quantity?: number;
}

interface OptimizedMeal {
  title: string;
  cook_time_minutes: number;
  difficulty: number;
  ingredients: string[];
  day: number;
  mealType: string;
}

interface IngredientAnalysis {
  name: string;
  totalQuantity: number;
  usageCount: number;
  estimatedCost: number;
  bulkSavings: number;
}

/**
 * Optimize meal plan for ingredient reuse and cost savings
 */
export function optimizeMealPlanForIngredients(mealPlan: any): {
  optimizedPlan: any;
  ingredientAnalysis: IngredientAnalysis[];
  estimatedSavings: number;
  shoppingList: string[];
} {
  // Extract all ingredients from the meal plan
  const allIngredients = extractAllIngredients(mealPlan);
  
  // Analyze ingredient frequency and costs
  const ingredientAnalysis = analyzeIngredientFrequency(allIngredients);
  
  // Calculate bulk savings
  const savings = calculateBulkSavings(ingredientAnalysis);
  
  // Generate optimized shopping list
  const shoppingList = generateOptimizedShoppingList(ingredientAnalysis);
  
  return {
    optimizedPlan: mealPlan,
    ingredientAnalysis,
    estimatedSavings: savings,
    shoppingList
  };
}

/**
 * Extract all ingredients from meal plan with frequency tracking
 */
function extractAllIngredients(mealPlan: any): { [key: string]: number } {
  const ingredientFrequency: { [key: string]: number } = {};
  
  Object.values(mealPlan.meal_plan).forEach((day: any) => {
    Object.values(day).forEach((meal: any) => {
      if (meal.ingredients) {
        meal.ingredients.forEach((ingredient: string) => {
          const normalizedName = normalizeIngredientName(ingredient);
          ingredientFrequency[normalizedName] = (ingredientFrequency[normalizedName] || 0) + 1;
        });
      }
    });
  });
  
  return ingredientFrequency;
}

/**
 * Normalize ingredient names for better matching
 */
function normalizeIngredientName(ingredient: string): string {
  return ingredient
    .toLowerCase()
    .replace(/\b(fresh|dried|organic|chopped|sliced|diced)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Analyze ingredient frequency and calculate costs
 */
function analyzeIngredientFrequency(ingredients: { [key: string]: number }): IngredientAnalysis[] {
  return Object.entries(ingredients).map(([name, count]) => {
    const basePrice = getBaseIngredientPrice(name);
    const totalQuantity = count; // Simplified: 1 unit per use
    
    // Calculate bulk pricing
    const regularCost = totalQuantity * basePrice;
    const bulkMultiplier = getBulkMultiplier(totalQuantity);
    const bulkCost = regularCost * bulkMultiplier;
    const savings = regularCost - bulkCost;
    
    return {
      name,
      totalQuantity,
      usageCount: count,
      estimatedCost: bulkCost,
      bulkSavings: savings
    };
  });
}

/**
 * Get estimated base price for common ingredients with enhanced matching
 */
function getBaseIngredientPrice(ingredient: string): number {
  const priceMap: { [key: string]: number } = {
    // Proteins
    'chicken': 3.50, 'beef': 5.00, 'salmon': 6.00, 'turkey': 4.00, 'eggs': 0.25,
    'pork': 4.50, 'fish': 5.50, 'shrimp': 7.00, 'tuna': 3.00, 'bacon': 5.50,
    'ground beef': 5.00, 'chicken breast': 4.00, 'chicken thigh': 3.00,
    // Vegetables
    'spinach': 2.50, 'broccoli': 2.00, 'bell pepper': 1.50, 'onion': 1.00, 'tomato': 2.00,
    'carrot': 1.00, 'garlic': 0.50, 'lettuce': 2.00, 'cucumber': 1.50,
    'potato': 1.20, 'sweet potato': 1.80, 'zucchini': 1.50, 'mushroom': 2.50,
    'celery': 1.50, 'cabbage': 1.00, 'corn': 1.30, 'peas': 2.00,
    // Pantry items
    'olive oil': 0.30, 'soy sauce': 0.20, 'salt': 0.05, 'pepper': 0.10,
    'rice': 1.00, 'pasta': 1.50, 'bread': 2.50, 'flour': 1.20,
    'sugar': 0.80, 'vinegar': 0.15, 'honey': 0.40, 'oil': 0.25,
    // Dairy
    'cheese': 3.00, 'milk': 1.00, 'butter': 0.50, 'yogurt': 1.50,
    'cream': 2.00, 'sour cream': 1.80, 'mozzarella': 3.50, 'parmesan': 4.00,
    // Herbs/Spices
    'basil': 1.00, 'oregano': 0.50, 'thyme': 0.50, 'ginger': 1.50,
    'cilantro': 1.00, 'parsley': 1.00, 'rosemary': 0.80, 'paprika': 0.60,
    // Grains & Legumes
    'quinoa': 2.50, 'beans': 1.50, 'lentils': 1.80, 'chickpeas': 1.60,
    'oats': 1.20, 'barley': 1.40, 'couscous': 1.80
  };
  
  const normalizedIngredient = ingredient.toLowerCase().trim();
  
  // Direct match first
  if (priceMap[normalizedIngredient]) {
    return priceMap[normalizedIngredient];
  }
  
  // Fuzzy matching with scoring
  let bestMatch = { score: 0, price: 2.00 };
  
  for (const [key, price] of Object.entries(priceMap)) {
    const score = calculateIngredientMatchScore(normalizedIngredient, key);
    if (score > bestMatch.score && score > 0.5) {
      bestMatch = { score, price };
    }
  }
  
  return bestMatch.price;
}

/**
 * Calculate similarity score between ingredients for better price matching
 */
function calculateIngredientMatchScore(ingredient: string, reference: string): number {
  // Exact match
  if (ingredient === reference) return 1.0;
  
  // Contains match
  if (ingredient.includes(reference) || reference.includes(ingredient)) {
    return 0.8;
  }
  
  // Word overlap scoring
  const ingredientWords = ingredient.split(/\s+/);
  const referenceWords = reference.split(/\s+/);
  
  let matchingWords = 0;
  for (const word of ingredientWords) {
    if (referenceWords.some(refWord => 
      word.includes(refWord) || refWord.includes(word) || 
      levenshteinDistance(word, refWord) <= 2
    )) {
      matchingWords++;
    }
  }
  
  return matchingWords / Math.max(ingredientWords.length, referenceWords.length);
}

/**
 * Calculate Levenshtein distance for fuzzy string matching
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
  
  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const substitutionCost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + substitutionCost // substitution
      );
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Calculate bulk discount multiplier based on quantity with enhanced tiers
 */
function getBulkMultiplier(quantity: number): number {
  if (quantity >= 7) return 0.55; // 45% savings for very high reuse
  if (quantity >= 5) return 0.65; // 35% savings for high reuse
  if (quantity >= 3) return 0.75; // 25% savings for medium reuse
  if (quantity >= 2) return 0.85; // 15% savings for some reuse
  return 1.0; // No savings for single use
}

/**
 * Get bulk recommendations based on ingredient type and usage
 */
function getBulkRecommendation(ingredient: string, usageCount: number): string {
  const ingredientType = classifyIngredientType(ingredient);
  
  if (usageCount >= 5) {
    switch (ingredientType) {
      case 'protein':
        return 'Buy family pack - freeze portions';
      case 'produce':
        return 'Buy bulk - prep and store properly';
      case 'pantry':
        return 'Buy largest size available';
      case 'dairy':
        return 'Buy larger container if within expiry';
      default:
        return 'Consider bulk purchase';
    }
  } else if (usageCount >= 3) {
    return 'Buy medium/bulk size';
  } else if (usageCount >= 2) {
    return 'Buy regular size';
  }
  
  return '';
}

/**
 * Classify ingredient type for better bulk recommendations
 */
function classifyIngredientType(ingredient: string): string {
  const lowerIngredient = ingredient.toLowerCase();
  
  if (/chicken|beef|pork|fish|salmon|turkey|bacon|ground|meat/.test(lowerIngredient)) {
    return 'protein';
  }
  if (/tomato|onion|carrot|potato|pepper|spinach|broccoli|lettuce|cucumber/.test(lowerIngredient)) {
    return 'produce';
  }
  if (/milk|cheese|butter|yogurt|cream|dairy/.test(lowerIngredient)) {
    return 'dairy';
  }
  if (/rice|pasta|flour|oil|sauce|salt|pepper|sugar|honey|vinegar/.test(lowerIngredient)) {
    return 'pantry';
  }
  
  return 'other';
}

/**
 * Calculate total estimated savings from bulk buying
 */
function calculateBulkSavings(ingredientAnalysis: IngredientAnalysis[]): number {
  return ingredientAnalysis.reduce((total, ingredient) => total + ingredient.bulkSavings, 0);
}

/**
 * Generate optimized shopping list with enhanced bulk recommendations
 */
function generateOptimizedShoppingList(ingredientAnalysis: IngredientAnalysis[]): string[] {
  return ingredientAnalysis
    .sort((a, b) => {
      // Primary sort: bulk savings potential
      if (b.bulkSavings !== a.bulkSavings) {
        return b.bulkSavings - a.bulkSavings;
      }
      // Secondary sort: usage frequency
      return b.usageCount - a.usageCount;
    })
    .map(ingredient => {
      const bulkRecommendation = getBulkRecommendation(ingredient.name, ingredient.usageCount);
      const savingsIndicator = ingredient.bulkSavings > 0.50 ? ` - Save $${ingredient.bulkSavings.toFixed(2)}` : '';
      const usageIndicator = ingredient.usageCount > 1 ? ` (used ${ingredient.usageCount}x)` : '';
      
      let itemText = ingredient.name;
      
      if (bulkRecommendation) {
        itemText += ` - ${bulkRecommendation}`;
      }
      
      itemText += usageIndicator + savingsIndicator;
      
      return itemText;
    });
}

/**
 * Generate shopping list sections organized by store departments
 */
export function generateOrganizedShoppingList(ingredientAnalysis: IngredientAnalysis[]): {
  produce: string[];
  meat: string[];
  dairy: string[];
  pantry: string[];
  other: string[];
  totalSavings: number;
  highValueItems: string[];
} {
  const sections = {
    produce: [] as string[],
    meat: [] as string[],
    dairy: [] as string[],
    pantry: [] as string[],
    other: [] as string[]
  };
  
  const highValueItems: string[] = [];
  const totalSavings = ingredientAnalysis.reduce((sum, item) => sum + item.bulkSavings, 0);
  
  ingredientAnalysis
    .sort((a, b) => b.bulkSavings - a.bulkSavings)
    .forEach(ingredient => {
      const type = classifyIngredientType(ingredient.name);
      const bulkRecommendation = getBulkRecommendation(ingredient.name, ingredient.usageCount);
      const savingsText = ingredient.bulkSavings > 0.50 ? ` - Save $${ingredient.bulkSavings.toFixed(2)}` : '';
      const usageText = ingredient.usageCount > 1 ? ` (${ingredient.usageCount}x)` : '';
      
      let itemText = ingredient.name;
      if (bulkRecommendation) {
        itemText += ` - ${bulkRecommendation}`;
      }
      itemText += usageText + savingsText;
      
      // Track high-value items for priority shopping
      if (ingredient.bulkSavings > 1.00) {
        highValueItems.push(ingredient.name);
      }
      
      switch (type) {
        case 'produce':
          sections.produce.push(itemText);
          break;
        case 'protein':
          sections.meat.push(itemText);
          break;
        case 'dairy':
          sections.dairy.push(itemText);
          break;
        case 'pantry':
          sections.pantry.push(itemText);
          break;
        default:
          sections.other.push(itemText);
      }
    });
  
  return {
    ...sections,
    totalSavings,
    highValueItems
  };
}

/**
 * Score meals based on ingredient overlap for better planning
 */
export function scoreMealOverlap(meal1: any, meal2: any): number {
  if (!meal1.ingredients || !meal2.ingredients) return 0;
  
  const set1 = new Set(meal1.ingredients.map(normalizeIngredientName));
  const set2 = new Set(meal2.ingredients.map(normalizeIngredientName));
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size;
}

/**
 * Enhanced meal generation that considers ingredient optimization
 */
export async function generateIngredientOptimizedMeal(
  mealType: string,
  dayNumber: number,
  existingIngredients: string[],
  cookTime: number,
  difficulty: number,
  nutritionGoal?: string,
  dietaryRestrictions?: string
) {
  const commonIngredients = existingIngredients.slice(0, 2); // Reuse up to 2 ingredients
  const ingredientHint = commonIngredients.length > 0 
    ? `Try to include: ${commonIngredients.join(', ')}.` 
    : '';

  const prompt = `Generate a ${mealType} recipe for day ${dayNumber}. Max ${cookTime} minutes, difficulty MAXIMUM ${difficulty}/5 (use 0.5 increments: 1, 1.5, 2, 2.5, 3, etc.). ${nutritionGoal ? `Goal: ${nutritionGoal}.` : ''} ${dietaryRestrictions ? `Restrictions: ${dietaryRestrictions}.` : ''} ${ingredientHint}

Return JSON:
{
  "title": "Recipe Name",
  "cook_time_minutes": ${Math.min(cookTime, 30)},
  "difficulty": ${difficulty},
  "ingredients": ["ingredient1", "ingredient2", "ingredient3"]
}`;

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
          { role: 'system', content: 'Generate meal recipes that efficiently reuse ingredients when possible. CRITICAL: Respect difficulty constraints and use 0.5 increments for precise difficulty ratings.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 150
      })
    });

    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
  } catch (error) {
    return {
      title: `Quick ${mealType}`,
      cook_time_minutes: Math.min(cookTime, 20),
      difficulty: difficulty,
      ingredients: [...commonIngredients, "protein", "vegetable"].slice(0, 3)
    };
  }
}