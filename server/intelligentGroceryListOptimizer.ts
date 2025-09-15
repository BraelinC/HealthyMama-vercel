/**
 * Intelligent Grocery List Optimizer
 * Uses GPT-4o-mini to consolidate ingredients and convert to sensible purchase quantities
 */

import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface ConsolidatedIngredient {
  name: string;
  displayText: string;
  quantity: number;
  unit: string;
  category?: string;
  notes?: string;
}

interface GroceryOptimizationResult {
  consolidatedIngredients: ConsolidatedIngredient[];
  savings: {
    duplicatesRemoved: number;
    itemsConsolidated: number;
  };
  recommendations: string[];
}

/**
 * Consolidate ingredients from meal plan using GPT-4o-mini
 */
export async function consolidateIngredientsWithAI(
  ingredients: string[]
): Promise<GroceryOptimizationResult> {
  try {
    const prompt = `You are a grocery shopping expert. Consolidate this list of ingredients into a smart shopping list with STORE-REALISTIC quantities.

INGREDIENTS TO CONSOLIDATE:
${ingredients.map((ing, i) => `${i + 1}. ${ing}`).join('\n')}

CRITICAL RULE #1 - DEDUPLICATION (MOST IMPORTANT):
- ALWAYS combine duplicate ingredients FIRST before applying any other rules
- Examples: "2 eggs" + "3 eggs" + "1 egg" = "6 eggs total" → then convert to "1 dozen eggs"
- "1 onion" + "2 onions" + "1 yellow onion" = "4 onions total" → then convert to "2 lb onions"
- "olive oil" appearing 5 times = combine to "1 bottle olive oil" (only buy once)

AFTER DEDUPLICATION, APPLY STORE PACKAGING RULES:
1. PRODUCE (apples, onions, tomatoes, etc):
   - Single items (1 apple, 2 onions) → Convert to pounds: "3 lb apples", "2 lb onions"
   - Never use "1 bag apple" → Always "3 lb apples" or specific weight
   - Leafy greens → "1 bunch" or "1 bag" (e.g., "1 bunch cilantro", "1 bag spinach")

2. EGGS & DAIRY:
   - Eggs: Always in dozens → "1 dozen eggs" (never "6 eggs" or "1 egg")
   - Milk: Use standard sizes → "1 quart milk", "1 half gallon milk"
   - Cheese: By pound → "1 lb cheddar cheese"
   - Butter: By package → "1 lb butter"

3. MEAT & SEAFOOD:
   - Always by pound, round UP → "2 lb chicken breast", "1 lb ground beef"
   - Never use pieces → Convert "3 chicken breasts" to "2 lb chicken breast"

4. SPICES & SEASONINGS (VERY IMPORTANT):
   - ANY amount of spice = "1 container [spice name]"
   - Examples: "1 tsp salt" → "1 container salt"
   - "2 tbsp paprika" → "1 container paprika"
   - "black pepper to taste" → "1 container black pepper"

5. PANTRY ITEMS:
   - Flour: "1 bag (5 lb) all-purpose flour"
   - Sugar: "1 bag (4 lb) sugar"
   - Oil/Vinegar: Always "1 bottle [type]"
   - Rice/Pasta: By pound → "2 lb rice", "1 lb pasta"

6. SPECIAL CASES:
   - "to taste" → "1 container [ingredient]"
   - Fractional amounts → Round UP to practical sizes
   - Fresh herbs → "1 bunch fresh basil" (not dried)

Return ONLY a JSON object with this structure:
{
  "consolidatedIngredients": [
    {
      "name": "eggs",
      "displayText": "1 dozen eggs",
      "quantity": 12,
      "unit": "eggs",
      "category": "dairy",
      "notes": "Combined from 5 recipes"
    }
  ],
  "savings": {
    "duplicatesRemoved": 3,
    "itemsConsolidated": 8
  },
  "recommendations": [
    "Buy eggs in dozen for better value",
    "Single olive oil bottle will cover all recipes"
  ]
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 2000
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }

    const result = JSON.parse(content) as GroceryOptimizationResult;
    
    // Validate and enhance the result
    if (!result.consolidatedIngredients || !Array.isArray(result.consolidatedIngredients)) {
      throw new Error("Invalid response format from AI");
    }

    // Ensure all ingredients have required fields
    result.consolidatedIngredients = result.consolidatedIngredients.map(ing => ({
      ...ing,
      name: ing.name || "Unknown item",
      displayText: ing.displayText || ing.name || "Unknown item",
      quantity: ing.quantity || 1,
      unit: ing.unit || "unit",
      category: ing.category || categorizeIngredient(ing.name)
    }));

    return result;

  } catch (error) {
    console.error('AI ingredient consolidation error:', error);
    
    // Fallback to basic consolidation
    return fallbackConsolidation(ingredients);
  }
}

/**
 * Convert consolidated ingredients to Instacart format with proper API structure
 */
export async function formatForInstacart(ingredients: ConsolidatedIngredient[]) {
  // Import our smart mapper
  const { mapToStoreQuantities, handleEdgeCases } = await import('./instacartQuantityMapper');
  
  return ingredients.map(ing => {
    // First check for edge cases
    const edgeCase = handleEdgeCases(ing.displayText);
    const mapped = edgeCase || mapToStoreQuantities(ing.displayText);
    
    // Extract clean ingredient name and create descriptive display text
    const cleanName = extractCleanIngredientName(mapped.name);
    const descriptiveText = createDescriptiveDisplayText(cleanName, mapped.category);
    
    return {
      name: cleanName,  // Clean ingredient name only (e.g., "eggs", "spinach", "olive oil")
      display_text: descriptiveText,  // Descriptive name for display (e.g., "Large Eggs", "Fresh Spinach")
      measurements: [{
        quantity: mapped.quantity,
        unit: normalizeUnitForInstacart(mapped.unit)
      }]
    };
  });
}

/**
 * Extract clean ingredient name without quantities or units
 */
function extractCleanIngredientName(name: string): string {
  // Remove common descriptors and get base ingredient
  const cleanName = name
    .replace(/^(fresh |organic |dried |ground |whole |chopped |minced |sliced )/gi, '')
    .replace(/\s*(leaves?|powder|flakes?)\s*$/gi, '')
    .trim();
  
  return cleanName;
}

/**
 * Create descriptive display text for better Instacart product matching
 */
function createDescriptiveDisplayText(name: string, category: string): string {
  const descriptiveMap: { [key: string]: { [key: string]: string } } = {
    produce: {
      'apples': 'Fresh Red Apples',
      'apple': 'Fresh Red Apples',
      'bananas': 'Fresh Bananas',
      'banana': 'Fresh Bananas',
      'onions': 'Yellow Onions',
      'onion': 'Yellow Onions',
      'tomatoes': 'Fresh Tomatoes',
      'tomato': 'Fresh Tomatoes',
      'lettuce': 'Fresh Romaine Lettuce',
      'spinach': 'Fresh Baby Spinach',
      'carrots': 'Fresh Carrots',
      'carrot': 'Fresh Carrots',
      'potatoes': 'Russet Potatoes',
      'potato': 'Russet Potatoes',
      'garlic': 'Fresh Garlic',
      'cilantro': 'Fresh Cilantro Bunch',
      'parsley': 'Fresh Parsley Bunch',
      'basil': 'Fresh Basil Leaves'
    },
    dairy: {
      'eggs': 'Large Eggs',
      'egg': 'Large Eggs',
      'milk': 'Whole Milk',
      'butter': 'Unsalted Butter',
      'cheese': 'Cheddar Cheese',
      'cheddar cheese': 'Sharp Cheddar Cheese',
      'mozzarella': 'Mozzarella Cheese',
      'yogurt': 'Plain Greek Yogurt',
      'cream': 'Heavy Cream',
      'sour cream': 'Sour Cream'
    },
    meat: {
      'chicken': 'Boneless Chicken Breast',
      'chicken breast': 'Boneless Skinless Chicken Breast',
      'ground beef': 'Lean Ground Beef',
      'beef': 'Beef Sirloin',
      'pork': 'Pork Loin',
      'bacon': 'Thick Cut Bacon',
      'turkey': 'Ground Turkey',
      'salmon': 'Fresh Atlantic Salmon',
      'shrimp': 'Large Raw Shrimp'
    },
    spices: {
      'salt': 'Sea Salt',
      'pepper': 'Black Pepper',
      'black pepper': 'Ground Black Pepper',
      'paprika': 'Paprika',
      'cumin': 'Ground Cumin',
      'oregano': 'Dried Oregano',
      'cinnamon': 'Ground Cinnamon',
      'garlic powder': 'Garlic Powder',
      'onion powder': 'Onion Powder',
      'chili powder': 'Chili Powder',
      'vanilla': 'Pure Vanilla Extract'
    },
    pantry: {
      'flour': 'All-Purpose Flour',
      'all-purpose flour': 'All-Purpose Flour',
      'sugar': 'Granulated Sugar',
      'brown sugar': 'Light Brown Sugar',
      'rice': 'Long Grain White Rice',
      'pasta': 'Spaghetti Pasta',
      'olive oil': 'Extra Virgin Olive Oil',
      'oil': 'Vegetable Oil',
      'vinegar': 'White Vinegar',
      'baking soda': 'Baking Soda',
      'baking powder': 'Baking Powder'
    }
  };
  
  // Check for specific mapping
  const categoryMap = descriptiveMap[category] || {};
  const lowerName = name.toLowerCase();
  
  // Return mapped name or create a default descriptive name
  if (categoryMap[lowerName]) {
    return categoryMap[lowerName];
  }
  
  // Default formatting: capitalize first letter of each word
  return name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Fallback consolidation if AI fails
 */
function fallbackConsolidation(ingredients: string[]): GroceryOptimizationResult {
  // Group identical ingredients
  const ingredientMap = new Map<string, number>();
  
  ingredients.forEach(ing => {
    const normalized = ing.toLowerCase().trim();
    ingredientMap.set(normalized, (ingredientMap.get(normalized) || 0) + 1);
  });

  const consolidated: ConsolidatedIngredient[] = Array.from(ingredientMap.entries()).map(([name, count]) => ({
    name: name,
    displayText: count > 1 ? `${name} (×${count})` : name,
    quantity: count,
    unit: "unit",
    category: categorizeIngredient(name)
  }));

  return {
    consolidatedIngredients: consolidated,
    savings: {
      duplicatesRemoved: ingredients.length - consolidated.length,
      itemsConsolidated: 0
    },
    recommendations: [
      "Consider buying in bulk for frequently used items",
      "Check your pantry before shopping"
    ]
  };
}

/**
 * Categorize ingredient for better organization
 */
function categorizeIngredient(ingredient: string): string {
  const lowerIngredient = ingredient.toLowerCase();
  
  if (lowerIngredient.includes('chicken') || lowerIngredient.includes('beef') || 
      lowerIngredient.includes('pork') || lowerIngredient.includes('turkey') ||
      lowerIngredient.includes('lamb') || lowerIngredient.includes('bacon')) {
    return 'meat';
  }
  
  if (lowerIngredient.includes('fish') || lowerIngredient.includes('salmon') ||
      lowerIngredient.includes('shrimp') || lowerIngredient.includes('crab')) {
    return 'seafood';
  }
  
  if (lowerIngredient.includes('milk') || lowerIngredient.includes('cheese') ||
      lowerIngredient.includes('yogurt') || lowerIngredient.includes('butter') ||
      lowerIngredient.includes('cream')) {
    return 'dairy';
  }
  
  if (lowerIngredient.includes('egg')) {
    return 'dairy';
  }
  
  if (lowerIngredient.includes('bread') || lowerIngredient.includes('tortilla') ||
      lowerIngredient.includes('roll') || lowerIngredient.includes('bagel')) {
    return 'bakery';
  }
  
  if (lowerIngredient.includes('tomato') || lowerIngredient.includes('lettuce') ||
      lowerIngredient.includes('onion') || lowerIngredient.includes('garlic') ||
      lowerIngredient.includes('carrot') || lowerIngredient.includes('pepper') ||
      lowerIngredient.includes('apple') || lowerIngredient.includes('banana')) {
    return 'produce';
  }
  
  return 'pantry';
}

/**
 * Normalize units for Instacart compatibility
 */
function normalizeUnitForInstacart(unit: string): string {
  const unitMap: { [key: string]: string } = {
    'dozen': 'unit',
    'half dozen': 'unit',
    'eggs': 'unit',
    'cups': 'cup',
    'tbsp': 'tablespoon',
    'tsp': 'teaspoon',
    'lbs': 'pound',
    'lb': 'pound',
    'oz': 'ounce',
    'kg': 'kilogram',
    'g': 'gram',
    'ml': 'milliliter',
    'l': 'liter',
    'gallon': 'gallon',
    'quart': 'quart',
    'pint': 'pint'
  };
  
  const lowerUnit = unit.toLowerCase();
  return unitMap[lowerUnit] || lowerUnit;
}