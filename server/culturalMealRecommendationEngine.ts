/**
 * Enhanced Cultural Meal Recommendation Engine
 * Leverages improved caching, NLP parsing, and masterlist data for intelligent recommendations
 */

import { getCachedCulturalCuisine, CulturalCuisineData } from './cultureCacheManager.js';
import { nlpCultureParser, CultureParserResult } from './nlpCultureParser.js';
import { loadMasterlist } from './cuisineMasterlistMigration.js';

export interface CulturalRecommendationRequest {
  userId: number;
  culturalInput?: string; // Natural language cultural preferences
  explicitCultures?: string[]; // Explicitly selected cultures
  dietaryRestrictions?: string[];
  nutritionGoal?: string;
  difficulty?: number; // 1-5 scale
  cookTime?: number; // max minutes
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  familySize?: number;
  ingredientPreferences?: string[];
  excludeIngredients?: string[];
  healthFocus?: 'weight_loss' | 'muscle_gain' | 'heart_health' | 'general_wellness';
  occasionType?: 'everyday' | 'special' | 'celebration' | 'comfort';
}

export interface CulturalMealRecommendation {
  meals: Array<{
    name: string;
    description: string;
    culture: string;
    authenticity_score: number;
    adaptation_notes?: string[];
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
    cultural_significance?: string;
    health_adaptations?: string[];
    serving_size: number;
  }>;
  cultural_context: {
    primary_cultures: string[];
    confidence_score: number;
    cultural_balance: { [culture: string]: number }; // Percentage distribution
    authenticity_notes: string[];
  };
  recommendation_metadata: {
    total_recommendations: number;
    processing_time_ms: number;
    cache_utilized: boolean;
    fallback_used: boolean;
    quality_score: number;
  };
}

interface CulturalMealContext {
  cultures: string[];
  confidence: number;
  culturalData: { [culture: string]: CulturalCuisineData };
  userPreferences: CulturalRecommendationRequest;
}

export class CulturalMealRecommendationEngine {
  private cacheTimeout = 30 * 60 * 1000; // 30 minutes
  private recommendationCache = new Map<string, { result: CulturalMealRecommendation; timestamp: number }>();

  async generateRecommendations(request: CulturalRecommendationRequest): Promise<CulturalMealRecommendation> {
    const startTime = Date.now();
    console.log(`🎯 Generating cultural meal recommendations for user ${request.userId}`);

    try {
      // Step 1: Parse cultural preferences and get context
      const context = await this.buildCulturalContext(request);
      
      // Step 2: Generate culturally-aware meal recommendations
      const recommendations = await this.generateCulturallyAwareMeals(context);
      
      // Step 3: Apply dietary filters and health adaptations
      const filteredRecommendations = await this.applyDietaryFilters(recommendations, request);
      
      // Step 4: Score and rank recommendations
      const rankedRecommendations = this.scoreAndRankRecommendations(filteredRecommendations, context);
      
      // Step 5: Build final response
      const result = this.buildRecommendationResponse(rankedRecommendations, context, startTime);
      
      console.log(`✅ Generated ${result.meals.length} cultural recommendations in ${Date.now() - startTime}ms`);
      return result;
      
    } catch (error) {
      console.error('🚨 Error generating cultural recommendations:', error);
      
      // Return fallback recommendations
      return this.generateFallbackRecommendations(request, startTime);
    }
  }

  private async buildCulturalContext(request: CulturalRecommendationRequest): Promise<CulturalMealContext> {
    let cultures: string[] = [];
    let confidence = 0;
    let fallbackUsed = false;

    // Parse natural language cultural input if provided
    if (request.culturalInput) {
      console.log(`🧠 Parsing cultural input: "${request.culturalInput}"`);
      const parseResult = await nlpCultureParser(request.culturalInput, { enableCaching: true });
      cultures = parseResult.cultureTags;
      confidence = parseResult.confidence;
      fallbackUsed = parseResult.fallbackUsed;
      
      console.log(`📊 NLP parsing result: ${cultures.join(', ')} (confidence: ${confidence})`);
    }

    // Use explicit cultures if provided
    if (request.explicitCultures && request.explicitCultures.length > 0) {
      cultures = [...new Set([...cultures, ...request.explicitCultures])];
      confidence = Math.max(confidence, 0.9); // High confidence for explicit selections
      console.log(`✅ Added explicit cultures: ${request.explicitCultures.join(', ')}`);
    }

    // Fallback to popular cuisines if no cultures identified
    if (cultures.length === 0) {
      cultures = await this.getPopularCuisines(request);
      confidence = 0.3; // Low confidence for fallback
      fallbackUsed = true;
      console.log(`🔄 Using fallback popular cuisines: ${cultures.join(', ')}`);
    }

    // Load cultural cuisine data
    console.log(`📚 Loading cultural data for: ${cultures.join(', ')}`);
    const culturalData = await getCachedCulturalCuisine(
      request.userId, 
      cultures,
      { useBatch: cultures.length > 2, forceRefresh: false }
    ) || {};

    return {
      cultures,
      confidence,
      culturalData,
      userPreferences: request
    };
  }

  private async generateCulturallyAwareMeals(context: CulturalMealContext): Promise<Array<any>> {
    const recommendations: Array<any> = [];
    
    for (const culture of context.cultures) {
      const cultureData = context.culturalData[culture];
      if (!cultureData || !cultureData.meals) {
        console.log(`⚠️ No data available for ${culture}, skipping`);
        continue;
      }

      console.log(`🍽️ Processing ${cultureData.meals.length} meals from ${culture} cuisine`);
      
      for (const meal of cultureData.meals) {
        // Create enhanced meal recommendation
        const recommendation = {
          name: meal.name,
          description: meal.description,
          culture: culture,
          authenticity_score: this.calculateAuthenticityScore(meal, cultureData),
          adaptation_notes: meal.healthy_mods || [],
          ingredients: this.extractIngredients(meal, cultureData),
          instructions: this.generateInstructions(meal, context),
          nutrition: meal.macros,
          cook_time_minutes: meal.estimated_cook_time || this.estimateCookTime(meal, context.userPreferences),
          difficulty: meal.difficulty_level || this.estimateDifficulty(meal, context.userPreferences),
          cultural_significance: this.getCulturalSignificance(meal, culture),
          health_adaptations: this.generateHealthAdaptations(meal, context.userPreferences),
          serving_size: context.userPreferences.familySize || 4
        };

        recommendations.push(recommendation);
      }
    }

    console.log(`📋 Generated ${recommendations.length} base recommendations`);
    return recommendations;
  }

  private async applyDietaryFilters(recommendations: Array<any>, request: CulturalRecommendationRequest): Promise<Array<any>> {
    let filteredRecommendations = [...recommendations];

    // Apply dietary restrictions
    if (request.dietaryRestrictions && request.dietaryRestrictions.length > 0) {
      console.log(`🚫 Applying dietary restrictions: ${request.dietaryRestrictions.join(', ')}`);
      
      filteredRecommendations = filteredRecommendations.filter(meal => {
        return this.meetsDietaryRestrictions(meal, request.dietaryRestrictions!);
      });
      
      console.log(`📊 ${filteredRecommendations.length} meals after dietary filtering`);
    }

    // Apply ingredient preferences and exclusions
    if (request.excludeIngredients && request.excludeIngredients.length > 0) {
      filteredRecommendations = filteredRecommendations.filter(meal => {
        return !request.excludeIngredients!.some(excluded =>
          meal.ingredients.some((ingredient: string) =>
            ingredient.toLowerCase().includes(excluded.toLowerCase())
          )
        );
      });
    }

    // Apply time and difficulty constraints
    if (request.cookTime) {
      filteredRecommendations = filteredRecommendations.filter(meal =>
        meal.cook_time_minutes <= request.cookTime!
      );
    }

    if (request.difficulty) {
      filteredRecommendations = filteredRecommendations.filter(meal =>
        meal.difficulty <= request.difficulty!
      );
    }

    // Apply nutrition goal adaptations
    if (request.nutritionGoal || request.healthFocus) {
      filteredRecommendations = filteredRecommendations.map(meal =>
        this.adaptMealForNutritionGoal(meal, request)
      );
    }

    console.log(`✅ Final filtered recommendations: ${filteredRecommendations.length} meals`);
    return filteredRecommendations;
  }

  private scoreAndRankRecommendations(recommendations: Array<any>, context: CulturalMealContext): Array<any> {
    console.log(`📊 Scoring and ranking ${recommendations.length} recommendations`);
    
    return recommendations
      .map(meal => ({
        ...meal,
        overall_score: this.calculateOverallScore(meal, context)
      }))
      .sort((a, b) => b.overall_score - a.overall_score)
      .slice(0, 12); // Return top 12 recommendations
  }

  private buildRecommendationResponse(
    recommendations: Array<any>, 
    context: CulturalMealContext, 
    startTime: number
  ): CulturalMealRecommendation {
    
    // Calculate cultural balance
    const culturalBalance: { [culture: string]: number } = {};
    const totalMeals = recommendations.length;
    
    context.cultures.forEach(culture => {
      const cultureCount = recommendations.filter(meal => meal.culture === culture).length;
      culturalBalance[culture] = totalMeals > 0 ? (cultureCount / totalMeals) * 100 : 0;
    });

    // Generate authenticity notes
    const authenticityNotes = this.generateAuthenticityNotes(recommendations, context);

    // Calculate overall quality score
    const qualityScore = this.calculateQualityScore(recommendations, context);

    return {
      meals: recommendations,
      cultural_context: {
        primary_cultures: context.cultures,
        confidence_score: context.confidence,
        cultural_balance: culturalBalance,
        authenticity_notes: authenticityNotes
      },
      recommendation_metadata: {
        total_recommendations: recommendations.length,
        processing_time_ms: Date.now() - startTime,
        cache_utilized: Object.keys(context.culturalData).length > 0,
        fallback_used: context.confidence < 0.5,
        quality_score: qualityScore
      }
    };
  }

  // Helper methods for scoring and analysis
  private calculateAuthenticityScore(meal: any, cultureData: CulturalCuisineData): number {
    let score = 0.7; // Base authenticity score
    
    // Boost score if meal uses traditional ingredients
    if (cultureData.key_ingredients) {
      const traditionalIngredients = cultureData.key_ingredients.filter(ingredient =>
        meal.description?.toLowerCase().includes(ingredient.toLowerCase()) ||
        meal.name?.toLowerCase().includes(ingredient.toLowerCase())
      );
      score += Math.min(traditionalIngredients.length * 0.1, 0.3);
    }
    
    return Math.min(score, 1.0);
  }

  private estimateCookTime(meal: any, preferences: CulturalRecommendationRequest): number {
    // Base estimate from meal complexity
    let baseTime = 30;
    
    if (preferences.cookTime && preferences.cookTime < 30) {
      baseTime = preferences.cookTime * 0.8;
    }
    
    // Adjust based on difficulty
    if (meal.difficulty_level) {
      baseTime += (meal.difficulty_level - 1) * 10;
    }
    
    return Math.round(baseTime);
  }

  private estimateDifficulty(meal: any, preferences: CulturalRecommendationRequest): number {
    let difficulty = 3; // Default medium difficulty
    
    // Adjust based on user preferences
    if (preferences.difficulty) {
      difficulty = Math.min(preferences.difficulty, difficulty);
    }
    
    return difficulty;
  }

  private calculateOverallScore(meal: any, context: CulturalMealContext): number {
    let score = 0;
    
    // Authenticity weight (30%)
    score += meal.authenticity_score * 0.3;
    
    // Health score (25%)
    const healthScore = this.calculateHealthScore(meal, context.userPreferences);
    score += healthScore * 0.25;
    
    // User preference alignment (25%)
    const preferenceScore = this.calculatePreferenceScore(meal, context.userPreferences);
    score += preferenceScore * 0.25;
    
    // Cultural confidence weight (20%)
    score += context.confidence * 0.2;
    
    return Math.round(score * 100) / 100;
  }

  private calculateHealthScore(meal: any, preferences: CulturalRecommendationRequest): number {
    let score = 0.5; // Base health score
    
    // Nutrition-based scoring
    if (meal.nutrition) {
      const { calories, protein_g } = meal.nutrition;
      
      // Reasonable calorie range for main meals
      if (calories >= 300 && calories <= 600) score += 0.2;
      
      // Good protein content
      if (protein_g >= 20) score += 0.2;
      
      // Health adaptations available
      if (meal.health_adaptations && meal.health_adaptations.length > 0) {
        score += 0.1;
      }
    }
    
    return Math.min(score, 1.0);
  }

  private calculatePreferenceScore(meal: any, preferences: CulturalRecommendationRequest): number {
    let score = 0.5; // Base preference score
    
    // Time constraints
    if (preferences.cookTime && meal.cook_time_minutes <= preferences.cookTime) {
      score += 0.3;
    }
    
    // Difficulty match
    if (preferences.difficulty && meal.difficulty <= preferences.difficulty) {
      score += 0.2;
    }
    
    return Math.min(score, 1.0);
  }

  private async generateFallbackRecommendations(
    request: CulturalRecommendationRequest, 
    startTime: number
  ): Promise<CulturalMealRecommendation> {
    console.log('🔄 Generating fallback recommendations');
    
    const fallbackMeals = [
      {
        name: "Quick Stir-Fry",
        description: "Simple vegetable and protein stir-fry",
        culture: "Asian-Inspired",
        authenticity_score: 0.6,
        ingredients: ["vegetables", "protein", "soy sauce", "garlic"],
        instructions: ["Heat oil", "Add ingredients", "Stir-fry for 8-10 minutes"],
        nutrition: { calories: 350, protein_g: 25, carbs_g: 20, fat_g: 15 },
        cook_time_minutes: 15,
        difficulty: 2,
        serving_size: 4
      }
    ];

    return {
      meals: fallbackMeals,
      cultural_context: {
        primary_cultures: ["International"],
        confidence_score: 0.3,
        cultural_balance: { "International": 100 },
        authenticity_notes: ["Fallback recommendations provided"]
      },
      recommendation_metadata: {
        total_recommendations: fallbackMeals.length,
        processing_time_ms: Date.now() - startTime,
        cache_utilized: false,
        fallback_used: true,
        quality_score: 0.4
      }
    };
  }

  // Additional helper methods (simplified implementations)
  private async getPopularCuisines(request: CulturalRecommendationRequest): Promise<string[]> {
    return ["Italian", "Mexican", "Chinese", "American"];
  }

  private extractIngredients(meal: any, cultureData: CulturalCuisineData): string[] {
    return cultureData.key_ingredients?.slice(0, 6) || ["ingredient1", "ingredient2"];
  }

  private generateInstructions(meal: any, context: CulturalMealContext): string[] {
    return ["Step 1: Prep ingredients", "Step 2: Cook according to method", "Step 3: Season and serve"];
  }

  private getCulturalSignificance(meal: any, culture: string): string {
    return `Traditional ${culture} dish with cultural importance`;
  }

  private generateHealthAdaptations(meal: any, preferences: CulturalRecommendationRequest): string[] {
    const adaptations = [];
    
    if (preferences.healthFocus === 'weight_loss') {
      adaptations.push("Reduce oil content", "Increase vegetables");
    }
    
    return adaptations;
  }

  private meetsDietaryRestrictions(meal: any, restrictions: string[]): boolean {
    // Simplified implementation - would need more sophisticated matching
    return true;
  }

  private adaptMealForNutritionGoal(meal: any, request: CulturalRecommendationRequest): any {
    // Return adapted meal based on nutrition goals
    return meal;
  }

  private generateAuthenticityNotes(recommendations: Array<any>, context: CulturalMealContext): string[] {
    const notes = [];
    
    const avgAuthenticity = recommendations.reduce((sum, meal) => sum + meal.authenticity_score, 0) / recommendations.length;
    
    if (avgAuthenticity > 0.8) {
      notes.push("High authenticity recommendations based on traditional recipes");
    } else if (avgAuthenticity > 0.6) {
      notes.push("Good balance of authenticity and modern adaptations");
    } else {
      notes.push("Modern interpretations of traditional cuisines");
    }
    
    return notes;
  }

  private calculateQualityScore(recommendations: Array<any>, context: CulturalMealContext): number {
    if (recommendations.length === 0) return 0;
    
    const avgScore = recommendations.reduce((sum, meal) => sum + (meal.overall_score || 0), 0) / recommendations.length;
    const cultureDataQuality = Object.values(context.culturalData).reduce((sum, data) => 
      sum + (data.source_quality_score || 0.5), 0) / Math.max(Object.keys(context.culturalData).length, 1);
    
    return Math.round(((avgScore + cultureDataQuality) / 2) * 100) / 100;
  }
}

// Export singleton instance
export const culturalMealRecommendationEngine = new CulturalMealRecommendationEngine();