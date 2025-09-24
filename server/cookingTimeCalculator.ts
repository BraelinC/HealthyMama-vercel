/**
 * Intelligent Cooking Time & Difficulty Calculation System
 * Advanced algorithm for accurate time estimation and difficulty scoring
 * Based on ingredient analysis, cooking methods, and complexity factors
 */

interface CookingMethod {
  name: string;
  baseTimeMinutes: number;
  difficultyMultiplier: number;
  simultaneousCapable: boolean;
}

interface IngredientComplexity {
  name: string;
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  difficultyScore: number;
  category: 'protein' | 'vegetable' | 'grain' | 'dairy' | 'spice' | 'sauce' | 'other';
}

interface Recipe {
  title: string;
  ingredients: string[];
  instructions?: string[];
  servings?: number;
}

interface CookingTimeResult {
  totalMinutes: number;
  prepTime: number;
  cookTime: number;
  difficulty: number;
  breakdown: {
    ingredients: { name: string; prepTime: number; cookTime: number }[];
    methods: string[];
    complexityFactors: string[];
  };
  recommendations: string[];
}

/**
 * Specific baking recipe database for accurate timing
 */
interface BakingRecipe {
  patterns: string[];
  baseTimeMinutes: number;
  difficultyScore: number;
  prepTimeMinutes: number;
}

const BAKING_RECIPES: BakingRecipe[] = [
  { patterns: ['cookie', 'biscotti', 'macaroon'], baseTimeMinutes: 12, difficultyScore: 2, prepTimeMinutes: 15 },
  { patterns: ['muffin', 'cupcake'], baseTimeMinutes: 18, difficultyScore: 2, prepTimeMinutes: 10 },
  { patterns: ['bread', 'loaf', 'sourdough'], baseTimeMinutes: 45, difficultyScore: 4, prepTimeMinutes: 30 },
  { patterns: ['cake', 'layer cake'], baseTimeMinutes: 35, difficultyScore: 3, prepTimeMinutes: 20 },
  { patterns: ['pie', 'tart'], baseTimeMinutes: 40, difficultyScore: 3, prepTimeMinutes: 25 },
  { patterns: ['pizza', 'flatbread'], baseTimeMinutes: 15, difficultyScore: 2, prepTimeMinutes: 20 },
  { patterns: ['casserole', 'lasagna'], baseTimeMinutes: 45, difficultyScore: 3, prepTimeMinutes: 25 },
  { patterns: ['roast chicken', 'roasted chicken', 'roast turkey', 'roasted turkey'], baseTimeMinutes: 60, difficultyScore: 3, prepTimeMinutes: 15 },
  { patterns: ['brownie', 'bar'], baseTimeMinutes: 25, difficultyScore: 2, prepTimeMinutes: 15 },
  { patterns: ['scone', 'biscuit'], baseTimeMinutes: 20, difficultyScore: 2, prepTimeMinutes: 12 }
];

/**
 * Comprehensive cooking methods database with timing and difficulty data
 */
const COOKING_METHODS: CookingMethod[] = [
  { name: 'boiling', baseTimeMinutes: 15, difficultyMultiplier: 1.0, simultaneousCapable: true },
  { name: 'sautéing', baseTimeMinutes: 8, difficultyMultiplier: 1.2, simultaneousCapable: true },
  { name: 'roasting', baseTimeMinutes: 45, difficultyMultiplier: 1.1, simultaneousCapable: false },
  { name: 'grilling', baseTimeMinutes: 20, difficultyMultiplier: 1.3, simultaneousCapable: false },
  { name: 'baking', baseTimeMinutes: 30, difficultyMultiplier: 1.2, simultaneousCapable: false }, // This will be overridden by smart detection
  { name: 'frying', baseTimeMinutes: 12, difficultyMultiplier: 1.4, simultaneousCapable: true },
  { name: 'steaming', baseTimeMinutes: 20, difficultyMultiplier: 1.0, simultaneousCapable: true },
  { name: 'braising', baseTimeMinutes: 120, difficultyMultiplier: 1.5, simultaneousCapable: false },
  { name: 'stir-frying', baseTimeMinutes: 10, difficultyMultiplier: 1.3, simultaneousCapable: true },
  { name: 'slow cooking', baseTimeMinutes: 240, difficultyMultiplier: 0.8, simultaneousCapable: false },
  { name: 'pressure cooking', baseTimeMinutes: 25, difficultyMultiplier: 1.1, simultaneousCapable: false },
  { name: 'marinating', baseTimeMinutes: 60, difficultyMultiplier: 0.5, simultaneousCapable: true },
  { name: 'blanching', baseTimeMinutes: 5, difficultyMultiplier: 1.1, simultaneousCapable: true },
  { name: 'poaching', baseTimeMinutes: 15, difficultyMultiplier: 1.2, simultaneousCapable: true },
  { name: 'smoking', baseTimeMinutes: 180, difficultyMultiplier: 1.8, simultaneousCapable: false }
];

/**
 * Detailed ingredient complexity database
 */
const INGREDIENT_COMPLEXITY: { [key: string]: IngredientComplexity } = {
  // Proteins (high prep/cook time, varying difficulty)
  'chicken breast': { name: 'chicken breast', prepTimeMinutes: 5, cookTimeMinutes: 20, difficultyScore: 2, category: 'protein' },
  'chicken thigh': { name: 'chicken thigh', prepTimeMinutes: 3, cookTimeMinutes: 25, difficultyScore: 2, category: 'protein' },
  'ground beef': { name: 'ground beef', prepTimeMinutes: 2, cookTimeMinutes: 15, difficultyScore: 1, category: 'protein' },
  'salmon': { name: 'salmon', prepTimeMinutes: 3, cookTimeMinutes: 15, difficultyScore: 3, category: 'protein' },
  'shrimp': { name: 'shrimp', prepTimeMinutes: 8, cookTimeMinutes: 5, difficultyScore: 2, category: 'protein' },
  'beef steak': { name: 'beef steak', prepTimeMinutes: 2, cookTimeMinutes: 12, difficultyScore: 3, category: 'protein' },
  'pork chops': { name: 'pork chops', prepTimeMinutes: 3, cookTimeMinutes: 18, difficultyScore: 2, category: 'protein' },
  'eggs': { name: 'eggs', prepTimeMinutes: 1, cookTimeMinutes: 8, difficultyScore: 1, category: 'protein' },
  'tofu': { name: 'tofu', prepTimeMinutes: 5, cookTimeMinutes: 12, difficultyScore: 1, category: 'protein' },
  
  // Vegetables (variable prep time, low-medium difficulty)
  'onion': { name: 'onion', prepTimeMinutes: 5, cookTimeMinutes: 10, difficultyScore: 1, category: 'vegetable' },
  'garlic': { name: 'garlic', prepTimeMinutes: 2, cookTimeMinutes: 2, difficultyScore: 1, category: 'vegetable' },
  'bell pepper': { name: 'bell pepper', prepTimeMinutes: 4, cookTimeMinutes: 8, difficultyScore: 1, category: 'vegetable' },
  'broccoli': { name: 'broccoli', prepTimeMinutes: 5, cookTimeMinutes: 12, difficultyScore: 1, category: 'vegetable' },
  'carrots': { name: 'carrots', prepTimeMinutes: 8, cookTimeMinutes: 15, difficultyScore: 1, category: 'vegetable' },
  'potatoes': { name: 'potatoes', prepTimeMinutes: 10, cookTimeMinutes: 25, difficultyScore: 1, category: 'vegetable' },
  'mushrooms': { name: 'mushrooms', prepTimeMinutes: 5, cookTimeMinutes: 8, difficultyScore: 1, category: 'vegetable' },
  'spinach': { name: 'spinach', prepTimeMinutes: 3, cookTimeMinutes: 5, difficultyScore: 1, category: 'vegetable' },
  'tomatoes': { name: 'tomatoes', prepTimeMinutes: 3, cookTimeMinutes: 5, difficultyScore: 1, category: 'vegetable' },
  'zucchini': { name: 'zucchini', prepTimeMinutes: 4, cookTimeMinutes: 10, difficultyScore: 1, category: 'vegetable' },
  
  // Grains & Starches (low prep, variable cook time)
  'rice': { name: 'rice', prepTimeMinutes: 2, cookTimeMinutes: 20, difficultyScore: 1, category: 'grain' },
  'pasta': { name: 'pasta', prepTimeMinutes: 1, cookTimeMinutes: 12, difficultyScore: 1, category: 'grain' },
  'quinoa': { name: 'quinoa', prepTimeMinutes: 2, cookTimeMinutes: 15, difficultyScore: 1, category: 'grain' },
  'bread': { name: 'bread', prepTimeMinutes: 0, cookTimeMinutes: 5, difficultyScore: 1, category: 'grain' },
  'noodles': { name: 'noodles', prepTimeMinutes: 1, cookTimeMinutes: 8, difficultyScore: 1, category: 'grain' },
  
  // Dairy (minimal prep/cook)
  'cheese': { name: 'cheese', prepTimeMinutes: 1, cookTimeMinutes: 3, difficultyScore: 1, category: 'dairy' },
  'milk': { name: 'milk', prepTimeMinutes: 0, cookTimeMinutes: 2, difficultyScore: 1, category: 'dairy' },
  'butter': { name: 'butter', prepTimeMinutes: 0, cookTimeMinutes: 1, difficultyScore: 1, category: 'dairy' },
  'yogurt': { name: 'yogurt', prepTimeMinutes: 0, cookTimeMinutes: 0, difficultyScore: 1, category: 'dairy' },
  
  // Spices & Seasonings (minimal time)
  'salt': { name: 'salt', prepTimeMinutes: 0, cookTimeMinutes: 0, difficultyScore: 1, category: 'spice' },
  'pepper': { name: 'pepper', prepTimeMinutes: 0, cookTimeMinutes: 0, difficultyScore: 1, category: 'spice' },
  'herbs': { name: 'herbs', prepTimeMinutes: 1, cookTimeMinutes: 0, difficultyScore: 1, category: 'spice' },
  'spices': { name: 'spices', prepTimeMinutes: 0, cookTimeMinutes: 0, difficultyScore: 1, category: 'spice' },
  
  // Sauces & Liquids
  'olive oil': { name: 'olive oil', prepTimeMinutes: 0, cookTimeMinutes: 0, difficultyScore: 1, category: 'sauce' },
  'soy sauce': { name: 'soy sauce', prepTimeMinutes: 0, cookTimeMinutes: 0, difficultyScore: 1, category: 'sauce' },
  'tomato sauce': { name: 'tomato sauce', prepTimeMinutes: 1, cookTimeMinutes: 5, difficultyScore: 1, category: 'sauce' },
  'broth': { name: 'broth', prepTimeMinutes: 0, cookTimeMinutes: 5, difficultyScore: 1, category: 'sauce' },
};

/**
 * Main function to calculate cooking time and difficulty
 */
export function calculateCookingTimeAndDifficulty(recipe: Recipe): CookingTimeResult {
  const breakdown = analyzeRecipeComplexity(recipe);
  const timeCalculation = calculateTotalTime(breakdown, recipe);
  const difficultyScore = calculateDifficultyScore(breakdown, recipe);
  const recommendations = generateRecommendations(breakdown, timeCalculation, difficultyScore);
  
  return {
    totalMinutes: timeCalculation.total,
    prepTime: timeCalculation.prep,
    cookTime: timeCalculation.cook,
    difficulty: Math.min(5, Math.max(1, Math.round(difficultyScore))),
    breakdown: {
      ingredients: breakdown.ingredients.map(ing => ({
        name: ing.name,
        prepTime: ing.prepTimeMinutes,
        cookTime: ing.cookTimeMinutes
      })),
      methods: breakdown.methods,
      complexityFactors: breakdown.complexityFactors
    },
    recommendations
  };
}

/**
 * Analyze recipe to extract complexity factors
 */
function analyzeRecipeComplexity(recipe: Recipe) {
  const methods = extractCookingMethods(recipe);
  const ingredients = analyzeIngredients(recipe.ingredients);
  const complexityFactors = identifyComplexityFactors(recipe);
  
  return {
    methods,
    ingredients,
    complexityFactors,
    servings: recipe.servings || 4
  };
}

/**
 * Smart baking detection - identifies specific baked goods for accurate timing
 */
function detectBakingType(recipe: Recipe): BakingRecipe | null {
  const text = `${recipe.title} ${(recipe.instructions || []).join(' ')}`.toLowerCase();
  
  for (const bakingRecipe of BAKING_RECIPES) {
    for (const pattern of bakingRecipe.patterns) {
      if (text.includes(pattern)) {
        return bakingRecipe;
      }
    }
  }
  
  return null;
}

/**
 * Extract cooking methods from recipe title and instructions with smart baking recognition
 */
function extractCookingMethods(recipe: Recipe): string[] {
  const text = `${recipe.title} ${(recipe.instructions || []).join(' ')}`.toLowerCase();
  const detectedMethods: string[] = [];
  
  COOKING_METHODS.forEach(method => {
    if (text.includes(method.name) || 
        text.includes(method.name.slice(0, -3)) || // Handle "frying" -> "fry"
        text.includes(method.name + 'ed') ||
        text.includes(method.name + 'd')) {
      detectedMethods.push(method.name);
    }
  });
  
  // Default methods if none detected
  if (detectedMethods.length === 0) {
    if (text.includes('salad') || text.includes('raw')) {
      detectedMethods.push('raw preparation');
    } else {
      detectedMethods.push('sautéing'); // Default cooking method
    }
  }
  
  return detectedMethods;
}

/**
 * Analyze ingredients for complexity and timing
 */
function analyzeIngredients(ingredients: string[]): IngredientComplexity[] {
  return ingredients.map(ingredient => {
    const cleanIngredient = normalizeIngredientName(ingredient);
    
    // Direct match
    if (INGREDIENT_COMPLEXITY[cleanIngredient]) {
      return INGREDIENT_COMPLEXITY[cleanIngredient];
    }
    
    // Fuzzy matching
    const bestMatch = findBestIngredientMatch(cleanIngredient);
    if (bestMatch) {
      return bestMatch;
    }
    
    // Default for unknown ingredients
    return createDefaultIngredientComplexity(cleanIngredient);
  });
}

/**
 * Normalize ingredient names for better matching
 */
function normalizeIngredientName(ingredient: string): string {
  return ingredient
    .toLowerCase()
    .replace(/\d+|\s*(cups?|tbsp|tsp|lbs?|oz|grams?|ml|cloves?|large|medium|small|fresh|dried|chopped|diced|sliced)\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Find best matching ingredient using fuzzy logic
 */
function findBestIngredientMatch(ingredient: string): IngredientComplexity | null {
  let bestMatch: IngredientComplexity | null = null;
  let bestScore = 0;
  
  Object.values(INGREDIENT_COMPLEXITY).forEach(complexity => {
    const score = calculateIngredientSimilarity(ingredient, complexity.name);
    if (score > bestScore && score > 0.6) {
      bestScore = score;
      bestMatch = complexity;
    }
  });
  
  return bestMatch;
}

/**
 * Calculate similarity between ingredient names
 */
function calculateIngredientSimilarity(a: string, b: string): number {
  if (a === b) return 1.0;
  if (a.includes(b) || b.includes(a)) return 0.8;
  
  const aWords = a.split(' ');
  const bWords = b.split(' ');
  
  let matchingWords = 0;
  aWords.forEach(wordA => {
    bWords.forEach(wordB => {
      if (wordA === wordB || wordA.includes(wordB) || wordB.includes(wordA)) {
        matchingWords++;
      }
    });
  });
  
  return matchingWords / Math.max(aWords.length, bWords.length);
}

/**
 * Create default complexity for unknown ingredients
 */
function createDefaultIngredientComplexity(ingredient: string): IngredientComplexity {
  let category: IngredientComplexity['category'] = 'other';
  let prepTime = 3;
  let cookTime = 8;
  let difficulty = 2;
  
  // Category classification
  if (/meat|chicken|beef|pork|fish|salmon|turkey/.test(ingredient)) {
    category = 'protein';
    prepTime = 5;
    cookTime = 18;
    difficulty = 2;
  } else if (/vegetable|carrot|potato|onion|pepper|broccoli/.test(ingredient)) {
    category = 'vegetable';
    prepTime = 4;
    cookTime = 10;
    difficulty = 1;
  } else if (/rice|pasta|grain|quinoa|bread/.test(ingredient)) {
    category = 'grain';
    prepTime = 2;
    cookTime = 15;
    difficulty = 1;
  } else if (/cheese|milk|cream|butter|yogurt/.test(ingredient)) {
    category = 'dairy';
    prepTime = 1;
    cookTime = 3;
    difficulty = 1;
  } else if (/oil|sauce|seasoning|herb|spice/.test(ingredient)) {
    category = 'sauce';
    prepTime = 0;
    cookTime = 1;
    difficulty = 1;
  }
  
  return {
    name: ingredient,
    prepTimeMinutes: prepTime,
    cookTimeMinutes: cookTime,
    difficultyScore: difficulty,
    category
  };
}

/**
 * Identify complexity factors that affect cooking time and difficulty
 */
function identifyComplexityFactors(recipe: Recipe): string[] {
  const factors: string[] = [];
  const text = `${recipe.title} ${(recipe.instructions || []).join(' ')}`.toLowerCase();
  
  // High complexity indicators
  if (text.includes('marinade') || text.includes('marinate')) {
    factors.push('Requires marinating time');
  }
  if (text.includes('dough') || text.includes('knead') || text.includes('rising') || text.includes('proof')) {
    factors.push('Involves dough preparation');
  }
  if (text.includes('sauce from scratch') || text.includes('homemade sauce') || text.includes('reduction')) {
    factors.push('Homemade sauce preparation');
  }
  if (recipe.ingredients.length > 12) {
    factors.push('High ingredient count');
  }
  if (text.includes('julienne') || text.includes('brunoise') || text.includes('chiffonade')) {
    factors.push('Advanced knife skills required');
  }
  if (text.includes('temperature') || text.includes('thermometer') || text.includes('internal temp')) {
    factors.push('Temperature monitoring required');
  }
  if (text.includes('timing') || text.includes('simultaneously') || text.includes('coordinate')) {
    factors.push('Multiple timing coordination');
  }
  
  // Advanced technique indicators
  if (text.includes('wellington') || text.includes('en croute') || text.includes('wrapped in pastry')) {
    factors.push('Advanced pastry techniques');
  }
  if (text.includes('sear') || text.includes('caramelize') || text.includes('deglaze')) {
    factors.push('Professional cooking techniques');
  }
  if (text.includes('confit') || text.includes('sous vide') || text.includes('braising')) {
    factors.push('Specialized cooking methods');
  }
  if (text.includes('clarify') || text.includes('emulsify') || text.includes('tempering')) {
    factors.push('Advanced culinary skills');
  }
  
  // Low complexity indicators
  if (text.includes('one pot') || text.includes('sheet pan')) {
    factors.push('Simplified cooking method');
  }
  if (text.includes('quick') || text.includes('easy') || text.includes('simple')) {
    factors.push('Quick preparation method');
  }
  if (recipe.ingredients.length <= 5) {
    factors.push('Minimal ingredients');
  }
  
  return factors;
}

/**
 * Calculate total cooking time considering parallel operations and smart baking detection
 */
function calculateTotalTime(breakdown: any, recipe: Recipe): { total: number; prep: number; cook: number } {
  let totalPrepTime = 0;
  let maxCookTime = 0;
  let simultaneousCookTime = 0;
  
  // Check for smart baking detection first
  const bakingType = detectBakingType(recipe);
  
  if (bakingType && breakdown.methods.includes('baking')) {
    // Use specific baking times instead of generic calculation
    totalPrepTime = bakingType.prepTimeMinutes;
    maxCookTime = bakingType.baseTimeMinutes;
    
    // Add minor complexity penalty for advanced baking
    let complexityPenalty = breakdown.complexityFactors.length * 3;
    if (breakdown.complexityFactors.includes('Involves dough preparation')) {
      complexityPenalty += 20; // Rising time
    }
    if (breakdown.complexityFactors.includes('Advanced pastry techniques')) {
      complexityPenalty += 25; // Complex assembly
    }
    
    const totalTime = totalPrepTime + maxCookTime + complexityPenalty;
    return {
      total: Math.round(totalTime),
      prep: Math.round(totalPrepTime),
      cook: Math.round(maxCookTime + complexityPenalty)
    };
  }
  
  // Calculate prep time (mostly sequential) for non-baking recipes
  breakdown.ingredients.forEach((ing: IngredientComplexity) => {
    totalPrepTime += ing.prepTimeMinutes;
  });
  
  // Calculate cook time (considering parallel cooking)
  const cookingMethods = breakdown.methods.map(method => 
    COOKING_METHODS.find(m => m.name === method)
  ).filter(Boolean);
  
  if (cookingMethods.length > 0) {
    // Get the longest cooking method
    maxCookTime = Math.max(...cookingMethods.map(m => m!.baseTimeMinutes));
    
    // Add ingredient cook times, considering some parallel cooking
    const totalIngredientCookTime = breakdown.ingredients.reduce(
      (sum: number, ing: IngredientComplexity) => sum + ing.cookTimeMinutes, 0
    );
    
    // Apply parallel cooking efficiency (30% reduction if multiple methods)
    if (cookingMethods.length > 1) {
      simultaneousCookTime = totalIngredientCookTime * 0.7;
    } else {
      simultaneousCookTime = totalIngredientCookTime;
    }
    
    maxCookTime = Math.max(maxCookTime, simultaneousCookTime);
  }
  
  // Add complexity time penalties with enhanced scaling
  let complexityPenalty = breakdown.complexityFactors.length * 5;
  
  // Special handling for very complex recipes
  if (breakdown.complexityFactors.includes('Involves dough preparation')) {
    complexityPenalty += 30; // Dough rising time
  }
  if (breakdown.complexityFactors.includes('Requires marinating time')) {
    complexityPenalty += 45; // Marinating adds significant time
  }
  if (breakdown.complexityFactors.includes('Advanced knife skills required')) {
    complexityPenalty += 15; // Precision cutting takes time
  }
  if (breakdown.complexityFactors.includes('Temperature monitoring required')) {
    complexityPenalty += 20; // Careful temperature control
  }
  
  // Complex ingredient interaction multiplier
  const ingredientComplexityMultiplier = breakdown.ingredients.length > 8 ? 1.3 : 1.0;
  const adjustedCookTime = maxCookTime * ingredientComplexityMultiplier;
  
  const totalTime = totalPrepTime + adjustedCookTime + complexityPenalty;
  
  return {
    total: Math.round(totalTime),
    prep: Math.round(totalPrepTime),
    cook: Math.round(adjustedCookTime + complexityPenalty)
  };
}

/**
 * Calculate difficulty score (1-5 scale) with smart baking recognition
 */
function calculateDifficultyScore(breakdown: any, recipe: Recipe): number {
  let baseScore = 1;
  
  // Check for smart baking detection first
  const bakingType = detectBakingType(recipe);
  if (bakingType && breakdown.methods.includes('baking')) {
    // Use specific baking difficulty instead of generic calculation
    baseScore = bakingType.difficultyScore;
    
    // Add complexity factors
    breakdown.complexityFactors.forEach((factor: string) => {
      if (factor.includes('Advanced') || factor.includes('Professional') || factor.includes('Specialized')) {
        baseScore += 1.0; // Baking-specific adjustments
      } else if (factor.includes('Involves dough preparation')) {
        baseScore += 0.5; // Yeast/rising adds difficulty
      } else if (factor.includes('High ingredient count')) {
        baseScore += 0.3; // Multiple ingredients in baking
      }
    });
    
    return Math.max(1, Math.min(5, baseScore));
  }
  
  // Method difficulty for non-baking recipes
  breakdown.methods.forEach((methodName: string) => {
    const method = COOKING_METHODS.find(m => m.name === methodName);
    if (method) {
      baseScore += (method.difficultyMultiplier - 1) * 2;
    }
  });
  
  // Ingredient difficulty
  const avgIngredientDifficulty = breakdown.ingredients.reduce(
    (sum: number, ing: IngredientComplexity) => sum + ing.difficultyScore, 0
  ) / breakdown.ingredients.length;
  baseScore += avgIngredientDifficulty - 1;
  
  // Complexity factors with weighted scoring
  breakdown.complexityFactors.forEach((factor: string) => {
    if (factor.includes('Advanced') || factor.includes('Professional') || factor.includes('Specialized')) {
      baseScore += 1.5; // Major difficulty increase
    } else if (factor.includes('High ingredient count') || factor.includes('Multiple timing')) {
      baseScore += 1.0; // Significant difficulty
    } else {
      baseScore += 0.5; // Moderate difficulty
    }
  });
  
  // Ingredient count factor
  if (recipe.ingredients.length > 10) {
    baseScore += 0.5;
  } else if (recipe.ingredients.length <= 5) {
    baseScore -= 0.5;
  }
  
  // Multiple cooking methods increase difficulty
  if (breakdown.methods.length > 1) {
    baseScore += 0.5;
  }
  
  return Math.max(1, Math.min(5, baseScore));
}

/**
 * Generate cooking recommendations based on analysis
 */
function generateRecommendations(breakdown: any, timeCalculation: any, difficulty: number): string[] {
  const recommendations: string[] = [];
  
  if (timeCalculation.prep > 20) {
    recommendations.push("🔪 Prep ingredients in advance to save time");
  }
  
  if (breakdown.methods.length > 1) {
    recommendations.push("⏲️ Use timers to coordinate multiple cooking methods");
  }
  
  if (difficulty >= 4) {
    recommendations.push("👨‍🍳 Consider watching a video tutorial for this recipe");
  }
  
  if (breakdown.complexityFactors.includes('High ingredient count')) {
    recommendations.push("📝 Organize ingredients by cooking order before starting");
  }
  
  if (timeCalculation.total > 60) {
    recommendations.push("⏰ Plan ahead - this recipe takes over an hour");
  }
  
  if (breakdown.methods.includes('marinating')) {
    recommendations.push("🕐 Start marinating several hours before cooking");
  }
  
  const proteinCount = breakdown.ingredients.filter(
    (ing: IngredientComplexity) => ing.category === 'protein'
  ).length;
  if (proteinCount > 1) {
    recommendations.push("🥩 Cook proteins separately to ensure proper doneness");
  }
  
  return recommendations;
}

/**
 * Get simplified recipe suggestions for reducing difficulty
 */
export function getEasyAlternatives(recipe: Recipe): string[] {
  const alternatives: string[] = [];
  const text = recipe.title.toLowerCase();
  
  if (text.includes('pasta')) {
    alternatives.push("Use pre-made sauce instead of homemade");
    alternatives.push("Try one-pot pasta method");
  }
  
  if (text.includes('stir fry') || text.includes('stir-fry')) {
    alternatives.push("Use frozen stir-fry vegetables");
    alternatives.push("Pre-cut vegetables from store");
  }
  
  if (text.includes('salad')) {
    alternatives.push("Use pre-washed salad mix");
    alternatives.push("Buy pre-cut vegetables");
  }
  
  if (text.includes('soup')) {
    alternatives.push("Use slow cooker for hands-off cooking");
    alternatives.push("Use pre-made broth");
  }
  
  if (recipe.ingredients.length > 8) {
    alternatives.push("Reduce to essential ingredients only");
    alternatives.push("Use seasoning blends instead of individual spices");
  }
  
  return alternatives;
}

/**
 * Batch cooking time estimation for meal planning
 */
export function estimateBatchCookingTime(recipes: Recipe[]): {
  totalTime: number;
  parallelTime: number;
  efficiencyGains: string[];
} {
  const individualTimes = recipes.map(recipe => 
    calculateCookingTimeAndDifficulty(recipe).totalMinutes
  );
  
  const totalSequential = individualTimes.reduce((sum, time) => sum + time, 0);
  
  // Calculate parallel efficiency (sharing prep, oven time, etc.)
  const parallelEfficiency = Math.max(0.6, 1 - (recipes.length * 0.1));
  const parallelTime = Math.round(totalSequential * parallelEfficiency);
  
  const efficiencyGains = [
    "🔥 Share oven/stovetop time between recipes",
    "🥬 Batch prep similar ingredients",
    "⚡ Cook proteins together when possible",
    "📦 Prepare bulk ingredients once"
  ];
  
  return {
    totalTime: totalSequential,
    parallelTime,
    efficiencyGains
  };
}