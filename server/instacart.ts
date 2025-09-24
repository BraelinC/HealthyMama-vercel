import fetch from "node-fetch";

interface Measurement {
  quantity: number;
  unit: string;
}

interface Ingredient {
  name: string;
  display_text: string;
  measurements: Measurement[];
}

interface ParsedIngredient {
  quantity: string;
  unit: string;
  ingredient: string;
  preparation?: string;
}

interface RecipeLandingPageConfig {
  partner_linkback_url?: string;
  enable_pantry_items?: boolean;
}

interface InstacartRecipe {
  title: string;
  image_url: string;
  link_type: string;
  instructions: string[];
  ingredients: Ingredient[];
  landing_page_configuration?: RecipeLandingPageConfig;
}

/**
 * Create a shoppable recipe page using the Instacart Developer Platform API
 */
export async function createInstacartRecipePage(recipeData: any) {
  const API_KEY = process.env.INSTACART_API_KEY;
  if (!API_KEY) {
    throw new Error("Instacart API key is required. Set the INSTACART_API_KEY environment variable.");
  }
  
  const url = "https://connect.dev.instacart.tools/idp/v1/products/recipe";
  
  const headers = {
    "Authorization": `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
    "Accept": "application/json"
  };
  
  // Format recipe data for Instacart API with optimized ingredients
  const recipe: InstacartRecipe = {
    title: recipeData.title,
    image_url: recipeData.image_url,
    link_type: "recipe",
    instructions: recipeData.instructions,
    ingredients: await formatIngredientsForInstacart(recipeData.ingredients),
    landing_page_configuration: {
      partner_linkback_url: process.env.VERCEL_PROJECT_PRODUCTION_URL 
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` 
        : process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}` 
        : "https://example.com",
      enable_pantry_items: true
    }
  };
  
  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(recipe)
    });
    
    if (!response.ok) {
      let errorMessage = `HTTP error ${response.status}: ${response.statusText}`;
      
      try {
        const errorData = await response.json();
        errorMessage = `HTTP error ${response.status}: ${JSON.stringify(errorData)}`;
      } catch (e) {
        // If we can't parse JSON, use the original error message
      }
      
      throw new Error(errorMessage);
    }
    
    return await response.json();
  } catch (error: any) {
    console.error("Instacart API error:", error);
    throw new Error(`Failed to create Instacart recipe: ${error.message}`);
  }
}

/**
 * Find nearby retailers that can fulfill the recipe ingredients
 */
export async function getNearbyRetailers(postalCode: string, countryCode: string = "US") {
  const API_KEY = process.env.INSTACART_API_KEY;
  if (!API_KEY) {
    throw new Error("Instacart API key is required. Set the INSTACART_API_KEY environment variable.");
  }
  
  const url = `https://connect.dev.instacart.tools/idp/v1/retailers?postal_code=${postalCode}&country_code=${countryCode}`;
  
  const headers = {
    "Authorization": `Bearer ${API_KEY}`,
    "Accept": "application/json"
  };
  
  try {
    const response = await fetch(url, {
      method: "GET",
      headers
    });
    
    if (!response.ok) {
      let errorMessage = `HTTP error ${response.status}: ${response.statusText}`;
      
      try {
        const errorData = await response.json();
        errorMessage = `HTTP error ${response.status}: ${JSON.stringify(errorData)}`;
      } catch (e) {
        // If we can't parse JSON, use the original error message
      }
      
      throw new Error(errorMessage);
    }
    
    return await response.json();
  } catch (error: any) {
    console.error("Instacart API error:", error);
    throw new Error(`Failed to get nearby retailers: ${error.message}`);
  }
}

/**
 * Format ingredients for better Instacart integration using smart mapping
 */
async function formatIngredientsForInstacart(ingredients: any[]): Promise<Ingredient[]> {
  // Import our smart mapper
  const { mapToStoreQuantities, handleEdgeCases } = await import('./instacartQuantityMapper');
  
  return ingredients.map(ingredient => {
    if (typeof ingredient === 'string') {
      // First check for edge cases
      const edgeCase = handleEdgeCases(ingredient);
      if (edgeCase) {
        return {
          name: edgeCase.name,
          display_text: edgeCase.displayText,
          measurements: [{
            quantity: edgeCase.quantity,
            unit: normalizeUnit(edgeCase.unit)
          }]
        };
      }
      
      // Apply smart mapping
      const mapped = mapToStoreQuantities(ingredient);
      return {
        name: mapped.name,
        display_text: mapped.displayText,
        measurements: [{
          quantity: mapped.quantity,
          unit: normalizeUnit(mapped.unit)
        }]
      };
    } else if (ingredient.display_text) {
      // Already formatted ingredient - still apply smart mapping to display_text
      const mapped = mapToStoreQuantities(ingredient.display_text);
      return {
        name: mapped.name,
        display_text: mapped.displayText,
        measurements: [{
          quantity: mapped.quantity,
          unit: normalizeUnit(mapped.unit)
        }]
      };
    } else {
      // Handle object format with smart mapping
      const displayText = ingredient.display_text || ingredient.name || 'Unknown ingredient';
      const mapped = mapToStoreQuantities(displayText);
      return {
        name: mapped.name,
        display_text: mapped.displayText,
        measurements: [{
          quantity: mapped.quantity,
          unit: normalizeUnit(mapped.unit)
        }]
      };
    }
  });
}

/**
 * Parse ingredient string into components for better Instacart matching
 */
function parseIngredientString(ingredientStr: string): ParsedIngredient {
  const cleaned = ingredientStr.trim();
  
  // Common patterns for ingredient parsing
  const patterns = [
    // "2 cups flour" or "1/2 cup milk"
    /^(\d+(?:\/\d+)?(?:\.\d+)?)\s+(\w+)\s+(.+?)(?:,\s*(.+))?$/,
    // "1 large onion, diced"
    /^(\d+)\s+(\w+)\s+(.+?)(?:,\s*(.+))?$/,
    // "Salt and pepper to taste"
    /^(.+?)\s+to\s+taste$/,
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match) {
      if (pattern.source.includes('to\\s+taste')) {
        return {
          quantity: '',
          unit: '',
          ingredient: match[1],
          preparation: 'to taste'
        };
      } else {
        return {
          quantity: match[1] || '',
          unit: match[2] || '',
          ingredient: match[3] || '',
          preparation: match[4] || undefined
        };
      }
    }
  }

  // Fallback: treat entire string as ingredient
  return {
    quantity: '',
    unit: '',
    ingredient: cleaned
  };
}

/**
 * Normalize units for better Instacart compatibility
 */
function normalizeUnit(unit: string): string {
  const unitMap: { [key: string]: string } = {
    'cups': 'cup',
    'tbsp': 'tablespoon',
    'tsp': 'teaspoon',
    'lbs': 'pound',
    'lb': 'pound',
    'oz': 'ounce',
    'kg': 'kilogram',
    'g': 'gram',
    'ml': 'milliliter',
    'l': 'liter'
  };
  
  const lowerUnit = unit.toLowerCase();
  return unitMap[lowerUnit] || lowerUnit;
}

/**
 * Create shopping list from meal plan with bulk recommendations
 */
export async function createOptimizedShoppingList(mealPlan: any, userPreferences?: any) {
  try {
    // Import the optimizer here to avoid circular dependencies
    const { optimizeMealPlanForIngredients, generateOrganizedShoppingList } = 
      await import('./smartIngredientOptimizer');
    
    const optimization = optimizeMealPlanForIngredients(mealPlan);
    const organizedList = generateOrganizedShoppingList(optimization.ingredientAnalysis);
    
    // Create enhanced shopping list data
    return {
      shoppingList: optimization.shoppingList,
      organizedSections: organizedList,
      totalSavings: organizedList.totalSavings,
      highValueItems: organizedList.highValueItems,
      ingredientAnalysis: optimization.ingredientAnalysis,
      recommendations: generateShoppingRecommendations(organizedList)
    };
  } catch (error: any) {
    console.error("Error creating optimized shopping list:", error);
    throw new Error(`Failed to create shopping list: ${error.message}`);
  }
}

/**
 * Generate smart shopping recommendations based on the organized list
 */
function generateShoppingRecommendations(organizedList: any): string[] {
  const recommendations = [];
  
  if (organizedList.totalSavings > 5) {
    recommendations.push(`💰 Estimated total savings: $${organizedList.totalSavings.toFixed(2)} with bulk buying`);
  }
  
  if (organizedList.highValueItems.length > 0) {
    recommendations.push(`🎯 Priority items for maximum savings: ${organizedList.highValueItems.slice(0, 3).join(', ')}`);
  }
  
  if (organizedList.meat.length > 2) {
    recommendations.push(`🥩 Consider buying proteins in bulk and freezing portions`);
  }
  
  if (organizedList.produce.length > 3) {
    recommendations.push(`🥬 Shop produce section first and prep items that can be washed/chopped in advance`);
  }
  
  recommendations.push(`📋 Shop by department: Produce → Meat → Dairy → Pantry for efficiency`);
  
  return recommendations;
}
