/**
 * Intelligent Recipe Analyzer
 * Pre-analyzes recipe requirements for better GPT-4o mini prompt generation
 */

import { RecipeComplexityCalculator } from './recipeComplexityCalculator';
import { EnhancedCookingTimeCalculator } from './enhancedCookingTimeCalculator';
import { 
  RecipeComplexityFactors, 
  CookingTimeFactors, 
  RecipeAnalysisResult,
  MealAnalysis,
  CUISINE_COMPLEXITY,
  DIETARY_COMPLEXITY
} from './recipeIntelligenceTypes';

interface MealPlanFilters {
  numDays: number;
  mealsPerDay: number;
  cookTime: number;
  difficulty: number;
  nutritionGoal?: string;
  dietaryRestrictions?: string;
  primaryGoal?: string;
  familySize?: number;
  culturalBackground?: string[];
  budgetConstraints?: 'low' | 'medium' | 'high';
  prepTimePreference?: 'minimal' | 'moderate' | 'enjoys_cooking';
}

export class IntelligentRecipeAnalyzer {
  private complexityCalc = new RecipeComplexityCalculator();
  private timeCalc = new EnhancedCookingTimeCalculator();
  
  /**
   * Analyze recipe requirements for each meal type
   */
  analyzeRecipeRequirements(
    mealType: string,
    cuisineType: string,
    maxCookTime: number,
    targetDifficulty: number,
    dietaryRestrictions: string[]
  ): RecipeAnalysisResult {
    
    // Get base complexity factors for this meal type
    const baseFactors = this.getBaseMealFactors(mealType);
    
    // Adjust for cuisine complexity
    const cuisineAdjustment = this.getCuisineComplexity(cuisineType);
    baseFactors.techniqueComplexity = Math.min(baseFactors.techniqueComplexity + cuisineAdjustment, 5);
    
    // Adjust for dietary restrictions
    const restrictionAdjustment = this.getDietaryComplexity(dietaryRestrictions);
    baseFactors.techniqueComplexity = Math.min(baseFactors.techniqueComplexity + restrictionAdjustment, 5);
    
    // Calculate complexity score
    const complexity = this.complexityCalc.calculateComplexity(baseFactors);
    
    // Estimate time requirements
    const timeFactors = this.estimateTimeRequirements(
      mealType, cuisineType, maxCookTime, complexity
    );
    
    const timeAnalysis = this.timeCalc.calculateTotalTime(timeFactors, complexity);
    
    return {
      complexity,
      estimatedTime: timeAnalysis.totalTime,
      timeBreakdown: timeAnalysis.breakdown,
      feasible: timeAnalysis.totalTime <= maxCookTime,
      recommendations: this.generateRecommendations(
        complexity, timeAnalysis.totalTime, maxCookTime, targetDifficulty
      )
    };
  }
  
  /**
   * Analyze requirements for an entire meal plan
   */
  async analyzeMealPlanRequirements(filters: MealPlanFilters): Promise<Record<string, MealAnalysis>> {
    const mealTypes = this.getMealTypes(filters.mealsPerDay);
    const analysis: Record<string, MealAnalysis> = {};
    
    const primaryCuisine = filters.culturalBackground?.[0] || 'american';
    const dietaryRestrictions = filters.dietaryRestrictions ? [filters.dietaryRestrictions] : [];
    
    for (const mealType of mealTypes) {
      const requirements = this.analyzeRecipeRequirements(
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
   * Get base complexity factors by meal type
   */
  private getBaseMealFactors(mealType: string): RecipeComplexityFactors {
    const baseMeals: Record<string, RecipeComplexityFactors> = {
      breakfast: {
        techniqueComplexity: 2,
        ingredientCount: 5,
        equipmentRequired: ['stovetop'],
        timingCritical: false,
        multiStep: false,
        skillRequired: ['basic_cooking']
      },
      lunch: {
        techniqueComplexity: 2.5,
        ingredientCount: 7,
        equipmentRequired: ['stovetop'],
        timingCritical: false,
        multiStep: true,
        skillRequired: ['basic_cooking', 'assembly']
      },
      dinner: {
        techniqueComplexity: 3,
        ingredientCount: 9,
        equipmentRequired: ['stovetop', 'oven'],
        timingCritical: true,
        multiStep: true,
        skillRequired: ['cooking', 'seasoning', 'timing']
      },
      snack: {
        techniqueComplexity: 1,
        ingredientCount: 3,
        equipmentRequired: [],
        timingCritical: false,
        multiStep: false,
        skillRequired: ['assembly']
      }
    };
    
    return baseMeals[mealType] || baseMeals.dinner;
  }
  
  /**
   * Get cuisine complexity adjustment
   */
  private getCuisineComplexity(cuisine: string): number {
    return CUISINE_COMPLEXITY[cuisine.toLowerCase()] || 0;
  }
  
  /**
   * Get dietary restriction complexity adjustment
   */
  private getDietaryComplexity(restrictions: string[]): number {
    let adjustment = 0;
    
    restrictions.forEach(restriction => {
      adjustment += DIETARY_COMPLEXITY[restriction.toLowerCase()] || 0;
    });
    
    return Math.min(adjustment, 2); // Cap at +2 complexity
  }
  
  /**
   * Estimate time requirements based on meal parameters
   */
  private estimateTimeRequirements(
    mealType: string,
    cuisine: string,
    maxTime: number,
    complexity: number
  ): CookingTimeFactors {
    
    // Start with base meal time factors
    const baseTimeFactors = this.timeCalc.createBaseMealTimeFactors(mealType, complexity);
    
    // Adjust for cuisine-specific time patterns
    const cuisineTimeMultiplier = this.getCuisineTimeMultiplier(cuisine);
    
    // Apply cuisine adjustments
    return {
      prepWork: {
        chopping: Math.round(baseTimeFactors.prepWork.chopping * cuisineTimeMultiplier),
        marinating: baseTimeFactors.prepWork.marinating,
        mixing: Math.round(baseTimeFactors.prepWork.mixing * cuisineTimeMultiplier),
        setup: baseTimeFactors.prepWork.setup
      },
      activeTime: {
        cooking: Math.round(baseTimeFactors.activeTime.cooking * cuisineTimeMultiplier),
        monitoring: Math.round(baseTimeFactors.activeTime.monitoring * cuisineTimeMultiplier)
      },
      passiveTime: {
        baking: baseTimeFactors.passiveTime.baking,
        simmering: Math.round(baseTimeFactors.passiveTime.simmering * cuisineTimeMultiplier),
        resting: baseTimeFactors.passiveTime.resting
      }
    };
  }
  
  /**
   * Get cuisine-specific time multipliers
   */
  private getCuisineTimeMultiplier(cuisine: string): number {
    const timeMultipliers: Record<string, number> = {
      'american': 1.0,
      'italian': 1.1,      // More sauce work
      'mexican': 1.0,
      'chinese': 1.2,      // More prep work, stir-frying
      'indian': 1.3,       // Spice preparation, longer cooking
      'french': 1.4,       // Technique-heavy
      'thai': 1.2,         // Fresh ingredient prep
      'japanese': 1.1,     // Precise preparation
      'mediterranean': 1.0,
      'korean': 1.2,       // Fermented ingredients, marinades
      'vietnamese': 1.1,   // Fresh herb preparation
      'middle_eastern': 1.1,
      'moroccan': 1.3,     // Spice blending, slow cooking
      'ethiopian': 1.4,    // Complex spice preparations
      'molecular': 2.0     // Specialized techniques
    };
    
    return timeMultipliers[cuisine.toLowerCase()] || 1.0;
  }
  
  /**
   * Generate recommendations based on analysis
   */
  private generateRecommendations(
    complexity: number,
    estimatedTime: number,
    maxTime: number,
    targetDifficulty: number
  ): string[] {
    const recommendations: string[] = [];
    
    if (estimatedTime > maxTime) {
      recommendations.push(`Consider reducing complexity to meet ${maxTime}min time limit`);
      recommendations.push('Focus on one-pot meals or sheet pan recipes');
      recommendations.push('Use pre-prepared ingredients to save time');
    }
    
    if (complexity > targetDifficulty) {
      recommendations.push('Simplify cooking techniques for target difficulty');
      recommendations.push('Use fewer specialized equipment requirements');
      recommendations.push('Reduce number of simultaneous cooking processes');
    }
    
    if (complexity < targetDifficulty - 1) {
      recommendations.push('Consider adding more advanced techniques');
      recommendations.push('Include more sophisticated flavor development');
      recommendations.push('Add multi-step cooking processes for complexity');
    }
    
    if (estimatedTime < maxTime * 0.6) {
      recommendations.push('Can add more elaborate preparation steps');
      recommendations.push('Consider techniques that develop deeper flavors');
    }
    
    return recommendations;
  }
  
  /**
   * Get meal types based on meals per day
   */
  private getMealTypes(mealsPerDay: number): string[] {
    const allMeals = ['breakfast', 'lunch', 'dinner', 'snack'];
    return allMeals.slice(0, mealsPerDay);
  }
  
  /**
   * Generate complexity guidance for GPT prompts
   */
  generateComplexityGuidance(difficulty: number): string {
    const guidanceMap: Record<number, string> = {
      1: `\n- Level 1: Use basic techniques (mixing, heating, assembly)
- Simple ingredients, minimal prep work  
- Single-step cooking methods
- Total time should include realistic beginner pace`,
      
      2: `\n- Level 2: Simple cooking methods (sautéing, boiling)
- Basic knife skills acceptable
- 2-3 step processes maximum
- Allow extra time for learning curve`,
      
      3: `\n- Level 3: Multiple cooking steps allowed
- Roasting, braising, basic sauce making
- Temperature control required
- Moderate prep work and timing coordination`,
      
      4: `\n- Level 4: Advanced techniques (emulsification, reduction)
- Precise timing and temperature control
- Complex layering of flavors
- Skilled knife work expected`,
      
      5: `\n- Level 5: Professional techniques
- Critical timing requirements
- Advanced equipment usage
- Expert-level skills assumed`
    };
    
    return guidanceMap[difficulty] || guidanceMap[3];
  }
  
  /**
   * Analyze existing recipe for accuracy validation
   */
  analyzeExistingRecipe(recipe: {
    title: string;
    ingredients: string[];
    instructions: string[];
    cookTime: number;
    difficulty: number;
    description?: string;
  }): {
    predictedComplexity: number;
    predictedTime: number;
    accuracyAssessment: {
      timeAccurate: boolean;
      complexityAccurate: boolean;
      timeDifference: number;
      complexityDifference: number;
    };
  } {
    
    // Estimate complexity from recipe content
    const factors = this.complexityCalc.estimateComplexityFromText(
      recipe.description || recipe.title,
      recipe.ingredients,
      recipe.instructions
    );
    
    const predictedComplexity = this.complexityCalc.calculateComplexity(factors);
    
    // Estimate time from recipe content
    const timeFactors = this.timeCalc.estimateFromRecipeDescription(
      recipe.description || recipe.title,
      recipe.ingredients,
      recipe.instructions
    );
    
    const timeAnalysis = this.timeCalc.calculateTotalTime(timeFactors, predictedComplexity);
    const predictedTime = timeAnalysis.totalTime;
    
    // Calculate accuracy
    const timeDifference = Math.abs(predictedTime - recipe.cookTime);
    const complexityDifference = Math.abs(predictedComplexity - recipe.difficulty);
    
    return {
      predictedComplexity,
      predictedTime,
      accuracyAssessment: {
        timeAccurate: timeDifference <= recipe.cookTime * 0.2, // Within 20%
        complexityAccurate: complexityDifference <= 1, // Within 1 level
        timeDifference,
        complexityDifference
      }
    };
  }
}