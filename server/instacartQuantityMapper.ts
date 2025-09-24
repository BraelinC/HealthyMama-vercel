/**
 * Instacart Quantity Mapper
 * Intelligently converts recipe quantities to store-realistic packaging
 */

export interface MappedIngredient {
  name: string;
  displayText: string;
  quantity: number;
  unit: string;
  category: string;
  originalText?: string;
}

/**
 * Map recipe quantities to store-friendly amounts
 */
export function mapToStoreQuantities(ingredient: string): MappedIngredient {
  const normalized = ingredient.toLowerCase().trim();
  
  // Extract quantity and ingredient name
  const parsed = parseIngredientText(normalized);
  
  // Categorize the ingredient
  const category = categorizeIngredient(parsed.name);
  
  // Apply smart quantity mapping based on category
  switch (category) {
    case 'spices':
      return mapSpices(parsed);
    case 'produce':
      return mapProduce(parsed);
    case 'dairy':
      return mapDairy(parsed);
    case 'meat':
      return mapMeat(parsed);
    case 'pantry':
      return mapPantry(parsed);
    default:
      return createDefaultMapping(parsed);
  }
}

/**
 * Parse ingredient text into components
 */
function parseIngredientText(text: string): any {
  // Common patterns for parsing
  const quantityPattern = /^(\d+(?:\/\d+)?(?:\.\d+)?)\s*(?:to\s*)?(\d+(?:\/\d+)?(?:\.\d+)?)?\s*(\w+)?\s+(.+)/;
  const match = text.match(quantityPattern);
  
  if (match) {
    const quantity = match[1];
    const quantityMax = match[2]; // For ranges like "1-2 apples"
    const unit = match[3] || '';
    const name = match[4];
    
    return {
      quantity: quantityMax || quantity,
      unit: unit.toLowerCase(),
      name: name,
      originalText: text
    };
  }
  
  // Handle special cases like "salt to taste"
  if (text.includes('to taste')) {
    const name = text.replace('to taste', '').trim();
    return {
      quantity: '1',
      unit: 'container',
      name: name,
      originalText: text
    };
  }
  
  // Default: treat whole string as ingredient name
  return {
    quantity: '1',
    unit: 'item',
    name: text,
    originalText: text
  };
}

/**
 * Categorize ingredient for appropriate mapping
 */
function categorizeIngredient(ingredient: string): string {
  const lower = ingredient.toLowerCase();
  
  // Spices and seasonings (always buy the container)
  const spices = [
    'salt', 'pepper', 'paprika', 'cumin', 'coriander', 'turmeric',
    'cinnamon', 'nutmeg', 'clove', 'cardamom', 'saffron', 'vanilla',
    'oregano', 'basil', 'thyme', 'rosemary', 'sage', 'parsley',
    'garlic powder', 'onion powder', 'chili powder', 'cayenne',
    'ginger', 'mustard', 'bay leaf', 'dill', 'fennel', 'tarragon'
  ];
  
  if (spices.some(spice => lower.includes(spice))) {
    return 'spices';
  }
  
  // Produce
  const produce = [
    'apple', 'banana', 'orange', 'lemon', 'lime', 'grape', 'berry',
    'tomato', 'onion', 'garlic', 'potato', 'carrot', 'celery',
    'lettuce', 'spinach', 'kale', 'cabbage', 'broccoli', 'cauliflower',
    'pepper', 'cucumber', 'zucchini', 'squash', 'corn', 'bean'
  ];
  
  if (produce.some(item => lower.includes(item) && !lower.includes('powder'))) {
    return 'produce';
  }
  
  // Dairy
  if (lower.includes('milk') || lower.includes('cheese') || 
      lower.includes('yogurt') || lower.includes('butter') ||
      lower.includes('cream') || lower.includes('egg')) {
    return 'dairy';
  }
  
  // Meat
  if (lower.includes('chicken') || lower.includes('beef') ||
      lower.includes('pork') || lower.includes('turkey') ||
      lower.includes('lamb') || lower.includes('fish') ||
      lower.includes('salmon') || lower.includes('shrimp')) {
    return 'meat';
  }
  
  // Pantry items
  if (lower.includes('flour') || lower.includes('sugar') ||
      lower.includes('rice') || lower.includes('pasta') ||
      lower.includes('oil') || lower.includes('vinegar')) {
    return 'pantry';
  }
  
  return 'general';
}

/**
 * Map spices to store containers
 */
function mapSpices(parsed: any): MappedIngredient {
  // Always buy the container/jar for spices, regardless of recipe amount
  return {
    name: parsed.name,
    displayText: `1 container ${parsed.name}`,
    quantity: 1,
    unit: 'container',
    category: 'spices',
    originalText: parsed.originalText
  };
}

/**
 * Map produce to weight-based quantities
 */
function mapProduce(parsed: any): MappedIngredient {
  const quantity = parseFloat(parsed.quantity) || 1;
  const unit = parsed.unit;
  
  // Convert single items to pounds
  if (unit === '' || unit === 'item' || unit === 'piece') {
    // Round up to practical amounts
    let pounds = 1;
    if (quantity <= 2) {
      pounds = 1;
    } else if (quantity <= 5) {
      pounds = 2;
    } else {
      pounds = 3;
    }
    
    return {
      name: parsed.name,
      displayText: `${pounds} lb ${parsed.name}`,
      quantity: pounds,
      unit: 'pound',
      category: 'produce',
      originalText: parsed.originalText
    };
  }
  
  // Already in weight units
  if (unit === 'lb' || unit === 'pound' || unit === 'kg') {
    const roundedQty = Math.ceil(quantity);
    return {
      name: parsed.name,
      displayText: `${roundedQty} lb ${parsed.name}`,
      quantity: roundedQty,
      unit: 'pound',
      category: 'produce',
      originalText: parsed.originalText
    };
  }
  
  // Default
  return {
    name: parsed.name,
    displayText: `2 lb ${parsed.name}`,
    quantity: 2,
    unit: 'pound',
    category: 'produce',
    originalText: parsed.originalText
  };
}

/**
 * Map dairy to standard packages
 */
function mapDairy(parsed: any): MappedIngredient {
  const name = parsed.name.toLowerCase();
  const quantity = parseFloat(parsed.quantity) || 1;
  
  // Eggs - always in dozens
  if (name.includes('egg')) {
    const dozens = quantity <= 6 ? 1 : Math.ceil(quantity / 12);
    return {
      name: 'eggs',
      displayText: `${dozens} dozen eggs`,
      quantity: dozens * 12,
      unit: 'eggs',
      category: 'dairy',
      originalText: parsed.originalText
    };
  }
  
  // Milk - in standard sizes
  if (name.includes('milk')) {
    const unit = parsed.unit;
    let displayText = '';
    let finalQty = 1;
    let finalUnit = 'quart';
    
    if (unit === 'cup' || unit === 'cups') {
      if (quantity <= 2) {
        displayText = '1 pint milk';
        finalQty = 1;
        finalUnit = 'pint';
      } else if (quantity <= 4) {
        displayText = '1 quart milk';
        finalQty = 1;
        finalUnit = 'quart';
      } else {
        displayText = '1 half gallon milk';
        finalQty = 0.5;
        finalUnit = 'gallon';
      }
    } else {
      displayText = '1 quart milk';
    }
    
    return {
      name: 'milk',
      displayText: displayText,
      quantity: finalQty,
      unit: finalUnit,
      category: 'dairy',
      originalText: parsed.originalText
    };
  }
  
  // Cheese - in pounds or packages
  if (name.includes('cheese')) {
    const pounds = Math.ceil(quantity / 4); // Assuming 4oz per serving
    return {
      name: parsed.name,
      displayText: `${pounds} lb ${parsed.name}`,
      quantity: pounds,
      unit: 'pound',
      category: 'dairy',
      originalText: parsed.originalText
    };
  }
  
  // Default dairy
  return {
    name: parsed.name,
    displayText: `1 container ${parsed.name}`,
    quantity: 1,
    unit: 'container',
    category: 'dairy',
    originalText: parsed.originalText
  };
}

/**
 * Map meat to weight-based quantities with rounding
 */
function mapMeat(parsed: any): MappedIngredient {
  const quantity = parseFloat(parsed.quantity) || 1;
  const unit = parsed.unit;
  
  // Convert pieces to pounds
  if (unit === '' || unit === 'piece' || unit === 'breast' || unit === 'thigh') {
    // Estimate weight: 1 chicken breast ≈ 0.5 lb
    const pounds = Math.ceil(quantity * 0.5);
    return {
      name: parsed.name,
      displayText: `${pounds} lb ${parsed.name}`,
      quantity: pounds,
      unit: 'pound',
      category: 'meat',
      originalText: parsed.originalText
    };
  }
  
  // Already in pounds
  if (unit === 'lb' || unit === 'pound') {
    const rounded = Math.ceil(quantity);
    return {
      name: parsed.name,
      displayText: `${rounded} lb ${parsed.name}`,
      quantity: rounded,
      unit: 'pound',
      category: 'meat',
      originalText: parsed.originalText
    };
  }
  
  // Default to 1 pound
  return {
    name: parsed.name,
    displayText: `1 lb ${parsed.name}`,
    quantity: 1,
    unit: 'pound',
    category: 'meat',
    originalText: parsed.originalText
  };
}

/**
 * Map pantry items to standard sizes
 */
function mapPantry(parsed: any): MappedIngredient {
  const name = parsed.name.toLowerCase();
  const quantity = parseFloat(parsed.quantity) || 1;
  const unit = parsed.unit;
  
  // Flour - in standard bag sizes
  if (name.includes('flour')) {
    let bagSize = '2 lb';
    if (unit === 'cup' || unit === 'cups') {
      if (quantity <= 3) {
        bagSize = '2 lb';
      } else if (quantity <= 6) {
        bagSize = '5 lb';
      } else {
        bagSize = '10 lb';
      }
    }
    
    return {
      name: 'all-purpose flour',
      displayText: `1 bag (${bagSize}) all-purpose flour`,
      quantity: 1,
      unit: 'bag',
      category: 'pantry',
      originalText: parsed.originalText
    };
  }
  
  // Sugar - similar to flour
  if (name.includes('sugar')) {
    let bagSize = '2 lb';
    if (unit === 'cup' || unit === 'cups') {
      bagSize = quantity <= 3 ? '2 lb' : '5 lb';
    }
    
    return {
      name: parsed.name,
      displayText: `1 bag (${bagSize}) ${parsed.name}`,
      quantity: 1,
      unit: 'bag',
      category: 'pantry',
      originalText: parsed.originalText
    };
  }
  
  // Oil/Vinegar - always 1 bottle
  if (name.includes('oil') || name.includes('vinegar')) {
    return {
      name: parsed.name,
      displayText: `1 bottle ${parsed.name}`,
      quantity: 1,
      unit: 'bottle',
      category: 'pantry',
      originalText: parsed.originalText
    };
  }
  
  // Rice/Pasta - in packages
  if (name.includes('rice') || name.includes('pasta')) {
    const pounds = Math.ceil(quantity);
    return {
      name: parsed.name,
      displayText: `${pounds} lb ${parsed.name}`,
      quantity: pounds,
      unit: 'pound',
      category: 'pantry',
      originalText: parsed.originalText
    };
  }
  
  // Default pantry
  return {
    name: parsed.name,
    displayText: `1 package ${parsed.name}`,
    quantity: 1,
    unit: 'package',
    category: 'pantry',
    originalText: parsed.originalText
  };
}

/**
 * Create default mapping for uncategorized items
 */
function createDefaultMapping(parsed: any): MappedIngredient {
  return {
    name: parsed.name,
    displayText: `1 ${parsed.name}`,
    quantity: 1,
    unit: 'item',
    category: 'general',
    originalText: parsed.originalText
  };
}

/**
 * Smart quantity rounding based on ingredient type
 */
export function smartQuantityRounding(quantity: number, category: string): number {
  switch (category) {
    case 'produce':
      // Round to nearest 0.5 lb
      return Math.ceil(quantity * 2) / 2;
    case 'meat':
      // Round up to nearest pound
      return Math.ceil(quantity);
    case 'dairy':
      // Round to standard package sizes
      return Math.ceil(quantity);
    default:
      return Math.ceil(quantity);
  }
}

/**
 * Handle special edge cases
 */
export function handleEdgeCases(ingredient: string): MappedIngredient | null {
  const lower = ingredient.toLowerCase();
  
  // "To taste" items
  if (lower.includes('to taste')) {
    const name = lower.replace('to taste', '').trim();
    return {
      name: name,
      displayText: `1 container ${name}`,
      quantity: 1,
      unit: 'container',
      category: 'spices',
      originalText: ingredient
    };
  }
  
  // Pinch/dash measurements
  if (lower.includes('pinch of') || lower.includes('dash of')) {
    const name = lower.replace(/pinch of|dash of/, '').trim();
    return {
      name: name,
      displayText: `1 container ${name}`,
      quantity: 1,
      unit: 'container',
      category: 'spices',
      originalText: ingredient
    };
  }
  
  // Fresh vs dried herbs
  if (lower.includes('fresh') && (lower.includes('basil') || lower.includes('parsley') || 
      lower.includes('cilantro') || lower.includes('mint'))) {
    const herb = lower.replace('fresh', '').trim();
    return {
      name: `fresh ${herb}`,
      displayText: `1 bunch fresh ${herb}`,
      quantity: 1,
      unit: 'bunch',
      category: 'produce',
      originalText: ingredient
    };
  }
  
  return null;
}