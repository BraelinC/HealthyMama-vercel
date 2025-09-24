/**
 * Advanced ingredient parsing for accurate USDA nutrition lookup
 */

interface ParsedIngredientForNutrition {
  originalText: string;
  foodName: string;
  quantity: number;
  unit: string;
  preparation?: string;
}

/**
 * Extract the core food name from an ingredient string for USDA lookup
 */
export function extractFoodNameForNutrition(ingredientText: string): ParsedIngredientForNutrition {
  const cleaned = ingredientText.trim().toLowerCase();
  
  // Common measurement patterns
  const measurementRegex = /^(\d+(?:\/\d+)?(?:\.\d+)?)\s*(cups?|tbsp|tsp|tablespoons?|teaspoons?|oz|ounces?|lbs?|pounds?|g|grams?|ml|l|liters?|pinch|cloves?|medium|large|small)?\s+(.+)/;
  
  let foodName = cleaned;
  let quantity = 1;
  let unit = 'serving';
  let preparation = '';
  
  // Extract preparation info if present
  const preparationMatch = ingredientText.match(/,\s*(.+)$/);
  if (preparationMatch) {
    preparation = preparationMatch[1];
  }
  
  const match = cleaned.match(measurementRegex);
  if (match) {
    quantity = parseFloat(match[1].includes('/') ? 
      match[1].split('/').reduce((a, b) => parseFloat(a) / parseFloat(b)) : 
      match[1]);
    unit = match[2] || 'serving';
    foodName = match[3];
  }
  
  // Remove preparation methods and descriptors that confuse USDA search
  foodName = foodName
    // Remove cooking methods
    .replace(/\b(chopped|diced|minced|sliced|crushed|grated|shredded|melted|cooked|raw|fresh|dried|frozen|canned|blanched)\b/g, '')
    // Remove size descriptors  
    .replace(/\b(large|medium|small|extra|thick|thin|fine|bundle)\b/g, '')
    // Remove brand names and specific varieties that might not be in USDA
    .replace(/\b(organic|kosher|sea|iodized|extra virgin|pure|unsalted|salted)\b/g, '')
    // Remove parenthetical information
    .replace(/\([^)]*\)/g, '')
    // Remove commas and extra preparation info
    .replace(/,.*$/, '')
    // Remove slash and everything after it (e.g. "crushed/minced")
    .replace(/\/.*$/, '')
    // Clean up whitespace
    .replace(/\s+/g, ' ')
    .trim();
  
  // Handle common ingredient simplifications for better USDA matching
  const simplifications = {
    'all-purpose flour': 'flour',
    'white onion': 'onion',
    'yellow onion': 'onion',
    'red onion': 'onion',
    'sweet onion': 'onion',
    'garlic cloves': 'garlic',
    'garlic clove': 'garlic',
    'ground beef': 'beef',
    'chicken breast': 'chicken',
    'chicken thighs': 'chicken',
    'olive oil': 'olive oil',
    'vegetable oil': 'oil',
    'canola oil': 'oil',
    'butter': 'butter',
    'unsalted butter': 'butter',
    'whole milk': 'milk',
    'heavy cream': 'cream',
    'sour cream': 'sour cream',
    'mozzarella cheese': 'mozzarella',
    'parmesan cheese': 'parmesan',
    'cheddar cheese': 'cheddar',
    'ricotta cheese': 'ricotta',
    'cream cheese': 'cream cheese',
    'tomato sauce': 'tomato sauce',
    'crushed tomatoes': 'tomatoes',
    'diced tomatoes': 'tomatoes',
    'tomato paste': 'tomato paste',
    'black pepper': 'pepper',
    'ground black pepper': 'pepper',
    'kosher salt': 'salt',
    'sea salt': 'salt',
    'table salt': 'salt',
    'fettuccine pasta': 'fettuccine',
    'spaghetti pasta': 'spaghetti',
    'penne pasta': 'penne'
  };
  
  // Apply simplifications
  for (const [complex, simple] of Object.entries(simplifications)) {
    if (foodName.includes(complex)) {
      foodName = simple;
      break;
    }
  }
  
  return {
    originalText: ingredientText.trim(),
    foodName: foodName,
    quantity: quantity,
    unit: unit,
    preparation: preparation
  };
}

/**
 * Convert ingredient measurements to standardized serving sizes for nutrition calculation
 */
export function getServingSizeMultiplier(parsedIngredient: ParsedIngredientForNutrition): number {
  const { quantity, unit, foodName } = parsedIngredient;
  
  // Standard weight conversions to grams
  const weightConversions: { [key: string]: number } = {
    'tbsp': 14.3, // tablespoon to grams (average)
    'tablespoon': 14.3,
    'tablespoons': 14.3,
    'tsp': 4.8, // teaspoon to grams (average)
    'teaspoon': 4.8,
    'teaspoons': 4.8,
    'oz': 28.35,
    'ounce': 28.35,
    'ounces': 28.35,
    'lb': 453.592,
    'lbs': 453.592,
    'pound': 453.592,
    'pounds': 453.592,
    'g': 1,
    'gram': 1,
    'grams': 1
  };
  
  // Volume conversions - need food-specific density
  const volumeConversions: { [key: string]: number } = {
    'cup': 240, // ml base
    'cups': 240,
    'ml': 1,
    'l': 1000,
    'liter': 1000,
    'liters': 1000
  };
  
  let totalGrams = 100; // Default serving size
  
  // Handle weight-based measurements (direct conversion)
  if (weightConversions[unit]) {
    totalGrams = quantity * weightConversions[unit];
  }
  // Handle volume-based measurements (need density adjustment)
  else if (volumeConversions[unit]) {
    const volumeML = quantity * volumeConversions[unit];
    
    // Food-specific density adjustments (ml to grams)
    const densityMap: { [key: string]: number } = {
      'flour': 0.5, // 1ml flour ≈ 0.5g
      'sugar': 0.85,
      'butter': 0.95,
      'oil': 0.92,
      'milk': 1.03,
      'cream': 1.0,
      'water': 1.0,
      'cheese': 0.9,
      'pasta': 0.6, // dry pasta
      'rice': 0.75, // dry rice
      'onion': 0.9,
      'tomatoes': 0.95,
      'spinach': 0.2, // fresh leafy greens are very light
      'basil': 0.2,
      'garlic': 0.9
    };
    
    let density = 1.0; // Default water density
    for (const [food, d] of Object.entries(densityMap)) {
      if (foodName.toLowerCase().includes(food)) {
        density = d;
        break;
      }
    }
    
    totalGrams = volumeML * density;
  }
  // Handle special cases for count-based items
  else if (unit === 'clove' || unit === 'cloves') {
    totalGrams = quantity * 3; // 1 garlic clove ≈ 3g
  }
  else if (unit === 'serving' || unit === '') {
    // Estimate based on food type
    const servingSizes: { [key: string]: number } = {
      'onion': 150, // 1 medium onion
      'tomato': 120, // 1 medium tomato
      'egg': 50,
      'spinach': 30, // 1 cup fresh spinach
      'cheese': 30, // typical serving
      'pasta': 85, // dry pasta serving
      'butter': 14, // 1 tbsp equivalent
      'oil': 14,
      'milk': 240, // 1 cup
      'cream': 30, // 2 tbsp
      'garlic': 3, // 1 clove
      'pepper': 2,
      'salt': 6
    };
    
    let estimatedGrams = 50; // Default
    for (const [food, grams] of Object.entries(servingSizes)) {
      if (foodName.toLowerCase().includes(food)) {
        estimatedGrams = grams;
        break;
      }
    }
    totalGrams = quantity * estimatedGrams;
  }
  
  // Return as multiplier for 100g nutrition data
  return totalGrams / 100;
}