/**
 * Enhanced Cultural Meal Ranking Engine
 * Uses cached cultural meal data with intelligent weight-based scoring and Llama 3 8B ranking
 */

import { getCachedCulturalCuisine, CulturalCuisineData } from './cultureCacheManager.js';

export interface StructuredMeal {
  id: string;
  name: string;
  cuisine: string;
  sub_cuisine?: string;
  description: string;
  
  // Core scoring attributes (0-1 scale)
  authenticity_score: number;
  health_score: number;
  cost_score: number;
  time_score: number;
  
  // Metadata
  cooking_techniques: string[];
  ingredients: string[];
  healthy_modifications: string[];
  estimated_prep_time: number;
  estimated_cook_time: number;
  difficulty_level: number;
  
  // Dietary compliance
  dietary_tags: string[];
  egg_free: boolean;
  vegetarian: boolean;
  vegan: boolean;
  gluten_free: boolean;
  dairy_free: boolean;
  
  // Source data
  source_quality: number;
  cache_data: any;
}

export interface UserCulturalProfile {
  cultural_preferences: { [cuisine: string]: number }; // e.g., { "Chinese": 0.9, "Sichuan": 0.8 }
  priority_weights: {
    cultural: number;
    health: number;
    cost: number;
    time: number;
    variety: number;
  };
  dietary_restrictions: string[];
  preferences: string[];
}

export interface MealScore {
  meal: StructuredMeal;
  total_score: number;
  component_scores: {
    cultural_score: number;
    health_score: number;
    cost_score: number;
    time_score: number;
  };
  ranking_explanation: string;
}

export class CulturalMealRankingEngine {
  private structuredMeals: StructuredMeal[] = [];
  private lastCacheUpdate: number = 0;
  private cachedCultures: string[] = [];
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    console.log('🎯 Cultural Meal Ranking Engine initialized');
  }

  /**
   * Convert cached cultural cuisine data to structured meal format
   */
  private async buildStructuredMealDatabase(userId: number, cultures: string[]): Promise<StructuredMeal[]> {
    console.log(`📚 Building structured meal database for cultures: ${cultures.join(', ')}`);
    
    const culturalData = await getCachedCulturalCuisine(userId, cultures, { useBatch: true, forceRefresh: true });
    console.log(`📊 Cultural data keys received: ${culturalData ? Object.keys(culturalData).join(', ') : 'null'}`);
    
    if (!culturalData) {
      console.log('❌ No cultural data available');
      return [];
    }

    const structuredMeals: StructuredMeal[] = [];
    let mealCounter = 0;

    for (const [cuisine, cultureData] of Object.entries(culturalData)) {
      console.log(`🍽️ Processing ${cultureData.meals?.length || 0} meals from ${cuisine}`);
      
      if (!cultureData.meals) continue;

      for (const meal of cultureData.meals) {
        const structuredMeal: StructuredMeal = {
          id: `${cuisine.toLowerCase()}_${++mealCounter}`,
          name: meal.name,
          cuisine: cuisine,
          description: meal.description || '',
          
          // Calculate core scores from cached data
          authenticity_score: this.calculateAuthenticityScore(meal, cultureData),
          health_score: this.calculateHealthScore(meal),
          cost_score: this.calculateCostScore(meal),
          time_score: this.calculateTimeScore(meal),
          
          // Extract metadata
          cooking_techniques: meal.cooking_techniques || this.extractCookingTechniques(meal.description),
          ingredients: meal.full_ingredients || meal.healthy_ingredients || [],
          healthy_modifications: meal.healthy_modifications || [],
          estimated_prep_time: this.estimatePrepTime(meal),
          estimated_cook_time: this.estimateCookTime(meal),
          difficulty_level: this.estimateDifficulty(meal),
          
          // Dietary compliance analysis
          dietary_tags: this.analyzeDietaryTags(meal),
          egg_free: this.isEggFree(meal),
          vegetarian: this.isVegetarian(meal),
          vegan: this.isVegan(meal),
          gluten_free: this.isGlutenFree(meal),
          dairy_free: this.isDairyFree(meal),
          
          // Source metadata
          source_quality: cultureData.source_quality_score || 0.8,
          cache_data: cultureData
        };

        structuredMeals.push(structuredMeal);
      }
    }

    console.log(`✅ Built structured database with ${structuredMeals.length} meals`);
    return structuredMeals;
  }

  /**
   * Score a meal based on user's cultural profile and weights
   */
  public scoreMeal(meal: StructuredMeal, userProfile: UserCulturalProfile): MealScore {
    // Calculate cultural score based on user's cultural preferences
    const culturalPreference = userProfile.cultural_preferences[meal.cuisine] || 0.5;
    const cultural_score = culturalPreference * meal.authenticity_score;

    // Component scores
    const component_scores = {
      cultural_score,
      health_score: meal.health_score,
      cost_score: meal.cost_score,
      time_score: meal.time_score
    };

    // Simple average of weighted component scores
    const total_score = (
      userProfile.priority_weights.cultural * cultural_score +
      userProfile.priority_weights.health * meal.health_score +
      userProfile.priority_weights.cost * meal.cost_score +
      userProfile.priority_weights.time * meal.time_score
    ) / (userProfile.priority_weights.cultural + userProfile.priority_weights.health + 
         userProfile.priority_weights.cost + userProfile.priority_weights.time);

    // Generate ranking explanation
    const ranking_explanation = this.generateRankingExplanation(meal, component_scores, userProfile);

    return {
      meal,
      total_score,
      component_scores,
      ranking_explanation
    };
  }

  /**
   * Get top-ranked meals for a user with dietary filtering
   */
  public async getRankedMeals(
    userId: number, 
    userProfile: UserCulturalProfile, 
    limit: number = 20,
    relevanceThreshold: number = 0.8
  ): Promise<MealScore[]> {
    
    // Rebuild structured meal database if needed
    const cultures = Object.keys(userProfile.cultural_preferences);
    console.log(`🎯 Requested cultures: ${cultures.join(', ')}`);
    console.log(`📊 Current cache has ${this.structuredMeals.length} meals`);
    console.log(`⏰ Cache age: ${Date.now() - this.lastCacheUpdate}ms (TTL: ${this.CACHE_TTL}ms)`);
    
    // Force refresh for different cultures
    const culturesDifferent = JSON.stringify(cultures.sort()) !== JSON.stringify(this.cachedCultures.sort());
    
    if (this.structuredMeals.length === 0 || 
        Date.now() - this.lastCacheUpdate > this.CACHE_TTL ||
        culturesDifferent) {
      console.log(`🔄 Refreshing meal database. Cultures different: ${culturesDifferent}`);
      console.log(`🧹 Clearing old cache of ${this.structuredMeals.length} meals`);
      this.structuredMeals = []; // Clear cache first
      this.structuredMeals = await this.buildStructuredMealDatabase(userId, cultures);
      this.cachedCultures = [...cultures]; // Store cached cultures
      this.lastCacheUpdate = Date.now();
      console.log(`✅ New cache built with ${this.structuredMeals.length} meals for ${cultures.join(', ')}`);
    }

    console.log(`🔍 Ranking ${this.structuredMeals.length} meals for user preferences`);

    // Filter meals by dietary restrictions
    const filteredMeals = this.structuredMeals.filter(meal => 
      this.meetsDietaryRestrictions(meal, userProfile.dietary_restrictions)
    );

    console.log(`✅ ${filteredMeals.length} meals after dietary filtering`);

    // Score all filtered meals
    const scoredMeals = filteredMeals.map(meal => this.scoreMeal(meal, userProfile));

    // Sort by total score
    scoredMeals.sort((a, b) => b.total_score - a.total_score);

    // Apply relevance threshold (only keep meals within X% of top score)
    const maxScore = scoredMeals[0]?.total_score || 0;
    const relevantMeals = scoredMeals.filter(meal => 
      meal.total_score >= relevanceThreshold * maxScore
    );

    console.log(`🎯 ${relevantMeals.length} meals within relevance threshold (${relevanceThreshold})`);

    return relevantMeals.slice(0, limit);
  }

  // Helper methods for scoring
  private calculateAuthenticityScore(meal: any, cultureData: CulturalCuisineData): number {
    // Base authenticity from description analysis
    let score = 0.7;
    
    // Boost for traditional ingredients
    if (cultureData.summary?.common_healthy_ingredients) {
      const traditionalIngredients = cultureData.summary.common_healthy_ingredients.filter(ingredient =>
        meal.description?.toLowerCase().includes(ingredient.toLowerCase()) ||
        meal.name?.toLowerCase().includes(ingredient.toLowerCase())
      );
      score += Math.min(traditionalIngredients.length * 0.1, 0.3);
    }
    
    return Math.min(score, 1.0);
  }

  private calculateHealthScore(meal: any): number {
    // Dynamic health scoring based on meal characteristics
    let score = 0.4; // Lower base score for more variation
    
    const description = meal.description?.toLowerCase() || '';
    const name = meal.name?.toLowerCase() || '';
    
    // Health boosts based on cooking methods
    if (description.includes('steamed') || description.includes('grilled')) score += 0.3;
    if (description.includes('fried') || description.includes('deep-fried')) score -= 0.2;
    if (description.includes('boiled') || description.includes('poached')) score += 0.2;
    
    // Ingredient-based scoring
    if (description.includes('vegetable') || description.includes('tofu')) score += 0.2;
    if (description.includes('lean') || description.includes('fish')) score += 0.25;
    if (description.includes('oil') || description.includes('butter')) score -= 0.1;
    if (description.includes('cream') || description.includes('cheese')) score -= 0.15;
    
    // Dish type considerations
    if (name.includes('soup') || name.includes('salad')) score += 0.2;
    if (name.includes('dumpling') || name.includes('roll')) score += 0.1;
    if (name.includes('duck') || name.includes('pork')) score -= 0.1;
    
    return Math.max(0.3, Math.min(score, 1.0)); // Ensure range 0.3-1.0
  }

  private calculateCostScore(meal: any): number {
    // Dynamic cost scoring based on ingredients and cooking complexity
    let score = 0.7; // Base cost score
    
    const description = meal.description?.toLowerCase() || '';
    const name = meal.name?.toLowerCase() || '';
    
    // Expensive ingredients
    if (description.includes('duck') || description.includes('beef')) score -= 0.2;
    if (description.includes('saffron') || description.includes('truffle')) score -= 0.3;
    if (description.includes('wine') || description.includes('cream')) score -= 0.1;
    if (description.includes('seafood') || description.includes('fish')) score -= 0.15;
    
    // Affordable ingredients
    if (description.includes('tofu') || description.includes('bean')) score += 0.2;
    if (description.includes('noodle') || description.includes('rice')) score += 0.15;
    if (description.includes('vegetable') || description.includes('cabbage')) score += 0.1;
    if (description.includes('egg') || description.includes('chicken')) score += 0.1;
    
    // Simple cooking methods = lower cost
    if (description.includes('stir-fry') || description.includes('steamed')) score += 0.1;
    if (description.includes('soup') || description.includes('boiled')) score += 0.15;
    
    // Complex preparations = higher cost
    if (description.includes('stuffed') || description.includes('marinated')) score -= 0.1;
    if (description.includes('slow-cooked') || description.includes('braised')) score -= 0.05;
    
    return Math.max(0.3, Math.min(score, 1.0)); // Ensure range 0.3-1.0
  }

  private calculateTimeScore(meal: any): number {
    // Dynamic time scoring based on cooking methods and complexity
    let score = 0.5; // Base time score
    
    const description = meal.description?.toLowerCase() || '';
    const name = meal.name?.toLowerCase() || '';
    
    // Fast cooking methods
    if (description.includes('stir-fry') || description.includes('stir-fried')) score += 0.4;
    if (description.includes('steamed') && !description.includes('slow')) score += 0.3;
    if (description.includes('grilled') || description.includes('sautéed')) score += 0.3;
    if (description.includes('boiled') || description.includes('poached')) score += 0.2;
    
    // Slow cooking methods
    if (description.includes('braised') || description.includes('slow-cook')) score -= 0.3;
    if (description.includes('roasted') || description.includes('baked')) score -= 0.2;
    if (description.includes('marinated') || description.includes('cured')) score -= 0.4;
    if (description.includes('stuffed') || description.includes('layered')) score -= 0.2;
    
    // Dish complexity indicators
    if (name.includes('soup') || name.includes('noodle')) score += 0.1;
    if (name.includes('dumpling') || name.includes('spring roll')) score += 0.1;
    if (name.includes('duck') || name.includes('whole')) score -= 0.3;
    if (name.includes('risotto') || name.includes('lasagne')) score -= 0.2;
    
    // Preparation complexity
    if (description.includes('homemade') || description.includes('fresh pasta')) score -= 0.1;
    if (description.includes('sauce') && description.includes('from scratch')) score -= 0.15;
    
    return Math.max(0.2, Math.min(score, 1.0)); // Ensure range 0.2-1.0
  }

  private extractCookingTechniques(description: string): string[] {
    const techniques = [];
    const text = description.toLowerCase();
    
    const techniqueKeywords = [
      'stir-fry', 'steam', 'boil', 'saute', 'grill', 'roast', 'braise', 
      'fry', 'bake', 'simmer', 'poach', 'blanch'
    ];
    
    for (const technique of techniqueKeywords) {
      if (text.includes(technique)) {
        techniques.push(technique);
      }
    }
    
    return techniques.length > 0 ? techniques : ['saute']; // Default technique
  }

  private estimatePrepTime(meal: any): number {
    const ingredientCount = meal.full_ingredients?.length || 5;
    return Math.min(ingredientCount * 2, 20); // 2 minutes per ingredient, max 20 min
  }

  private estimateCookTime(meal: any): number {
    const techniques = meal.cooking_techniques || this.extractCookingTechniques(meal.description);
    
    if (techniques.includes('stir-fry')) return 10;
    if (techniques.includes('steam')) return 15;
    if (techniques.includes('saute')) return 12;
    if (techniques.includes('braise')) return 45;
    if (techniques.includes('roast')) return 30;
    
    return 20; // Default cook time
  }

  private estimateDifficulty(meal: any): number {
    const techniques = meal.cooking_techniques || this.extractCookingTechniques(meal.description);
    const ingredientCount = meal.full_ingredients?.length || 5;
    
    let difficulty = 2; // Base difficulty
    
    if (techniques.includes('braise') || techniques.includes('roast')) difficulty += 1;
    if (ingredientCount > 10) difficulty += 0.5;
    if (meal.healthy_modifications && meal.healthy_modifications.length > 2) difficulty += 0.5;
    
    return Math.min(difficulty, 5);
  }

  private analyzeDietaryTags(meal: any): string[] {
    const tags = [];
    const text = `${meal.name} ${meal.description}`.toLowerCase();
    
    if (this.isVegetarian(meal)) tags.push('vegetarian');
    if (this.isVegan(meal)) tags.push('vegan');
    if (this.isGlutenFree(meal)) tags.push('gluten-free');
    if (this.isDairyFree(meal)) tags.push('dairy-free');
    if (this.isEggFree(meal)) tags.push('egg-free');
    
    return tags;
  }

  private isEggFree(meal: any): boolean {
    const text = `${meal.name} ${meal.description} ${meal.full_ingredients?.join(' ') || ''}`.toLowerCase();
    const eggKeywords = ['egg', 'eggs', 'mayonnaise', 'mayo'];
    return !eggKeywords.some(keyword => text.includes(keyword));
  }

  private isVegetarian(meal: any): boolean {
    const text = `${meal.name} ${meal.description} ${meal.full_ingredients?.join(' ') || ''}`.toLowerCase();
    const meatKeywords = ['chicken', 'beef', 'pork', 'fish', 'meat', 'lamb', 'turkey'];
    return !meatKeywords.some(keyword => text.includes(keyword));
  }

  private isVegan(meal: any): boolean {
    if (!this.isVegetarian(meal)) return false;
    
    const text = `${meal.name} ${meal.description} ${meal.full_ingredients?.join(' ') || ''}`.toLowerCase();
    const animalProducts = ['dairy', 'milk', 'cheese', 'butter', 'cream', 'yogurt', 'honey'];
    return !animalProducts.some(product => text.includes(product));
  }

  private isGlutenFree(meal: any): boolean {
    const text = `${meal.name} ${meal.description} ${meal.full_ingredients?.join(' ') || ''}`.toLowerCase();
    const glutenKeywords = ['wheat', 'flour', 'bread', 'pasta', 'noodles', 'soy sauce'];
    return !glutenKeywords.some(keyword => text.includes(keyword));
  }

  private isDairyFree(meal: any): boolean {
    const text = `${meal.name} ${meal.description} ${meal.full_ingredients?.join(' ') || ''}`.toLowerCase();
    const dairyKeywords = ['milk', 'cheese', 'butter', 'cream', 'yogurt', 'dairy'];
    return !dairyKeywords.some(keyword => text.includes(keyword));
  }

  private meetsDietaryRestrictions(meal: StructuredMeal, restrictions: string[]): boolean {
    for (const restriction of restrictions) {
      const lowerRestriction = restriction.toLowerCase();
      
      if (lowerRestriction.includes('egg') && !meal.egg_free) return false;
      if (lowerRestriction.includes('dairy') && !meal.dairy_free) return false;
      if (lowerRestriction.includes('gluten') && !meal.gluten_free) return false;
      if (lowerRestriction.includes('vegetarian') && !meal.vegetarian) return false;
      if (lowerRestriction.includes('vegan') && !meal.vegan) return false;
    }
    
    return true;
  }

  private generateRankingExplanation(
    meal: StructuredMeal, 
    scores: any, 
    userProfile: UserCulturalProfile
  ): string {
    const explanations = [];
    
    if (scores.cultural_score > 0.8) {
      explanations.push(`High cultural match (${(scores.cultural_score * 100).toFixed(0)}%)`);
    }
    
    if (meal.authenticity_score > 0.8) {
      explanations.push(`Authentic ${meal.cuisine} recipe`);
    }
    
    if (scores.health_score > 0.7) {
      explanations.push(`Good health score`);
    }
    
    if (scores.cost_score > 0.7) {
      explanations.push(`Cost-efficient ingredients`);
    }
    
    if (scores.time_score > 0.7) {
      explanations.push(`Quick preparation`);
    }
    
    return explanations.join(', ') || 'Balanced meal option';
  }
}

// Export singleton instance
export const culturalMealRankingEngine = new CulturalMealRankingEngine();