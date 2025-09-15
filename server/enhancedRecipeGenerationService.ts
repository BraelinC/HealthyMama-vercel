/**
 * Enhanced Recipe Generation Service
 * Orchestrates the entire enhanced prompt system for GPT-4o mini
 */

import { IntelligentRecipeAnalyzer } from './intelligentRecipeAnalyzer';
import { MealAnalysis, RecipeValidation } from './recipeIntelligenceTypes';

interface MealPlanFilters {
  numDays: number;
  mealsPerDay: number;
  cookTime: number;
  difficulty: number;
  nutritionGoal?: string;
  dietaryRestrictions?: string;
  availableIngredients?: string;
  excludeIngredients?: string;
  primaryGoal?: string;
  familySize?: number;
  profileType?: 'individual' | 'family';
  culturalBackground?: string[];
  availableIngredientUsagePercent?: number;
  encourageOverlap?: boolean;
  budgetConstraints?: 'low' | 'medium' | 'high';
  prepTimePreference?: 'minimal' | 'moderate' | 'enjoys_cooking';
  varietyPreference?: 'consistent' | 'moderate' | 'high_variety';
}

interface EnhancedMealPlanResult {
  success: boolean;
  data?: any;
  metadata: {
    generatedAt: Date;
    calculatorVersion: string;
    timingAccuracy: number;
    complexityValidation: number;
    preAnalysis: Record<string, MealAnalysis>;
  };
  error?: string;
}

export class EnhancedRecipeGenerationService {
  private analyzer = new IntelligentRecipeAnalyzer();
  
  /**
   * Generate enhanced meal plan with pre-analysis intelligence
   */
  async generateMealPlan(filters: MealPlanFilters): Promise<EnhancedMealPlanResult> {
    try {
      console.log('🚀 Starting enhanced meal plan generation...');
      
      // Step 1: Pre-analyze each meal slot for complexity and time
      const mealAnalysis = await this.analyzeMealRequirements(filters);
      
      // Step 2: Build enhanced prompt with calculated requirements
      const enhancedPrompt = this.buildEnhancedPrompt(filters, mealAnalysis);
      
      // Step 3: Generate with GPT-4o mini (or your AI service)
      const response = await this.callAIService(enhancedPrompt, filters);
      
      // Step 4: Validate and adjust the response
      const validatedResponse = this.validateAndAdjustResponse(response, mealAnalysis);
      
      return {
        success: true,
        data: validatedResponse,
        metadata: {
          generatedAt: new Date(),
          calculatorVersion: '2.0',
          timingAccuracy: this.getTimingAccuracy(validatedResponse),
          complexityValidation: this.getComplexityValidation(validatedResponse),
          preAnalysis: mealAnalysis
        }
      };
      
    } catch (error) {
      console.error('❌ Enhanced recipe generation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          generatedAt: new Date(),
          calculatorVersion: '2.0',
          timingAccuracy: 0,
          complexityValidation: 0,
          preAnalysis: {}
        }
      };
    }
  }
  
  /**
   * Analyze meal requirements for each meal type
   */
  private async analyzeMealRequirements(filters: MealPlanFilters): Promise<Record<string, MealAnalysis>> {
    const mealTypes = this.getMealTypes(filters.mealsPerDay);
    const analysis: Record<string, MealAnalysis> = {};
    
    const primaryCuisine = filters.culturalBackground?.[0] || 'american';
    const dietaryRestrictions = filters.dietaryRestrictions ? [filters.dietaryRestrictions] : [];
    
    for (const mealType of mealTypes) {
      const requirements = this.analyzer.analyzeRecipeRequirements(
        mealType,
        primaryCuisine,
        filters.cookTime,
        filters.difficulty,
        dietaryRestrictions
      );
      
      analysis[mealType] = {
        targetComplexity: requirements.complexity,
        estimatedTime: requirements.estimatedTime,
        timeBreakdown: requirements.timeBreakdown,
        feasible: requirements.feasible,
        recommendations: requirements.recommendations
      };
    }
    
    return analysis;
  }
  
  /**
   * Build enhanced prompt with pre-analysis intelligence
   */
  private buildEnhancedPrompt(filters: MealPlanFilters, analysis: Record<string, MealAnalysis>): string {
    let prompt = `Create exactly a ${filters.numDays}-day meal plan with ${filters.mealsPerDay} meals per day`;
    
    // Add primary goal context
    if (filters.primaryGoal === 'Save Money') {
      prompt += ` focused on cost-effectiveness and budget-friendly meals with ingredient reuse`;
    } else if (filters.primaryGoal === 'Eat Healthier') {
      prompt += ` focused on nutritious, wholesome meals`;
    } else if (filters.primaryGoal === 'Save Time') {
      prompt += ` focused on quick, efficient meal preparation`;
    }
    
    // Add family context
    if (filters.profileType === 'family' && filters.familySize) {
      prompt += ` for a family of ${filters.familySize}`;
    }
    
    prompt += `\n\nREQUIREMENTS:`;
    prompt += `\n- Max cook time: ${filters.cookTime} minutes (including prep + cook time)`;
    prompt += `\n- Difficulty level: ${filters.difficulty}/5`;
    
    // NEW: Add specific time and complexity guidance for each meal
    prompt += `\n\nMEAL-SPECIFIC REQUIREMENTS (CRITICAL - FOLLOW EXACTLY):`;
    
    Object.entries(analysis).forEach(([mealType, data]: [string, any]) => {
      prompt += `\n${mealType.toUpperCase()}:`;
      prompt += `\n- Target complexity: ${data.targetComplexity}/5`;
      prompt += `\n- Target time: ${data.estimatedTime} minutes (prep + cook combined)`;
      prompt += `\n- Time breakdown guidance: ${data.timeBreakdown.slice(0, 3).join(', ')}`;
      
      if (!data.feasible) {
        prompt += `\n- ⚠️ IMPORTANT: Simplify this meal - current estimates exceed time limit`;
      }
      
      if (data.recommendations.length > 0) {
        prompt += `\n- Recommendations: ${data.recommendations[0]}`;
      }
    });
    
    // Enhanced complexity guidance
    prompt += `\n\nCOMPLEXITY GUIDANCE BY DIFFICULTY LEVEL:`;
    prompt += this.analyzer.generateComplexityGuidance(filters.difficulty);
    
    // Enhanced time accuracy requirements
    prompt += `\n\nTIME ACCURACY REQUIREMENTS (CRITICAL):`;
    prompt += `\n- MUST provide realistic cook_time_minutes that includes BOTH prep AND cooking time`;
    prompt += `\n- Break down time estimates: "15 min prep + 20 min cook = 35 min total"`;
    prompt += `\n- Consider skill level: difficulty ${filters.difficulty} recipes need appropriate time`;
    prompt += `\n- Passive time (baking, simmering) should be noted separately in instructions`;
    prompt += `\n- Time estimates must be realistic for home cooks, not professional chefs`;
    
    // Cultural cuisine integration
    if (filters.culturalBackground && filters.culturalBackground.length > 0) {
      prompt += `\n\n🌍 CULTURAL CUISINE INTEGRATION:`;
      prompt += `\n- Incorporate ${filters.culturalBackground.join(', ')} cuisine elements`;
      prompt += `\n- Use authentic cooking techniques and ingredients when possible`;
      prompt += `\n- Respect cultural food traditions and flavor profiles`;
    }
    
    // Dietary restrictions
    if (filters.dietaryRestrictions) {
      prompt += `\n\n🥗 DIETARY REQUIREMENTS:`;
      prompt += `\n- STRICT adherence to ${filters.dietaryRestrictions} requirements`;
      prompt += `\n- Double-check all ingredients for compliance`;
      prompt += `\n- Suggest alternatives if traditional recipes need modification`;
    }
    
    // Enhanced JSON format requirements
    prompt += `\n\nOUTPUT FORMAT - Generate ALL ${filters.numDays} days in this exact JSON format:`;
    prompt += `\n{`;
    prompt += `\n  "meal_plan": {`;
    prompt += `\n    "day_1": {`;
    
    const mealTypes = this.getMealTypes(filters.mealsPerDay);
    mealTypes.forEach((meal, index) => {
      const mealAnalysis = analysis[meal];
      prompt += `\n      "${meal}": {`;
      prompt += `\n        "title": "Recipe Name",`;
      prompt += `\n        "cook_time_minutes": ${mealAnalysis?.estimatedTime || 20}, // Target: ${mealAnalysis?.estimatedTime || 20}min`;
      prompt += `\n        "difficulty": ${mealAnalysis?.targetComplexity || filters.difficulty}, // Target: ${mealAnalysis?.targetComplexity || filters.difficulty}/5`;
      prompt += `\n        "time_breakdown": "X min prep + Y min cook", // REQUIRED breakdown`;
      prompt += `\n        "ingredients": ["ingredient1", "ingredient2"],`;
      prompt += `\n        "instructions": ["step1", "step2"],`;
      prompt += `\n        "nutrition": {"calories": 350, "protein_g": 20, "carbs_g": 30, "fat_g": 15}`;
      prompt += `\n      }${index !== mealTypes.length - 1 ? ',' : ''}`;
    });
    
    prompt += `\n    },`;
    prompt += `\n    "day_2": { ... similar structure ... },`;
    prompt += `\n    ... continue for all ${filters.numDays} days ...`;
    prompt += `\n  },`;
    prompt += `\n  "shopping_list": ["ingredient list"],`;
    prompt += `\n  "prep_tips": ["tip 1", "tip 2"],`;
    prompt += `\n  "time_optimization_tips": ["batch prep suggestions", "advance prep options"]`;
    prompt += `\n}`;
    
    if (filters.encourageOverlap) {
      prompt += `\n\nMAXIMIZE INGREDIENT REUSE for bulk buying opportunities and cost savings!`;
    }
    
    return prompt;
  }
  
  /**
   * Call AI service (placeholder for your existing OpenAI integration)
   */
  private async callAIService(prompt: string, filters: MealPlanFilters): Promise<any> {
    // This is where you would integrate with your existing OpenAI call
    // For now, return a mock response structure
    console.log('📝 Enhanced prompt generated (length:', prompt.length, 'chars)');
    console.log('🤖 Would call AI service here with enhanced prompt...');
    
    // Mock response for testing
    return {
      meal_plan: {
        day_1: {
          breakfast: {
            title: "Scrambled Eggs with Toast",
            cook_time_minutes: 12,
            difficulty: 1,
            time_breakdown: "3 min prep + 9 min cook",
            ingredients: ["eggs", "butter", "bread", "salt"],
            instructions: ["Crack eggs", "Heat pan", "Scramble eggs", "Toast bread"],
            nutrition: { calories: 320, protein_g: 18, carbs_g: 24, fat_g: 15 }
          }
        }
      },
      shopping_list: ["eggs", "butter", "bread", "salt"],
      prep_tips: ["Pre-crack eggs the night before"],
      time_optimization_tips: ["Toast bread while eggs cook"]
    };
  }
  
  /**
   * Validate and adjust the AI response
   */
  private validateAndAdjustResponse(response: any, analysis: Record<string, MealAnalysis>): any {
    if (!response.meal_plan) {
      console.warn('⚠️ Response missing meal_plan structure');
      return response;
    }
    
    // Validate each meal against our pre-calculated requirements
    for (const dayKey in response.meal_plan) {
      const day = response.meal_plan[dayKey];
      
      for (const mealType in day) {
        const meal = day[mealType];
        const expected = analysis[mealType];
        
        if (!expected) continue;
        
        // Check time accuracy
        const timeAccurate = meal.cook_time_minutes <= expected.estimatedTime * 1.2;
        if (!timeAccurate) {
          console.warn(`⚠️ ${mealType} time estimate high: ${meal.cook_time_minutes}min vs expected ${expected.estimatedTime}min`);
        }
        
        // Check complexity accuracy
        const complexityAccurate = Math.abs(meal.difficulty - expected.targetComplexity) <= 1;
        if (!complexityAccurate) {
          console.warn(`⚠️ ${mealType} difficulty mismatch: ${meal.difficulty} vs expected ${expected.targetComplexity}`);
        }
        
        // Add validation metadata
        meal.validation = {
          timeAccurate,
          complexityAccurate,
          feasible: expected.feasible
        };
      }
    }
    
    return response;
  }
  
  /**
   * Calculate timing accuracy percentage
   */
  private getTimingAccuracy(response: any): number {
    let accurateCount = 0;
    let totalCount = 0;
    
    for (const dayKey in response.meal_plan) {
      const day = response.meal_plan[dayKey];
      for (const mealKey in day) {
        const meal = day[mealKey];
        totalCount++;
        
        if (meal.validation?.timeAccurate) {
          accurateCount++;
        }
      }
    }
    
    return totalCount > 0 ? Math.round((accurateCount / totalCount) * 100) : 0;
  }
  
  /**
   * Calculate complexity validation percentage
   */
  private getComplexityValidation(response: any): number {
    let accurateCount = 0;
    let totalCount = 0;
    
    for (const dayKey in response.meal_plan) {
      const day = response.meal_plan[dayKey];
      for (const mealKey in day) {
        const meal = day[mealKey];
        totalCount++;
        
        if (meal.validation?.complexityAccurate) {
          accurateCount++;
        }
      }
    }
    
    return totalCount > 0 ? Math.round((accurateCount / totalCount) * 100) : 0;
  }
  
  /**
   * Get meal types based on meals per day
   */
  private getMealTypes(mealsPerDay: number): string[] {
    const allMeals = ['breakfast', 'lunch', 'dinner', 'snack'];
    return allMeals.slice(0, mealsPerDay);
  }
  
  /**
   * Build system message for AI service
   */
  buildSystemMessage(filters: MealPlanFilters): string {
    let systemMsg = `You are an expert meal planning chef with deep knowledge of cooking times and recipe complexity.`;
    
    if (filters.primaryGoal === 'Save Money') {
      systemMsg += ` You specialize in cost-optimization meal planning that maximizes ingredient reuse to reduce grocery costs and enable bulk buying.`;
    }
    
    systemMsg += ` 
CRITICAL ACCURACY REQUIREMENTS:
- Cooking times must be realistic and include BOTH prep AND active cooking time
- Difficulty ratings must match the actual techniques required
- Time estimates should account for skill level - beginners need more time
- Always provide time breakdowns to show your reasoning
- Validate that total time fits within user's constraints

Your meal plans should be practical, delicious, and precisely timed for real home cooks.
Always return valid JSON with the exact structure requested.`;
    
    return systemMsg;
  }
}