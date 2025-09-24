
/**
 * API Utilities for our application
 * Handles server requests for various features
 */
import { apiRequest, safeApiRequest } from "./queryClient";

/**
 * Enhanced recipe enhancement that uses stored video data from backend
 * No longer makes additional YouTube API calls from frontend
 * @param recipe Recipe object with title and ingredients
 * @returns Recipe data with video details if available
 */
export const enhanceRecipeWithVideo = async (recipe: any) => {
  // console.log("Checking recipe video data");
  // console.log("Recipe video_id:", recipe.video_id);
  // console.log("Recipe video_title:", recipe.video_title);

  // Simply return the recipe with whatever video data it already has
  // The backend should have already captured video information during generation
  return {
    ...recipe,
    video_id: recipe.video_id || null,
    video_title: recipe.video_title || null,
    video_channel: recipe.video_channel || null,
    transcript_ingredients: recipe.transcript_ingredients || []
  };
};

/**
 * Generate a new recipe using the server API
 * @param data Recipe generation parameters
 * @param mode Generation mode: "fast" or "detailed"
 * @returns Promise with generated recipe
 */
export const generateRecipe = async (data: any, mode: string = "detailed") => {
  // console.log("Generating recipe with mode:", mode);
  return apiRequest("/api/recipes/generate", {
    method: "POST",
    body: JSON.stringify({ ...data, mode })
  });
};

/**
 * Search for food nutrition data using USDA API
 * @param foodName Name of the food to search for
 * @returns Nutrition data from USDA API
 */
export const searchFoodNutrition = async (foodName: string) => {
  return apiRequest(`/api/nutrition/search?food=${encodeURIComponent(foodName)}`);
};

/**
 * Get nutrition details for a specific food item
 * @param fdcId Food Data Central ID
 * @returns Detailed nutrition information
 */
export const getFoodNutrition = async (fdcId: string) => {
  return apiRequest(`/api/nutrition/food/${fdcId}`);
};

/**
 * Save a recipe to user's saved list
 * @param recipeId ID of the recipe to save
 * @returns Updated recipe data
 */
export const saveRecipe = async (recipeId: number) => {
  return await safeApiRequest(`/api/recipes/${recipeId}/save`, {
    method: "POST"
  });
};

/**
 * Remove a recipe from user's saved list
 * @param recipeId ID of the recipe to unsave
 * @returns Success confirmation
 */
export const unsaveRecipe = async (recipeId: number) => {
  return await safeApiRequest(`/api/recipes/${recipeId}/save`, {
    method: "DELETE"
  });
};

/**
 * Create Instacart shopping list from recipe
 * @param recipeId ID of the recipe
 * @returns Instacart shopping page URL
 */
export const createInstacartShoppingList = async (recipeId: number) => {
  return apiRequest(`/api/recipes/${recipeId}/instacart`, {
    method: "POST"
  });
};
