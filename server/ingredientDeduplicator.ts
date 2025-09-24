/**
 * Advanced ingredient deduplication and parsing utilities
 * Uses NLP-like techniques to identify and merge similar ingredients
 */

interface ParsedIngredient {
  quantity: string;
  unit: string;
  ingredient: string;
  preparation?: string;
  original: string;
}

/**
 * Parse an ingredient string into components
 */
function parseIngredient(ingredientStr: string): ParsedIngredient {
  const cleaned = ingredientStr.trim();
  
  // Regex patterns for quantity, unit, and ingredient
  const patterns = [
    // Pattern: "2 cups all-purpose flour, sifted"
    /^(\d+(?:\/\d+)?(?:\.\d+)?)\s+(\w+)\s+(.+?)(?:,\s*(.+))?$/,
    // Pattern: "1/2 cup water"
    /^(\d+\/\d+)\s+(\w+)\s+(.+?)(?:,\s*(.+))?$/,
    // Pattern: "2 lbs ground beef"
    /^(\d+(?:\.\d+)?)\s+(\w+)\s+(.+?)(?:,\s*(.+))?$/,
    // Pattern: "1 large onion, diced"
    /^(\d+)\s+(\w+)\s+(.+?)(?:,\s*(.+))?$/,
    // Pattern: "Salt and pepper to taste"
    /^(.+?)\s+to\s+taste$/,
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match) {
      if (pattern.source.includes('to\\s+taste')) {
        return {
          quantity: 'to taste',
          unit: '',
          ingredient: match[1],
          original: cleaned
        };
      } else {
        return {
          quantity: match[1] || '',
          unit: match[2] || '',
          ingredient: match[3] || '',
          preparation: match[4] || undefined,
          original: cleaned
        };
      }
    }
  }

  // Fallback: treat entire string as ingredient
  return {
    quantity: '',
    unit: '',
    ingredient: cleaned,
    original: cleaned
  };
}

/**
 * Normalize ingredient names for comparison
 */
function normalizeIngredientName(ingredient: string): string {
  return ingredient
    .toLowerCase()
    .replace(/[,\s]+/g, ' ')
    .replace(/\b(fresh|dried|ground|chopped|diced|minced|sliced)\b/g, '')
    .replace(/\b(large|small|medium)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if two ingredients are similar enough to be considered duplicates
 */
function areIngredientsSimilar(ing1: ParsedIngredient, ing2: ParsedIngredient): boolean {
  const norm1 = normalizeIngredientName(ing1.ingredient);
  const norm2 = normalizeIngredientName(ing2.ingredient);
  
  // Exact match after normalization
  if (norm1 === norm2) return true;
  
  // Check for very similar strings (common typos or variations)
  if (calculateStringSimilarity(norm1, norm2) > 0.8) return true;
  
  // Check if one is contained in the other (e.g., "tomato" and "crushed tomatoes")
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    // Only consider it a match if the shorter string is at least 3 characters
    const shorter = norm1.length < norm2.length ? norm1 : norm2;
    return shorter.length >= 3;
  }
  
  // Check for common ingredient variations and units
  const variations = [
    ['onion', 'onions', 'yellow onion', 'white onion', 'red onion'],
    ['tomato', 'tomatoes', 'cherry tomato', 'cherry tomatoes'],
    ['garlic', 'garlic clove', 'garlic cloves', 'minced garlic'],
    ['cheese', 'mozzarella', 'parmesan', 'ricotta', 'cheddar'],
    ['beef', 'ground beef', 'lean ground beef'],
    ['oil', 'olive oil', 'cooking oil', 'vegetable oil'],
    ['salt', 'sea salt', 'kosher salt', 'table salt'],
    ['pepper', 'black pepper', 'ground pepper', 'ground black pepper'],
    ['butter', 'unsalted butter', 'salted butter'],
    ['flour', 'all purpose flour', 'all-purpose flour'],
    ['potato', 'potatoes', 'baby potato', 'baby potatoes'],
    ['chicken', 'chicken breast', 'chicken thigh', 'chicken thighs'],
    ['thyme', 'dried thyme', 'fresh thyme'],
    ['rosemary', 'dried rosemary', 'fresh rosemary'],
    ['paprika', 'smoked paprika', 'sweet paprika']
  ];
  
  for (const varGroup of variations) {
    if (varGroup.some(v => norm1.includes(v)) && varGroup.some(v => norm2.includes(v))) {
      return true;
    }
  }
  
  return false;
}

/**
 * Calculate string similarity using Levenshtein distance
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  
  if (len1 === 0) return len2 === 0 ? 1 : 0;
  if (len2 === 0) return 0;
  
  const matrix = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(null));
  
  for (let i = 0; i <= len1; i++) matrix[0][i] = i;
  for (let j = 0; j <= len2; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= len2; j++) {
    for (let i = 1; i <= len1; i++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j - 1][i] + 1,     // deletion
        matrix[j][i - 1] + 1,     // insertion
        matrix[j - 1][i - 1] + cost // substitution
      );
    }
  }
  
  const maxLen = Math.max(len1, len2);
  return (maxLen - matrix[len2][len1]) / maxLen;
}

/**
 * Merge two similar ingredients, keeping the more detailed one
 */
function mergeIngredients(ing1: ParsedIngredient, ing2: ParsedIngredient): ParsedIngredient {
  // Prefer the one with more specific quantity/unit information
  if (ing1.quantity && ing1.unit && (!ing2.quantity || !ing2.unit)) {
    return ing1;
  }
  if (ing2.quantity && ing2.unit && (!ing1.quantity || !ing1.unit)) {
    return ing2;
  }
  
  // Prefer the one with preparation instructions
  if (ing1.preparation && !ing2.preparation) return ing1;
  if (ing2.preparation && !ing1.preparation) return ing2;
  
  // Prefer the longer, more descriptive ingredient name
  if (ing1.ingredient.length > ing2.ingredient.length) return ing1;
  
  return ing2;
}

/**
 * Deduplicate a list of ingredient strings
 */
export function deduplicateIngredients(ingredients: string[]): string[] {
  if (!ingredients || ingredients.length === 0) return [];
  
  // Parse all ingredients
  const parsedIngredients = ingredients
    .filter(ing => ing && typeof ing === 'string' && ing.trim().length > 0)
    .map(parseIngredient);
  
  const deduplicated: ParsedIngredient[] = [];
  
  for (const current of parsedIngredients) {
    // Check if this ingredient is similar to any existing one
    const existingIndex = deduplicated.findIndex(existing => 
      areIngredientsSimilar(current, existing)
    );
    
    if (existingIndex >= 0) {
      // Merge with existing ingredient
      deduplicated[existingIndex] = mergeIngredients(deduplicated[existingIndex], current);
    } else {
      // Add as new ingredient
      deduplicated.push(current);
    }
  }
  
  // Convert back to strings, preserving the best format
  return deduplicated.map(ing => ing.original);
}

/**
 * Clean and standardize ingredient list
 */
export function cleanIngredientList(ingredients: string[]): string[] {
  const deduplicated = deduplicateIngredients(ingredients);
  
  return deduplicated
    .filter(ing => {
      // Remove very short or meaningless ingredients
      if (ing.length < 3) return false;
      
      // Remove common noise words
      const noise = ['recipe', 'ingredients', 'preparation', 'instructions', 'method'];
      const lower = ing.toLowerCase();
      if (noise.some(n => lower === n)) return false;
      
      return true;
    })
    .sort(); // Sort alphabetically for consistent ordering
}