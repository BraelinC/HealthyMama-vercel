/**
 * Recipe web scraping utility
 * Extracts recipe information from popular recipe websites
 */
import axios from 'axios';
import * as cheerio from 'cheerio';

export interface ScrapedRecipe {
  title: string;
  description?: string;
  sourceUrl: string;
  sourceName: string;
  ingredients: string[];
  instructions: string[];
  prepTime?: string;
  cookTime?: string;
  totalTime?: string;
  servings?: string;
  tags?: string[];
  rating?: number;
  image?: string;
  nutrition?: {
    calories?: string;
    fat?: string;
    carbs?: string;
    protein?: string;
    [key: string]: string | undefined;
  };
}

/**
 * Scrape recipe information from a website URL
 * @param url Website URL to scrape
 * @returns Parsed recipe data if successful
 */
export const scrapeRecipeFromUrl = async (url: string): Promise<ScrapedRecipe | null> => {
  try {
    // For demo purposes, since we can't make actual web requests to external sites
    // This would normally fetch the page HTML and use cheerio to parse it
    
    // Mock data for different website patterns
    if (url.includes('pinchofyum.com')) {
      return {
        title: "Life Changing Soft Scrambled Eggs",
        description: "These life-changing soft scrambled eggs only take 15 minutes to make and are the perfect addition to any breakfast or brunch!",
        sourceUrl: "https://pinchofyum.com/soft-scrambled-eggs",
        sourceName: "Pinch of Yum",
        ingredients: [
          "4 large eggs",
          "1/2 tablespoon butter",
          "1/4 teaspoon salt",
          "black pepper to taste",
          "fresh herbs (optional)"
        ],
        instructions: [
          "Crack eggs into a bowl and whisk until smooth.",
          "Heat a non-stick pan over medium-low heat and add butter.",
          "Once butter is melted, pour in eggs and stir constantly with a silicone spatula.",
          "Keep stirring gently as eggs form small curds, about 3-4 minutes.",
          "Remove from heat when eggs are still slightly wet but mostly set.",
          "Season with salt, pepper, and fresh herbs if desired. Serve immediately."
        ],
        prepTime: "2 minutes",
        cookTime: "3 minutes",
        totalTime: "5 minutes",
        servings: "2",
        tags: ["breakfast", "american", "quick", "eggs", "low-carb"],
        rating: 4.8,
        image: "https://pinchofyum.com/wp-content/uploads/Soft-Scrambled-Eggs-3.jpg",
        nutrition: {
          calories: "150",
          fat: "11g",
          carbs: "1g",
          protein: "13g"
        }
      };
    } 
    
    if (url.includes('allrecipes.com')) {
      return {
        title: "Best Chocolate Chip Cookies",
        description: "Crisp edges, chewy middles, and so easy to make!",
        sourceUrl: "https://www.allrecipes.com/recipe/10813/best-chocolate-chip-cookies/",
        sourceName: "Allrecipes",
        ingredients: [
          "1 cup butter, softened",
          "1 cup white sugar",
          "1 cup packed brown sugar",
          "2 eggs",
          "2 teaspoons vanilla extract",
          "1 teaspoon baking soda",
          "2 teaspoons hot water",
          "1/2 teaspoon salt",
          "3 cups all-purpose flour",
          "2 cups semisweet chocolate chips"
        ],
        instructions: [
          "Preheat oven to 350 degrees F (175 degrees C).",
          "Cream together the butter, white sugar, and brown sugar until smooth.",
          "Beat in the eggs one at a time, then stir in the vanilla.",
          "Dissolve baking soda in hot water. Add to batter along with salt.",
          "Stir in flour and chocolate chips.",
          "Drop by large spoonfuls onto ungreased pans.",
          "Bake for about 10 minutes or until edges are nicely browned."
        ],
        prepTime: "20 minutes",
        cookTime: "10 minutes",
        totalTime: "30 minutes",
        servings: "24 cookies",
        tags: ["dessert", "cookies", "baking", "chocolate"],
        rating: 4.7
      };
    }
    
    // Return null if we couldn't parse the recipe
    return null;
    
  } catch (error) {
    console.error('Error scraping recipe:', error);
    return null;
  }
};

/**
 * Search for a recipe by keyword and return the first matching result
 * In a real app, this would make an API call to a recipe search engine
 * @param keyword Search term
 * @returns Recipe data if found
 */
export const searchRecipeByKeyword = async (keyword: string): Promise<ScrapedRecipe | null> => {
  // For demo purposes, return a mock recipe based on the keyword
  if (keyword.toLowerCase().includes('egg')) {
    return {
      title: "Life Changing Soft Scrambled Eggs",
      description: "These life-changing soft scrambled eggs only take 15 minutes to make and are the perfect addition to any breakfast or brunch!",
      sourceUrl: "https://pinchofyum.com/soft-scrambled-eggs",
      sourceName: "Pinch of Yum",
      ingredients: [
        "4 large eggs",
        "1/2 tablespoon butter",
        "1/4 teaspoon salt",
        "black pepper to taste",
        "fresh herbs (optional)"
      ],
      instructions: [
        "Crack eggs into a bowl and whisk until smooth.",
        "Heat a non-stick pan over medium-low heat and add butter.",
        "Once butter is melted, pour in eggs and stir constantly with a silicone spatula.",
        "Keep stirring gently as eggs form small curds, about 3-4 minutes.",
        "Remove from heat when eggs are still slightly wet but mostly set.",
        "Season with salt, pepper, and fresh herbs if desired. Serve immediately."
      ],
      prepTime: "2 minutes",
      cookTime: "3 minutes",
      totalTime: "5 minutes",
      servings: "2",
      tags: ["breakfast", "american", "quick", "eggs", "low-carb"],
      rating: 4.8,
      image: "https://pinchofyum.com/wp-content/uploads/Soft-Scrambled-Eggs-3.jpg"
    };
  }
  
  return null;
};