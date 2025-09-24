import Groq from "groq-sdk";
import { deduplicateIngredients, cleanIngredientList } from "./ingredientDeduplicator";

interface RecipeGenerationParams {
  recipeType?: string;
  cuisine?: string;
  dietRestrictions?: string;
  cookingTime?: string;
  availableIngredients?: string;
  excludeIngredients?: string;
  description: string;
}

// Mock image URLs for recipes (since we can't generate real images)
const mockRecipeImageUrls = [
  "https://images.unsplash.com/photo-1589227365533-cee630bd59bd?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&h=900",
  "https://images.unsplash.com/photo-1499125562588-29fb8a56b5d4?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&h=900",
  "https://images.unsplash.com/photo-1495521821757-a1efb6729352?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&h=900",
  "https://images.unsplash.com/photo-1473093226795-af9932fe5856?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&h=900",
  "https://images.unsplash.com/photo-1560684352-8497838a2229?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&h=900",
  "https://images.unsplash.com/photo-1547592180-85f173990554?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&h=900"
];

/**
 * Builds a prompt for the Grok AI to generate a recipe based on provided parameters
 */
function buildPromptFromParams(params: RecipeGenerationParams): string {
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
    ]
  }`;
  
  return prompt;
}

/**
 * Generate a recipe using the Grok API based on user preferences
 */
export async function generateRecipeWithGrok(params: RecipeGenerationParams) {
  const API_KEY = process.env.GROQ_API_KEY;
  if (!API_KEY) {
    throw new Error("GROQ_API_KEY is required. Set the GROQ_API_KEY environment variable.");
  }

  const groq = new Groq({ apiKey: API_KEY });
  const prompt = buildPromptFromParams(params);

  try {
    const response = await groq.chat.completions.create({
      model: "openai/gpt-oss-20b",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.4
    });

    const recipeContent = response.choices[0]?.message?.content;
    if (!recipeContent) {
      throw new Error("Empty response from Groq model");
    }

    // Parse the JSON response
    const recipeData = JSON.parse(recipeContent);

    // Keep ingredients as-is for now to avoid data loss
    if (recipeData.ingredients && Array.isArray(recipeData.ingredients)) {
      console.log(`Generated recipe with ${recipeData.ingredients.length} ingredients`);
    }

    // Generate a relevant image URL based on recipe type and name
    let imageCategory = recipeData.cuisine?.toLowerCase() || '';
    if (!imageCategory || imageCategory === 'any cuisine') {
      imageCategory = recipeData.diet?.toLowerCase() || recipeData.title.split(' ')[0].toLowerCase();
    }

    const recipeName = encodeURIComponent(recipeData.title.toLowerCase());
    recipeData.image_url = `https://source.unsplash.com/1200x900/?food,${recipeName},${imageCategory},cooking`;

    return recipeData;
  } catch (error: any) {
    console.error("Error generating recipe with Groq (via GROQ SDK):", error);
    throw new Error(`Failed to generate recipe: ${error.message}`);
  }
}
