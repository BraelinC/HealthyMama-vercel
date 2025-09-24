export interface RecipeGenerationParams {
  recipeType?: string;
  cuisine?: string;
  dietRestrictions?: string;
  cookingTime?: string;
  availableIngredients?: string;
  excludeIngredients?: string;
  description: string;
}

export const buildPromptFromParams = (params: RecipeGenerationParams): string => {
  let prompt = `Generate a detailed recipe with the following requirements:\n\n`;
  
  if (params.recipeType && params.recipeType !== "Any Type") {
    prompt += `Recipe Type: ${params.recipeType}\n`;
  }
  
  if (params.cuisine && params.cuisine !== "Any Cuisine") {
    prompt += `Cuisine: ${params.cuisine}\n`;
  }
  
  if (params.dietRestrictions && params.dietRestrictions !== "None") {
    prompt += `Dietary Restriction: ${params.dietRestrictions}\n`;
  }
  
  if (params.cookingTime) {
    prompt += `Cooking Time: Around ${params.cookingTime} minutes\n`;
  }
  
  if (params.availableIngredients) {
    prompt += `Use these ingredients: ${params.availableIngredients}\n`;
  }
  
  if (params.excludeIngredients) {
    prompt += `Exclude these ingredients: ${params.excludeIngredients}\n`;
  }
  
  prompt += `\nDescription: ${params.description}\n\n`;
  
  prompt += `Please format the response as a JSON object with the following structure:
  {
    "title": "Recipe Title",
    "description": "Brief description of the recipe",
    "time_minutes": total cooking time in minutes (number),
    "cuisine": "Cuisine type",
    "diet": "Diet type if applicable",
    "ingredients": [
      {
        "name": "ingredient name lowercase",
        "display_text": "Ingredient display name",
        "measurements": [
          {
            "quantity": amount as number,
            "unit": "unit of measurement"
          }
        ]
      }
    ],
    "instructions": [
      "Step 1 instruction",
      "Step 2 instruction"
    ],
    "image_url": "Include a placeholder URL for a food image"
  }`;
  
  return prompt;
};
