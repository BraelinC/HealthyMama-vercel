import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure env is loaded from project root
dotenv.config({ path: path.join(__dirname, '..', '.env') });

export interface NutritionData {
  calories: number;
  protein: number;      // grams
  carbs: number;        // grams
  fat: number;          // grams
  fiber: number;        // grams
  sugar: number;        // grams
  sodium: number;       // milligrams
  cholesterol: number;  // milligrams
  saturatedFat: number; // grams
  transFat: number;     // grams
  vitaminA?: number;    // mcg
  vitaminC?: number;    // mg
  calcium?: number;     // mg
  iron?: number;        // mg
}

export interface USDAFoodItem {
  fdcId: number;
  description: string;
  dataType: string;
  brandName?: string;
  foodNutrients: Array<{
    nutrientId?: number;
    nutrientName?: string;
    nutrientNumber?: string;
    unitName?: string;
    value?: number;
    amount?: number;
    nutrient?: {
      id?: number;
      name?: string;
      number?: string;
      unitName?: string;
    };
  }>;
}

export class USDANutritionService {
  private apiKey: string | undefined;
  private baseUrl = 'https://api.nal.usda.gov/fdc/v1';
  private cache: Map<string, { data: NutritionData; timestamp: number }> = new Map();
  private cacheExpiry = 7 * 24 * 60 * 60 * 1000; // 7 days
  
  // USDA Nutrient IDs for common nutrients
  private nutrientIds = {
    calories: 1008,      // Energy (kcal)
    protein: 1003,       // Protein (g)
    carbs: 1005,         // Carbohydrate, by difference (g)
    fat: 1004,           // Total lipid (fat) (g)
    fiber: 1079,         // Fiber, total dietary (g)
    sugar: 2000,         // Sugars, total including NLEA (g)
    sodium: 1093,        // Sodium, Na (mg)
    cholesterol: 1253,   // Cholesterol (mg)
    saturatedFat: 1258,  // Fatty acids, total saturated (g)
    transFat: 1257,      // Fatty acids, total trans (g)
    vitaminA: 1106,      // Vitamin A, RAE (µg)
    vitaminC: 1162,      // Vitamin C, total ascorbic acid (mg)
    calcium: 1087,       // Calcium, Ca (mg)
    iron: 1089          // Iron, Fe (mg)
  };
  
  constructor() {
    this.apiKey = process.env.USDA_API_KEY;
    if (!this.apiKey) {
      console.log('⚠️ [USDA NUTRITION] No API key found. Set USDA_API_KEY in .env');
    } else {
      console.log('✅ [USDA NUTRITION] Service initialized with API key');
    }
  }

  async searchFood(query: string): Promise<USDAFoodItem | null> {
    if (!this.apiKey) {
      console.log('⚠️ [USDA NUTRITION] Cannot search without API key');
      return null;
    }

    try {
      console.log(`🔍 [USDA NUTRITION] Searching for: ${query}`);
      
      // Search for the food item
      const searchUrl = `${this.baseUrl}/foods/search?query=${encodeURIComponent(query)}&api_key=${this.apiKey}&pageSize=5`;
      const searchResponse = await fetch(searchUrl);
      
      if (!searchResponse.ok) {
        throw new Error(`USDA API error: ${searchResponse.status}`);
      }
      
      const searchData: any = await searchResponse.json();
      
      if (!searchData.foods || searchData.foods.length === 0) {
        console.log(`❌ [USDA NUTRITION] No results found for: ${query}`);
        return null;
      }
      
      // Get the first result (most relevant)
      const food = searchData.foods[0];
      console.log(`✅ [USDA NUTRITION] Found: ${food.description} (ID: ${food.fdcId})`);
      
      // Get detailed nutrition data for this food
      const detailUrl = `${this.baseUrl}/food/${food.fdcId}?api_key=${this.apiKey}`;
      const detailResponse = await fetch(detailUrl);
      
      if (!detailResponse.ok) {
        throw new Error(`USDA API detail error: ${detailResponse.status}`);
      }
      
      const detailData: any = await detailResponse.json();
      
      console.log(`📋 [USDA NUTRITION] Food type: ${detailData.dataType}`);
      console.log(`📋 [USDA NUTRITION] Nutrients count: ${detailData.foodNutrients?.length || 0}`);
      
      // Log first few nutrients for debugging
      if (detailData.foodNutrients && detailData.foodNutrients.length > 0) {
        console.log(`📋 [USDA NUTRITION] Sample nutrients:`);
        detailData.foodNutrients.slice(0, 5).forEach((n: any) => {
          const name = n.nutrientName || n.nutrient?.name || n.name || 'Unknown';
          const value = n.amount || n.value || 0;
          const unit = n.unitName || n.nutrient?.unitName || n.unit || '';
          console.log(`   - ${name}: ${value} ${unit}`);
        });
      }
      
      return {
        fdcId: detailData.fdcId,
        description: detailData.description,
        dataType: detailData.dataType,
        brandName: detailData.brandName,
        foodNutrients: detailData.foodNutrients || []
      };
      
    } catch (error) {
      console.error('🔥 [USDA NUTRITION] Error searching food:', error);
      return null;
    }
  }

  async getNutritionData(ingredientName: string, quantity: number = 100, unit: string = 'g'): Promise<NutritionData | null> {
    // Check cache first
    const cacheKey = `${ingredientName}_${quantity}_${unit}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      console.log(`📦 [USDA NUTRITION] Using cached data for: ${ingredientName}`);
      return cached.data;
    }
    
    // Search for the food item
    const foodItem = await this.searchFood(ingredientName);
    
    if (!foodItem) {
      console.log(`❌ [USDA NUTRITION] No data found for: ${ingredientName}`);
      return null;
    }
    
    // Extract nutrition data
    const nutrition = this.extractNutritionFromFood(foodItem, quantity, unit);
    
    // Cache the result
    this.cache.set(cacheKey, {
      data: nutrition,
      timestamp: Date.now()
    });
    
    return nutrition;
  }

  private extractNutritionFromFood(food: USDAFoodItem, quantity: number, unit: string): NutritionData {
    const nutrients = food.foodNutrients;
    
    // Convert quantity to grams if needed (USDA data is usually per 100g)
    const multiplier = this.getMultiplier(quantity, unit);
    
    // Extract nutrients with fallback to 0 if not found
    // Handle different USDA API response structures
    const getNutrientValue = (nutrientId: number, namePatterns?: string[]): number => {
      // Find nutrient by various possible structures
      const nutrient = nutrients.find(n => {
        // Check nutrient ID - different API response structures
        if (n.nutrientId === nutrientId) return true;
        if (n.nutrient?.id === nutrientId) return true;
        if (n.nutrient?.nutrientId === nutrientId) return true;
        
        // Check nutrient name
        if (namePatterns) {
          const name = (n.nutrientName || n.nutrient?.name || n.nutrient?.nutrientName || n.name || '').toLowerCase();
          return namePatterns.some(pattern => name.includes(pattern));
        }
        
        return false;
      });
      
      if (nutrient) {
        // Get value from various possible fields - handle all USDA response formats
        let value = 0;
        
        // Try different value fields
        if (typeof nutrient.value === 'number') value = nutrient.value;
        else if (typeof nutrient.amount === 'number') value = nutrient.amount;
        else if (typeof nutrient.nutrient?.value === 'number') value = nutrient.nutrient.value;
        else if (typeof nutrient.nutrient?.amount === 'number') value = nutrient.nutrient.amount;
        
        const unitName = nutrient.unitName || nutrient.nutrient?.unitName || nutrient.unit || '';
        const nutrientName = nutrient.nutrientName || nutrient.nutrient?.name || nutrient.nutrient?.nutrientName || nutrient.name || 'Unknown';
        
        if (value > 0) {
          console.log(`   Found: ${nutrientName} = ${value} ${unitName}`);
        }
        
        return value * multiplier;
      }
      
      return 0;
    };
    
    return {
      calories: Math.round(getNutrientValue(this.nutrientIds.calories, ['energy', 'calorie'])),
      protein: Math.round(getNutrientValue(this.nutrientIds.protein, ['protein']) * 10) / 10,
      carbs: Math.round(getNutrientValue(this.nutrientIds.carbs, ['carbohydrate']) * 10) / 10,
      fat: Math.round(getNutrientValue(this.nutrientIds.fat, ['total lipid', 'fat']) * 10) / 10,
      fiber: Math.round(getNutrientValue(this.nutrientIds.fiber, ['fiber', 'dietary fiber']) * 10) / 10,
      sugar: Math.round(getNutrientValue(this.nutrientIds.sugar, ['sugar', 'total sugar']) * 10) / 10,
      sodium: Math.round(getNutrientValue(this.nutrientIds.sodium, ['sodium'])),
      cholesterol: Math.round(getNutrientValue(this.nutrientIds.cholesterol, ['cholesterol'])),
      saturatedFat: Math.round(getNutrientValue(this.nutrientIds.saturatedFat, ['saturated']) * 10) / 10,
      transFat: Math.round(getNutrientValue(this.nutrientIds.transFat, ['trans']) * 10) / 10,
      vitaminA: Math.round(getNutrientValue(this.nutrientIds.vitaminA, ['vitamin a'])),
      vitaminC: Math.round(getNutrientValue(this.nutrientIds.vitaminC, ['vitamin c', 'ascorbic acid']) * 10) / 10,
      calcium: Math.round(getNutrientValue(this.nutrientIds.calcium, ['calcium'])),
      iron: Math.round(getNutrientValue(this.nutrientIds.iron, ['iron']) * 10) / 10
    };
  }

  private getMultiplier(quantity: number, unit: string): number {
    // Convert various units to grams (USDA data is per 100g)
    const conversions: Record<string, number> = {
      'g': quantity / 100,
      'gram': quantity / 100,
      'grams': quantity / 100,
      'kg': (quantity * 1000) / 100,
      'kilogram': (quantity * 1000) / 100,
      'oz': (quantity * 28.35) / 100,
      'ounce': (quantity * 28.35) / 100,
      'lb': (quantity * 453.592) / 100,
      'pound': (quantity * 453.592) / 100,
      'cup': (quantity * 240) / 100,  // Approximate for liquids
      'cups': (quantity * 240) / 100,
      'tablespoon': (quantity * 15) / 100,
      'tablespoons': (quantity * 15) / 100,
      'tbsp': (quantity * 15) / 100,
      'teaspoon': (quantity * 5) / 100,
      'teaspoons': (quantity * 5) / 100,
      'tsp': (quantity * 5) / 100,
      'ml': quantity / 100,  // Assuming water density
      'milliliter': quantity / 100,
      'l': (quantity * 1000) / 100,
      'liter': (quantity * 1000) / 100,
      'piece': quantity,  // Varies greatly, use estimated values
      'pieces': quantity,
      'item': quantity,
      'items': quantity,
      'serving': quantity,
      'servings': quantity
    };
    
    const unitLower = unit.toLowerCase();
    return conversions[unitLower] || (quantity / 100);
  }


  // Clear the cache
  clearCache(): void {
    this.cache.clear();
    console.log('🧹 [USDA NUTRITION] Cache cleared');
  }
}

// Export singleton instance
export const usdaNutritionService = new USDANutritionService();