/**
 * Predetermined Meal Library
 * 
 * Interface to access and manage user's saved cultural meals (the 10 comprehensive
 * cultural meals created by the user). Provides filtering, scoring, and management
 * of predetermined meals for intelligent integration into meal plans.
 */

import { db } from './db';
import { userSavedCulturalMeals } from '../shared/schema';
import { eq } from 'drizzle-orm';
import type { CulturalMeal } from './SmartCulturalMealSelector';

export interface SavedCulturalMealData {
  id: number;
  user_id: number;
  cuisine_name: string;
  meals_data: any; // JSON array of meal objects
  summary_data: any; // JSON object with common ingredients and techniques
  custom_name?: string;
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

export interface ExtractedMeal {
  id: string;
  name: string;
  description: string;
  culture: string;
  ingredients: string[];
  instructions: string[];
  nutrition: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  };
  cook_time_minutes: number;
  difficulty: number;
  authenticity_score: number;
  dietary_compatibility: string[];
  cultural_significance?: string;
  adaptation_notes?: string[];
  source_collection: string; // Which saved collection this came from
}

export interface MealFilterCriteria {
  culturalBackground?: string[];
  dietaryRestrictions: string[];
  maxCookTime?: number;
  maxDifficulty?: number;
  excludeRecentlyUsed?: boolean;
}

export class PredeterminedMealLibrary {
  private mealCache: Map<number, CulturalMeal[]> = new Map();
  private cacheExpiry: Map<number, number> = new Map();
  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

  /**
   * Load user's predetermined cultural meals from database
   */
  async loadUserCulturalMeals(userId: number): Promise<CulturalMeal[]> {
    console.log(`Loading cultural meals for user ${userId}`);

    // Check cache first
    if (this.isCacheValid(userId)) {
      const cachedMeals = this.mealCache.get(userId);
      if (cachedMeals) {
        console.log(`Using cached meals: ${cachedMeals.length} meals`);
        return cachedMeals;
      }
    }

    try {
      // Load from database
      const savedMealCollections = await db
        .select()
        .from(userSavedCulturalMeals)
        .where(eq(userSavedCulturalMeals.user_id, userId));

      console.log(`Found ${savedMealCollections.length} saved meal collections`);

      if (savedMealCollections.length === 0) {
        console.warn(`No saved cultural meals found for user ${userId}`);
        return [];
      }

      // Extract individual meals from collections
      const extractedMeals = this.extractMealsFromCollections(savedMealCollections);
      
      // Convert to CulturalMeal format
      const culturalMeals = extractedMeals.map(meal => this.convertToCulturalMeal(meal));

      // Cache the results
      this.mealCache.set(userId, culturalMeals);
      this.cacheExpiry.set(userId, Date.now() + this.CACHE_DURATION);

      console.log(`Loaded and cached ${culturalMeals.length} cultural meals`);
      return culturalMeals;

    } catch (error) {
      console.error('Error loading user cultural meals:', error);
      return [];
    }
  }

  /**
   * Get meals compatible with user's criteria
   */
  async getCompatibleMeals(
    userId: number,
    culturalBackground: string[],
    dietaryRestrictions: string[]
  ): Promise<CulturalMeal[]> {
    const allMeals = await this.loadUserCulturalMeals(userId);
    
    console.log(`Filtering ${allMeals.length} meals for compatibility`);
    console.log(`Cultural background: ${culturalBackground.join(', ')}`);
    console.log(`Dietary restrictions: ${dietaryRestrictions.join(', ')}`);

    const compatibleMeals = allMeals.filter(meal => {
      // Filter by cultural background (if specified)
      if (culturalBackground.length > 0) {
        const matchesCulture = culturalBackground.some(culture => 
          meal.culture.toLowerCase().includes(culture.toLowerCase()) ||
          culture.toLowerCase().includes(meal.culture.toLowerCase())
        );
        if (!matchesCulture) {
          return false;
        }
      }

      // Filter by dietary restrictions (100% mandatory compliance)
      if (!this.checkDietaryCompatibility(meal, dietaryRestrictions)) {
        return false;
      }

      return true;
    });

    console.log(`Found ${compatibleMeals.length} compatible meals`);
    return compatibleMeals;
  }

  /**
   * Get meals filtered by specific criteria
   */
  async getFilteredMeals(
    userId: number,
    criteria: MealFilterCriteria
  ): Promise<CulturalMeal[]> {
    let meals = await this.getCompatibleMeals(
      userId,
      criteria.culturalBackground || [],
      criteria.dietaryRestrictions
    );

    // Apply additional filters
    if (criteria.maxCookTime) {
      meals = meals.filter(meal => meal.cook_time_minutes <= criteria.maxCookTime!);
    }

    if (criteria.maxDifficulty) {
      meals = meals.filter(meal => meal.difficulty <= criteria.maxDifficulty!);
    }

    if (criteria.excludeRecentlyUsed) {
      meals = meals.filter(meal => !this.isRecentlyUsed(meal));
    }

    console.log(`Filtered to ${meals.length} meals meeting all criteria`);
    return meals;
  }

  /**
   * Get meal by ID from user's collection
   */
  async getMealById(userId: number, mealId: string): Promise<CulturalMeal | null> {
    const allMeals = await this.loadUserCulturalMeals(userId);
    return allMeals.find(meal => meal.id === mealId) || null;
  }

  /**
   * Get statistics about user's meal library
   */
  async getMealLibraryStats(userId: number): Promise<{
    total_meals: number;
    cuisines: string[];
    average_cook_time: number;
    difficulty_distribution: Record<string, number>;
    dietary_coverage: Record<string, number>;
  }> {
    const meals = await this.loadUserCulturalMeals(userId);
    
    const cuisines = [...new Set(meals.map(meal => meal.culture))];
    const averageCookTime = meals.reduce((sum, meal) => sum + meal.cook_time_minutes, 0) / meals.length;
    
    const difficultyDistribution: Record<string, number> = {};
    meals.forEach(meal => {
      const difficultyLevel = Math.floor(meal.difficulty);
      const key = `level_${difficultyLevel}`;
      difficultyDistribution[key] = (difficultyDistribution[key] || 0) + 1;
    });

    // Analyze dietary coverage
    const dietaryCoverage: Record<string, number> = {};
    const commonDiets = ['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'keto', 'paleo'];
    
    commonDiets.forEach(diet => {
      const compatibleCount = meals.filter(meal => 
        this.checkDietaryCompatibility(meal, [diet])
      ).length;
      dietaryCoverage[diet] = Math.round((compatibleCount / meals.length) * 100);
    });

    return {
      total_meals: meals.length,
      cuisines,
      average_cook_time: Math.round(averageCookTime),
      difficulty_distribution: difficultyDistribution,
      dietary_coverage: dietaryCoverage
    };
  }

  /**
   * Update meal usage tracking
   */
  async updateMealUsage(userId: number, mealId: string, rating?: number): Promise<void> {
    const meals = this.mealCache.get(userId);
    if (!meals) return;

    const meal = meals.find(m => m.id === mealId);
    if (!meal) return;

    meal.usage_tracking.last_used = new Date();
    meal.usage_tracking.usage_count += 1;
    
    if (rating !== undefined) {
      meal.usage_tracking.user_rating = rating;
    }

    console.log(`Updated usage for meal ${meal.name}: count ${meal.usage_tracking.usage_count}`);
  }

  /**
   * Clear cache for user (force reload from database)
   */
  clearUserCache(userId: number): void {
    this.mealCache.delete(userId);
    this.cacheExpiry.delete(userId);
    console.log(`Cleared meal cache for user ${userId}`);
  }

  // Private helper methods

  private isCacheValid(userId: number): boolean {
    const expiry = this.cacheExpiry.get(userId);
    return expiry ? Date.now() < expiry : false;
  }

  private extractMealsFromCollections(collections: SavedCulturalMealData[]): ExtractedMeal[] {
    const extractedMeals: ExtractedMeal[] = [];

    collections.forEach(collection => {
      try {
        const mealsData = Array.isArray(collection.meals_data) 
          ? collection.meals_data 
          : [collection.meals_data];

        mealsData.forEach((mealData: any, index: number) => {
          // Handle different possible data structures
          const meal = this.normalizeMealData(mealData, collection, index);
          if (meal) {
            extractedMeals.push(meal);
          }
        });
      } catch (error) {
        console.error(`Error extracting meals from collection ${collection.cuisine_name}:`, error);
      }
    });

    return extractedMeals;
  }

  private normalizeMealData(
    mealData: any, 
    collection: SavedCulturalMealData, 
    index: number
  ): ExtractedMeal | null {
    try {
      // Generate unique ID
      const id = `${collection.cuisine_name}_${collection.id}_${index}`;

      // Extract meal properties with fallbacks
      const name = mealData.name || mealData.title || `${collection.cuisine_name} Meal ${index + 1}`;
      const description = mealData.description || mealData.summary || '';
      const ingredients = Array.isArray(mealData.ingredients) ? mealData.ingredients : [];
      const instructions = Array.isArray(mealData.instructions) ? mealData.instructions : [];

      // Extract nutrition with defaults
      const nutrition = {
        calories: mealData.nutrition?.calories || mealData.calories || 400,
        protein_g: mealData.nutrition?.protein_g || mealData.protein || 20,
        carbs_g: mealData.nutrition?.carbs_g || mealData.carbs || 30,
        fat_g: mealData.nutrition?.fat_g || mealData.fat || 15
      };

      // Extract timing and difficulty
      const cook_time_minutes = mealData.cook_time_minutes || mealData.cookTime || mealData.time || 30;
      const difficulty = mealData.difficulty || mealData.difficulty_level || 2.5;

      // Extract cultural metadata
      const authenticity_score = mealData.authenticity_score || 0.8;
      const dietary_compatibility = Array.isArray(mealData.dietary_compatibility) 
        ? mealData.dietary_compatibility 
        : [];
      
      const cultural_significance = mealData.cultural_significance || mealData.significance;
      const adaptation_notes = Array.isArray(mealData.adaptation_notes) 
        ? mealData.adaptation_notes 
        : [];

      return {
        id,
        name,
        description,
        culture: collection.cuisine_name,
        ingredients,
        instructions,
        nutrition,
        cook_time_minutes,
        difficulty,
        authenticity_score,
        dietary_compatibility,
        cultural_significance,
        adaptation_notes,
        source_collection: collection.custom_name || collection.cuisine_name
      };
    } catch (error) {
      console.error('Error normalizing meal data:', error);
      return null;
    }
  }

  private convertToCulturalMeal(extractedMeal: ExtractedMeal): CulturalMeal {
    return {
      id: extractedMeal.id,
      name: extractedMeal.name,
      description: extractedMeal.description,
      culture: extractedMeal.culture,
      ingredients: extractedMeal.ingredients,
      instructions: extractedMeal.instructions,
      nutrition: extractedMeal.nutrition,
      cook_time_minutes: extractedMeal.cook_time_minutes,
      difficulty: extractedMeal.difficulty,
      authenticity_score: extractedMeal.authenticity_score,
      dietary_compatibility: extractedMeal.dietary_compatibility,
      cultural_significance: extractedMeal.cultural_significance,
      adaptation_notes: extractedMeal.adaptation_notes,
      usage_tracking: {
        last_used: null,
        usage_count: 0,
        user_rating: undefined
      }
    };
  }

  private checkDietaryCompatibility(meal: CulturalMeal, restrictions: string[]): boolean {
    if (restrictions.length === 0) return true;

    // Check each restriction
    for (const restriction of restrictions) {
      if (!this.isMealCompatibleWithRestriction(meal, restriction)) {
        console.log(`Meal ${meal.name} not compatible with ${restriction}`);
        return false;
      }
    }

    return true;
  }

  private isMealCompatibleWithRestriction(meal: CulturalMeal, restriction: string): boolean {
    const restrictionLower = restriction.toLowerCase();
    
    // Check if meal explicitly supports this restriction
    if (meal.dietary_compatibility.some(compat => 
      compat.toLowerCase().includes(restrictionLower)
    )) {
      return true;
    }

    // Check ingredients for common incompatibilities
    const ingredientText = meal.ingredients.join(' ').toLowerCase();
    const instructionText = meal.instructions.join(' ').toLowerCase();
    const allText = `${ingredientText} ${instructionText}`;

    switch (restrictionLower) {
      case 'vegetarian':
        return !this.containsMeat(allText);
      
      case 'vegan':
        return !this.containsMeat(allText) && !this.containsDairy(allText) && !this.containsEggs(allText);
      
      case 'gluten-free':
        return !this.containsGluten(allText);
      
      case 'dairy-free':
        return !this.containsDairy(allText);
      
      case 'nut-free':
        return !this.containsNuts(allText);
      
      case 'keto':
        // Simple heuristic: low carb content
        return meal.nutrition.carbs_g < 20;
      
      case 'low-sodium':
        // Check for high-sodium ingredients
        return !this.containsHighSodium(allText);
      
      default:
        // For unknown restrictions, assume compatible unless explicitly marked
        return true;
    }
  }

  // Dietary restriction checking helpers
  private containsMeat(text: string): boolean {
    const meatKeywords = ['beef', 'pork', 'chicken', 'turkey', 'lamb', 'fish', 'salmon', 'tuna', 'shrimp', 'meat', 'bacon', 'ham', 'sausage'];
    return meatKeywords.some(keyword => text.includes(keyword));
  }

  private containsDairy(text: string): boolean {
    const dairyKeywords = ['milk', 'cheese', 'butter', 'cream', 'yogurt', 'dairy', 'cheddar', 'mozzarella', 'parmesan'];
    return dairyKeywords.some(keyword => text.includes(keyword));
  }

  private containsEggs(text: string): boolean {
    return text.includes('egg');
  }

  private containsGluten(text: string): boolean {
    const glutenKeywords = ['wheat', 'flour', 'bread', 'pasta', 'noodles', 'barley', 'rye', 'gluten'];
    return glutenKeywords.some(keyword => text.includes(keyword));
  }

  private containsNuts(text: string): boolean {
    const nutKeywords = ['almond', 'peanut', 'walnut', 'cashew', 'pistachio', 'hazelnut', 'pecan', 'nuts'];
    return nutKeywords.some(keyword => text.includes(keyword));
  }

  private containsHighSodium(text: string): boolean {
    const highSodiumKeywords = ['soy sauce', 'salt', 'sodium', 'canned', 'processed', 'pickle', 'olives'];
    return highSodiumKeywords.some(keyword => text.includes(keyword));
  }

  private isRecentlyUsed(meal: CulturalMeal): boolean {
    if (!meal.usage_tracking.last_used) {
      return false;
    }
    
    const daysSinceUsed = (Date.now() - meal.usage_tracking.last_used.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceUsed < 14; // Consider recent if used within 2 weeks
  }
}