/**
 * Utility to estimate recipe difficulty based on ingredients, techniques, and recipe description
 * The estimator runs automatically in the background to determine the best approach
 */

// Common ingredients that are typically simple to work with
const COMMON_INGREDIENTS = [
  'salt', 'pepper', 'oil', 'butter', 'sugar', 'flour', 'water', 'milk',
  'egg', 'rice', 'pasta', 'potato', 'tomato', 'onion', 'garlic', 'lemon',
  'chicken', 'beef', 'broccoli', 'carrot', 'cheese', 'bread', 'corn'
];

// Ingredients that might be more challenging to prepare/cook properly
const COMPLEX_INGREDIENTS = [
  'lobster', 'crab', 'scallop', 'tenderloin', 'souffle', 'pastry', 'fondant',
  'truffle', 'foie gras', 'puff pastry', 'phyllo', 'squid', 'octopus', 'oyster',
  'duck', 'lamb', 'risotto', 'tempura', 'croquette', 'custard', 'sorbet'
];

// Basic cooking techniques
const BASIC_TECHNIQUES = [
  'boil', 'simmer', 'saute', 'fry', 'bake', 'roast', 'grill', 'microwave',
  'mix', 'stir', 'whisk', 'chop', 'dice', 'slice', 'blend', 'cook'
];

// Advanced cooking techniques 
const ADVANCED_TECHNIQUES = [
  'sous vide', 'temper', 'caramelize', 'flambe', 'braise', 'confit', 'deglaze',
  'ferment', 'emulsify', 'render', 'reduction', 'julienne', 'brunoise', 'chiffonade',
  'blanch', 'fold', 'proof', 'sweat', 'sear', 'pickle', 'cure', 'smoke'
];

// Time-related keywords that might indicate complexity
const TIME_INDICATORS = [
  'overnight', 'hours', 'all day', 'slow cook', 'marinate', 'rest', 'proof',
  'quick', 'instant', '5 minute', 'fast', 'easy', 'simple', 'beginner'
];

// Cuisine types that tend to be more complex
const COMPLEX_CUISINES = [
  'french', 'japanese', 'molecular', 'pastry', 'patisserie', 'haute', 'gourmet',
  'fine dining', 'michelin', 'advanced'
];

/**
 * Estimate the difficulty of a recipe on a scale of 1-5 with 0.5 increments
 * @param recipeDescription Recipe description text
 * @param ingredients List of ingredients if available
 * @param cuisine Cuisine type if known
 * @param recipeType Type of recipe if specified
 * @returns Difficulty score from 1-5 with 0.5 increments, and whether to use YouTube (true) or AI generation (false)
 */
export const estimateRecipeDifficulty = (
  recipeDescription: string,
  ingredients?: string,
  cuisine?: string,
  recipeType?: string
): { difficulty: number; useYouTube: boolean } => {
  const description = recipeDescription.toLowerCase();
  const ingredientsList = ingredients ? ingredients.toLowerCase() : '';
  const cuisineType = cuisine ? cuisine.toLowerCase() : '';
  const type = recipeType ? recipeType.toLowerCase() : '';
  
  let difficultyScore = 3.0; // Default medium difficulty on 1-5 scale
  
  // Adjust based on description text
  if (description.includes('easy') || description.includes('simple') || description.includes('quick')) {
    difficultyScore -= 1.0;
  }
  
  if (description.includes('advanced') || description.includes('complex') || description.includes('gourmet')) {
    difficultyScore += 1.0;
  }
  
  // Check for complex techniques in the description
  const techniquesFound = [...BASIC_TECHNIQUES, ...ADVANCED_TECHNIQUES].filter(technique => 
    description.includes(technique)
  );
  
  const advancedTechniquesCount = techniquesFound.filter(technique => 
    ADVANCED_TECHNIQUES.includes(technique)
  ).length;
  
  // Adjust score based on detected techniques
  if (advancedTechniquesCount > 0) {
    difficultyScore += Math.min(advancedTechniquesCount * 0.5, 1.5);
  } else if (techniquesFound.length > 0) {
    // If only basic techniques are mentioned, it's likely simpler
    difficultyScore -= 0.5;
  }
  
  // Check ingredients if provided
  if (ingredientsList) {
    const complexIngredientsCount = COMPLEX_INGREDIENTS.filter(ingredient => 
      ingredientsList.includes(ingredient)
    ).length;
    
    if (complexIngredientsCount > 0) {
      difficultyScore += Math.min(complexIngredientsCount * 0.5, 1.0);
    }
    
    // Count total ingredients as an indicator of complexity
    const totalIngredients = ingredientsList.split(',').length;
    if (totalIngredients > 10) {
      difficultyScore += 0.5;
    } else if (totalIngredients <= 5) {
      difficultyScore -= 0.5;
    }
  }
  
  // Check cuisine type
  if (cuisineType && COMPLEX_CUISINES.some(complexCuisine => cuisineType.includes(complexCuisine))) {
    difficultyScore += 0.5;
  }
  
  // Check recipe type
  if (type.includes('dessert') || type.includes('pastry') || type.includes('baking')) {
    // Baking tends to require more precision
    difficultyScore += 0.5;
  }
  
  // Time indications
  if (TIME_INDICATORS.some(indicator => description.includes(indicator))) {
    if (description.includes('quick') || description.includes('easy') || 
        description.includes('simple') || description.includes('minute')) {
      difficultyScore -= 0.5;
    } else if (description.includes('overnight') || description.includes('hours')) {
      difficultyScore += 0.5;
    }
  }
  
  // Round to nearest 0.5 and clamp to the 1-5 range
  difficultyScore = Math.round(difficultyScore * 2) / 2;
  difficultyScore = Math.max(1, Math.min(5, difficultyScore));
  
  // Determine whether to use YouTube or AI generation
  // YouTube for simpler recipes (1-3), AI for more complex (3.5-5)
  const useYouTube = difficultyScore <= 3;
  
  return {
    difficulty: difficultyScore,
    useYouTube
  };
};