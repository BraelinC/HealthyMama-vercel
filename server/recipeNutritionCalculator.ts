import { groqIngredientParser, type ParsedIngredient } from './groqIngredientParser';
import { usdaNutritionService, type NutritionData } from './usdaNutritionService';

export interface RecipeNutrition {
  servings: number;
  perServing: NutritionData;
  total: NutritionData;
  ingredientBreakdown: Array<{
    ingredient: string;
    amount: string;
    nutrition: NutritionData;
  }>;
}

export class RecipeNutritionCalculator {
  constructor() {
    console.log('🍎 [RECIPE NUTRITION] Calculator initialized');
  }

  /**
   * Calculate nutrition for a recipe given its ingredients
   */
  async calculateRecipeNutrition(
    ingredients: string[],
    servings: number = 4
  ): Promise<RecipeNutrition | null> {
    console.log(`📊 [RECIPE NUTRITION] Calculating nutrition for ${ingredients.length} ingredients`);
    console.log(`🍽️ [RECIPE NUTRITION] Recipe serves: ${servings}`);

    try {
      // Step 1: Parse ingredients using Groq GPT-OSS-20B
      const parsedIngredients = await groqIngredientParser.parseIngredients(ingredients);
      
      if (!parsedIngredients || parsedIngredients.length === 0) {
        console.error('❌ [RECIPE NUTRITION] Failed to parse ingredients');
        return null;
      }

      console.log(`✅ [RECIPE NUTRITION] Parsed ${parsedIngredients.length} ingredients`);

      // Step 2: Get nutrition data for each ingredient
      const ingredientBreakdown: RecipeNutrition['ingredientBreakdown'] = [];
      
      for (const parsed of parsedIngredients) {
        console.log(`🔍 [RECIPE NUTRITION] Getting nutrition for: ${parsed.ingredient} (${parsed.amount})`);
        
        const nutrition = await usdaNutritionService.getNutritionData(
          parsed.ingredient,
          parsed.quantity,
          parsed.unit
        );

        if (nutrition) {
          ingredientBreakdown.push({
            ingredient: parsed.ingredient,
            amount: parsed.amount,
            nutrition
          });
        } else {
          console.warn(`⚠️ [RECIPE NUTRITION] No USDA data for: ${parsed.ingredient} - skipping`);
          // Skip ingredients without USDA data - no fallback
        }
      }

      // Check if we have enough data to provide meaningful nutrition
      if (ingredientBreakdown.length === 0) {
        console.error('❌ [RECIPE NUTRITION] No ingredients had USDA nutrition data');
        return null;
      }
      
      const dataCompleteness = (ingredientBreakdown.length / parsedIngredients.length) * 100;
      console.log(`📊 [RECIPE NUTRITION] Data completeness: ${dataCompleteness.toFixed(1)}% (${ingredientBreakdown.length}/${parsedIngredients.length} ingredients)`);
      
      if (dataCompleteness < 50) {
        console.warn('⚠️ [RECIPE NUTRITION] Less than 50% of ingredients have USDA data - insufficient for accurate nutrition');
        return null;
      }

      // Step 3: Calculate total nutrition
      const totalNutrition = this.sumNutrition(ingredientBreakdown.map(i => i.nutrition));

      // Step 4: Calculate per-serving nutrition
      const perServingNutrition = this.divideNutrition(totalNutrition, servings);

      const result: RecipeNutrition = {
        servings,
        perServing: perServingNutrition,
        total: totalNutrition,
        ingredientBreakdown
      };

      console.log(`✅ [RECIPE NUTRITION] Calculation complete`);
      console.log(`📊 [RECIPE NUTRITION] Per serving: ${perServingNutrition.calories} calories`);
      console.log(`📊 [RECIPE NUTRITION] Macros: ${perServingNutrition.protein}g protein, ${perServingNutrition.carbs}g carbs, ${perServingNutrition.fat}g fat`);

      return result;

    } catch (error) {
      console.error('🔥 [RECIPE NUTRITION] Error calculating nutrition:', error);
      return null;
    }
  }

  /**
   * Parse ingredients and return formatted table
   */
  async parseIngredientsToTable(ingredients: string[]): Promise<string> {
    const parsed = await groqIngredientParser.parseIngredients(ingredients);
    if (parsed.length === 0) {
      return 'No ingredients could be parsed';
    }
    return groqIngredientParser.formatAsTable(parsed);
  }

  /**
   * Sum nutrition data from multiple ingredients
   */
  private sumNutrition(nutritionArray: NutritionData[]): NutritionData {
    const sum: NutritionData = {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sugar: 0,
      sodium: 0,
      cholesterol: 0,
      saturatedFat: 0,
      transFat: 0,
      vitaminA: 0,
      vitaminC: 0,
      calcium: 0,
      iron: 0
    };

    for (const nutrition of nutritionArray) {
      sum.calories += nutrition.calories;
      sum.protein += nutrition.protein;
      sum.carbs += nutrition.carbs;
      sum.fat += nutrition.fat;
      sum.fiber += nutrition.fiber;
      sum.sugar += nutrition.sugar;
      sum.sodium += nutrition.sodium;
      sum.cholesterol += nutrition.cholesterol;
      sum.saturatedFat += nutrition.saturatedFat;
      sum.transFat += nutrition.transFat;
      
      if (nutrition.vitaminA !== undefined && sum.vitaminA !== undefined) {
        sum.vitaminA += nutrition.vitaminA;
      }
      if (nutrition.vitaminC !== undefined && sum.vitaminC !== undefined) {
        sum.vitaminC += nutrition.vitaminC;
      }
      if (nutrition.calcium !== undefined && sum.calcium !== undefined) {
        sum.calcium += nutrition.calcium;
      }
      if (nutrition.iron !== undefined && sum.iron !== undefined) {
        sum.iron += nutrition.iron;
      }
    }

    return this.roundNutrition(sum);
  }

  /**
   * Divide nutrition data by number of servings
   */
  private divideNutrition(nutrition: NutritionData, servings: number): NutritionData {
    const divided: NutritionData = {
      calories: nutrition.calories / servings,
      protein: nutrition.protein / servings,
      carbs: nutrition.carbs / servings,
      fat: nutrition.fat / servings,
      fiber: nutrition.fiber / servings,
      sugar: nutrition.sugar / servings,
      sodium: nutrition.sodium / servings,
      cholesterol: nutrition.cholesterol / servings,
      saturatedFat: nutrition.saturatedFat / servings,
      transFat: nutrition.transFat / servings,
      vitaminA: nutrition.vitaminA ? nutrition.vitaminA / servings : undefined,
      vitaminC: nutrition.vitaminC ? nutrition.vitaminC / servings : undefined,
      calcium: nutrition.calcium ? nutrition.calcium / servings : undefined,
      iron: nutrition.iron ? nutrition.iron / servings : undefined
    };

    return this.roundNutrition(divided);
  }

  /**
   * Round nutrition values to appropriate decimal places
   */
  private roundNutrition(nutrition: NutritionData): NutritionData {
    return {
      calories: Math.round(nutrition.calories),
      protein: Math.round(nutrition.protein * 10) / 10,
      carbs: Math.round(nutrition.carbs * 10) / 10,
      fat: Math.round(nutrition.fat * 10) / 10,
      fiber: Math.round(nutrition.fiber * 10) / 10,
      sugar: Math.round(nutrition.sugar * 10) / 10,
      sodium: Math.round(nutrition.sodium),
      cholesterol: Math.round(nutrition.cholesterol),
      saturatedFat: Math.round(nutrition.saturatedFat * 10) / 10,
      transFat: Math.round(nutrition.transFat * 10) / 10,
      vitaminA: nutrition.vitaminA ? Math.round(nutrition.vitaminA) : undefined,
      vitaminC: nutrition.vitaminC ? Math.round(nutrition.vitaminC * 10) / 10 : undefined,
      calcium: nutrition.calcium ? Math.round(nutrition.calcium) : undefined,
      iron: nutrition.iron ? Math.round(nutrition.iron * 10) / 10 : undefined
    };
  }


  /**
   * Format nutrition data as a readable string
   */
  formatNutritionSummary(nutrition: NutritionData): string {
    const lines = [
      `Calories: ${nutrition.calories}`,
      `Protein: ${nutrition.protein}g`,
      `Carbs: ${nutrition.carbs}g`,
      `Fat: ${nutrition.fat}g`,
      `Fiber: ${nutrition.fiber}g`,
      `Sugar: ${nutrition.sugar}g`,
      `Sodium: ${nutrition.sodium}mg`,
      `Cholesterol: ${nutrition.cholesterol}mg`
    ];

    if (nutrition.saturatedFat > 0) {
      lines.push(`Saturated Fat: ${nutrition.saturatedFat}g`);
    }
    if (nutrition.transFat > 0) {
      lines.push(`Trans Fat: ${nutrition.transFat}g`);
    }
    if (nutrition.vitaminA) {
      lines.push(`Vitamin A: ${nutrition.vitaminA}mcg`);
    }
    if (nutrition.vitaminC) {
      lines.push(`Vitamin C: ${nutrition.vitaminC}mg`);
    }
    if (nutrition.calcium) {
      lines.push(`Calcium: ${nutrition.calcium}mg`);
    }
    if (nutrition.iron) {
      lines.push(`Iron: ${nutrition.iron}mg`);
    }

    return lines.join('\n');
  }

  /**
   * Format complete recipe nutrition as HTML
   */
  formatNutritionHTML(recipeNutrition: RecipeNutrition): string {
    const perServing = recipeNutrition.perServing;
    
    return `
<div class="nutrition-facts">
  <h3>Nutrition Facts</h3>
  <p>Servings: ${recipeNutrition.servings}</p>
  <hr>
  <h4>Amount Per Serving</h4>
  <p><strong>Calories:</strong> ${perServing.calories}</p>
  <hr>
  <table>
    <tr>
      <td><strong>Total Fat</strong> ${perServing.fat}g</td>
      <td>${Math.round((perServing.fat / 65) * 100)}%</td>
    </tr>
    <tr>
      <td>&nbsp;&nbsp;Saturated Fat ${perServing.saturatedFat}g</td>
      <td>${Math.round((perServing.saturatedFat / 20) * 100)}%</td>
    </tr>
    <tr>
      <td>&nbsp;&nbsp;Trans Fat ${perServing.transFat}g</td>
      <td></td>
    </tr>
    <tr>
      <td><strong>Cholesterol</strong> ${perServing.cholesterol}mg</td>
      <td>${Math.round((perServing.cholesterol / 300) * 100)}%</td>
    </tr>
    <tr>
      <td><strong>Sodium</strong> ${perServing.sodium}mg</td>
      <td>${Math.round((perServing.sodium / 2300) * 100)}%</td>
    </tr>
    <tr>
      <td><strong>Total Carbohydrate</strong> ${perServing.carbs}g</td>
      <td>${Math.round((perServing.carbs / 275) * 100)}%</td>
    </tr>
    <tr>
      <td>&nbsp;&nbsp;Dietary Fiber ${perServing.fiber}g</td>
      <td>${Math.round((perServing.fiber / 28) * 100)}%</td>
    </tr>
    <tr>
      <td>&nbsp;&nbsp;Total Sugars ${perServing.sugar}g</td>
      <td></td>
    </tr>
    <tr>
      <td><strong>Protein</strong> ${perServing.protein}g</td>
      <td>${Math.round((perServing.protein / 50) * 100)}%</td>
    </tr>
  </table>
  <hr>
  <p>* Percent Daily Values are based on a 2,000 calorie diet.</p>
</div>`;
  }
}

// Export singleton instance
export const recipeNutritionCalculator = new RecipeNutritionCalculator();