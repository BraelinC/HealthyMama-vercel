/**
 * Comprehensive measurement cleaning utility to fix duplicate measurements
 * and normalize ingredient formatting across all extraction methods
 */

/**
 * Clean ingredient text to remove duplicate measurements and normalize formatting
 */
export function cleanIngredientMeasurements(ingredientText: string): string {
  if (!ingredientText || typeof ingredientText !== 'string') {
    return '';
  }

  let cleaned = ingredientText.trim();

  // Fix specific duplicate patterns like "2 cup 2 cups" or "1 tsp 1 teaspoon"
  cleaned = cleaned
    // Handle number + unit + number + unit patterns
    .replace(/(\d+(?:\.\d+)?(?:\s*\/\s*\d+)?)\s*(cup|cups)\s+(\d+(?:\.\d+)?(?:\s*\/\s*\d+)?)\s*(cup|cups)/gi, '$1 $2')
    .replace(/(\d+(?:\.\d+)?(?:\s*\/\s*\d+)?)\s*(tsp|teaspoon|teaspoons)\s+(\d+(?:\.\d+)?(?:\s*\/\s*\d+)?)\s*(tsp|teaspoon|teaspoons)/gi, '$1 $2')
    .replace(/(\d+(?:\.\d+)?(?:\s*\/\s*\d+)?)\s*(tbsp|tablespoon|tablespoons)\s+(\d+(?:\.\d+)?(?:\s*\/\s*\d+)?)\s*(tbsp|tablespoon|tablespoons)/gi, '$1 $2')
    .replace(/(\d+(?:\.\d+)?(?:\s*\/\s*\d+)?)\s*(oz|ounce|ounces)\s+(\d+(?:\.\d+)?(?:\s*\/\s*\d+)?)\s*(oz|ounce|ounces)/gi, '$1 $2')
    .replace(/(\d+(?:\.\d+)?(?:\s*\/\s*\d+)?)\s*(lb|lbs|pound|pounds)\s+(\d+(?:\.\d+)?(?:\s*\/\s*\d+)?)\s*(lb|lbs|pound|pounds)/gi, '$1 $2')
    .replace(/(\d+(?:\.\d+)?(?:\s*\/\s*\d+)?)\s*(g|gram|grams)\s+(\d+(?:\.\d+)?(?:\s*\/\s*\d+)?)\s*(g|gram|grams)/gi, '$1 $2')
    .replace(/(\d+(?:\.\d+)?(?:\s*\/\s*\d+)?)\s*(ml|milliliter|milliliters)\s+(\d+(?:\.\d+)?(?:\s*\/\s*\d+)?)\s*(ml|milliliter|milliliters)/gi, '$1 $2')
    .replace(/(\d+(?:\.\d+)?(?:\s*\/\s*\d+)?)\s*(l|liter|liters)\s+(\d+(?:\.\d+)?(?:\s*\/\s*\d+)?)\s*(l|liter|liters)/gi, '$1 $2')
    .replace(/(\d+(?:\.\d+)?(?:\s*\/\s*\d+)?)\s*(clove|cloves)\s+(\d+(?:\.\d+)?(?:\s*\/\s*\d+)?)\s*(clove|cloves)/gi, '$1 $2')
    
    // Remove exact word duplications
    .replace(/(\b\w+)\s+\1\b/g, '$1')
    
    // Clean up multiple spaces
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned;
}

/**
 * Clean an array of ingredients to remove duplicates and normalize measurements
 */
export function cleanIngredientList(ingredients: string[]): string[] {
  if (!Array.isArray(ingredients)) {
    return [];
  }

  // Clean each ingredient
  const cleaned = ingredients
    .map(cleanIngredientMeasurements)
    .filter(ingredient => ingredient.length > 0);

  // Remove duplicates (case-insensitive)
  const seen = new Set<string>();
  return cleaned.filter(ingredient => {
    const key = ingredient.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * Extract standardized measurement info from cleaned ingredient text
 */
export function extractMeasurementInfo(ingredientText: string): {
  quantity: number;
  unit: string;
  ingredient: string;
  original: string;
} {
  const cleaned = cleanIngredientMeasurements(ingredientText);
  
  // Enhanced regex to capture measurements at the start
  const measurementRegex = /^([\d\s\./]+)\s*(cup|cups|tbsp|tablespoon|tablespoons|tsp|teaspoon|teaspoons|oz|ounce|ounces|pound|pounds|lb|lbs|g|gram|grams|kg|ml|milliliter|milliliters|l|liter|liters|pinch|pinches|dash|dashes|clove|cloves|can|cans|jar|jars|bottle|bottles)\s+(.+)$/i;
  
  const match = cleaned.match(measurementRegex);
  
  if (match) {
    const quantityStr = match[1].trim();
    const unit = match[2].trim().toLowerCase();
    const ingredient = match[3].trim();
    
    // Parse fractions and decimals
    let quantity = 1;
    if (quantityStr.includes('/')) {
      const [numerator, denominator] = quantityStr.split('/').map(n => parseFloat(n.trim()));
      quantity = numerator / denominator;
    } else {
      quantity = parseFloat(quantityStr) || 1;
    }
    
    return {
      quantity,
      unit,
      ingredient,
      original: cleaned
    };
  }
  
  // If no measurement found, return as-is
  return {
    quantity: 1,
    unit: 'item',
    ingredient: cleaned,
    original: cleaned
  };
}