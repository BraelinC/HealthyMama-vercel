/**
 * GPT-powered ingredient parsing for accurate nutrition calculations
 * Uses OpenAI to intelligently parse ingredient text and extract clean food names
 */

import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface ParsedIngredientGPT {
  originalText: string;
  cleanFoodName: string;
  quantity: number;
  unit: string;
  estimatedGrams: number;
}

/**
 * Use GPT to parse ingredient text and extract clean food name with quantity
 */
export async function parseIngredientWithGPT(ingredientText: string): Promise<ParsedIngredientGPT> {
  try {
    const prompt = `Parse this ingredient text and extract EXACT measurements for nutrition calculation:

Ingredient: "${ingredientText}"

Extract and return as JSON with these exact fields:
1. cleanFoodName: The core food item name (remove only prep methods like "chopped", "diced", brands, but keep the main food)
2. quantity: The EXACT numeric amount from the ingredient text (if missing, use 1)
3. unit: The EXACT measurement unit from the text (tbsp, tsp, cup, oz, lb, g, clove, etc.) or "item" if no unit
4. estimatedGrams: Convert the quantity+unit to total grams using standard conversions

Conversion examples:
- 1 tbsp = 15g (for most ingredients)
- 1 tsp = 5g  
- 1 cup = 240ml (density varies by food)
- 1 lb = 454g
- 1 oz = 28g
- 1 clove garlic = 3g
- 1 medium onion = 150g
- 1 lime = 67g

Examples:
"1 tbsp garlic, crushed/minced" → {"cleanFoodName": "garlic", "quantity": 1, "unit": "tbsp", "estimatedGrams": 15}
"2 cups all-purpose flour" → {"cleanFoodName": "flour", "quantity": 2, "unit": "cup", "estimatedGrams": 240}
"1 lb shrimp, peeled" → {"cleanFoodName": "shrimp", "quantity": 1, "unit": "lb", "estimatedGrams": 454}
"3 medium tomatoes, diced" → {"cleanFoodName": "tomatoes", "quantity": 3, "unit": "item", "estimatedGrams": 360}
"1/2 cup red onions" → {"cleanFoodName": "red onions", "quantity": 0.5, "unit": "cup", "estimatedGrams": 80}

CRITICAL: Extract the EXACT quantity and unit from the original text. The nutrition depends on accurate measurements.

Return only the JSON object.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 200
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }

    console.log(`GPT parsing "${ingredientText}" -> Response: ${content}`);
    
    const parsed = JSON.parse(content);
    
    // Validate the parsed result
    if (!parsed.cleanFoodName || parsed.cleanFoodName.length < 2) {
      console.warn(`Invalid cleanFoodName from GPT: "${parsed.cleanFoodName}" for ingredient "${ingredientText}"`);
      parsed.cleanFoodName = extractFallbackFoodName(ingredientText);
    }
    
    // Ensure we have realistic gram estimates
    if (!parsed.estimatedGrams || parsed.estimatedGrams < 1) {
      parsed.estimatedGrams = Math.max(parsed.quantity * 15, 5); // Basic fallback
    }
    
    const result = {
      originalText: ingredientText,
      cleanFoodName: parsed.cleanFoodName,
      quantity: parsed.quantity || 1,
      unit: parsed.unit || "item",
      estimatedGrams: parsed.estimatedGrams
    };
    
    console.log(`Final parsed result:`, result);
    return result;

  } catch (error) {
    console.error('GPT ingredient parsing error:', error);
    
    // Fallback to simple parsing if GPT fails
    return {
      originalText: ingredientText,
      cleanFoodName: extractFallbackFoodName(ingredientText),
      quantity: 1,
      unit: "item",
      estimatedGrams: 50
    };
  }
}

/**
 * Fallback food name extraction if GPT fails
 */
function extractFallbackFoodName(text: string): string {
  const cleaned = text.toLowerCase()
    .replace(/^\d+(\.\d+)?\s*(\/\d+)?\s*(cups?|tbsp|tsp|tablespoons?|teaspoons?|oz|ounces?|lbs?|pounds?|g|grams?|ml|l|liters?|pinch|cloves?|medium|large|small)?\s*/, '')
    .replace(/\b(chopped|diced|minced|sliced|crushed|grated|shredded|fresh|dried|frozen)\b/g, '')
    .replace(/\b(large|medium|small|extra)\b/g, '')
    .replace(/,.*$/, '')
    .replace(/\/.*$/, '')
    .trim();
  
  return cleaned || "unknown";
}

/**
 * Batch parse multiple ingredients with GPT
 */
export async function parseIngredientsWithGPT(ingredients: string[]): Promise<ParsedIngredientGPT[]> {
  try {
    const prompt = `Parse these ingredient texts and extract essential information for nutrition lookup:

Ingredients:
${ingredients.map((ing, i) => `${i + 1}. "${ing}"`).join('\n')}

For each ingredient, extract:
- cleanFoodName: Core food item (remove prep methods, sizes, brands)
- quantity: Numeric amount (convert fractions to decimals: 1/2 = 0.5, 1/4 = 0.25, 3/4 = 0.75, 1/3 = 0.33, 2/3 = 0.67)
- unit: Measurement unit or "to taste" for seasonings
- estimatedGrams: Total weight estimate in grams (use 0 for "to taste" items)

Fraction conversion examples:
- "1/2 cup flour" → quantity: 0.5, unit: "cup"
- "1 1/2 cups milk" → quantity: 1.5, unit: "cups"
- "1/4 teaspoon salt" → quantity: 0.25, unit: "teaspoon"
- "3/4 pound beef" → quantity: 0.75, unit: "pound"

Special handling:
- For "salt", "pepper", "salt and pepper", "seasoning to taste" etc: use quantity: 0, unit: "to taste", estimatedGrams: 0
- Always convert fractions to decimal numbers
- Extract the core food name without measurements or preparation methods

Return as JSON array with objects in the same order.

Example format:
[
  {"cleanFoodName": "garlic", "quantity": 1, "unit": "tbsp", "estimatedGrams": 9},
  {"cleanFoodName": "flour", "quantity": 0.5, "unit": "cup", "estimatedGrams": 60},
  {"cleanFoodName": "salt", "quantity": 0, "unit": "to taste", "estimatedGrams": 0}
]`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 1000
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }

    const parsed = JSON.parse(content);
    const results = parsed.ingredients || parsed;
    
    return ingredients.map((originalText, index) => {
      const result = results[index] || {};
      return {
        originalText,
        cleanFoodName: result.cleanFoodName || extractFallbackFoodName(originalText),
        quantity: result.quantity || 1,
        unit: result.unit || "item",
        estimatedGrams: result.estimatedGrams || 50
      };
    });

  } catch (error) {
    console.error('GPT batch ingredient parsing error:', error);
    
    // Fallback to individual parsing
    return ingredients.map(text => ({
      originalText: text,
      cleanFoodName: extractFallbackFoodName(text),
      quantity: 1,
      unit: "item",
      estimatedGrams: 50
    }));
  }
}