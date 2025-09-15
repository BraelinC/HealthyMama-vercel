/**
 * Hero Ingredient Manager
 * 
 * Strategic ingredient reuse system that selects 3-5 versatile ingredients
 * to appear in 3-4 meals per week. Maximizes cost savings and minimizes waste
 * while maintaining variety and cultural authenticity.
 */

export interface HeroIngredient {
  name: string;
  versatility_score: number; // How well it works across different cuisines (0-1)
  cost_efficiency: number;   // Cost per use relative to alternatives (0-1, higher = better)
  cultural_compatibility: string[]; // Which cuisines this ingredient works well in
  storage_life: number;     // Days ingredient stays fresh
  bulk_friendly: boolean;   // Whether buying in bulk makes sense
  dietary_safe: string[];   // Which dietary restrictions it's safe for
  usage_contexts: string[]; // protein, vegetable, seasoning, base, etc.
  seasonal_availability?: {
    peak_months: number[];  // Months when most affordable/fresh
    off_season_months: number[];
  };
}

export interface HeroIngredientSelection {
  selected_ingredients: HeroIngredient[];
  selection_rationale: string[];
  expected_usage_frequency: Record<string, number>; // ingredient name -> meals per week
  cost_savings_estimate: number; // Estimated weekly savings in dollars
  coverage_analysis: {
    cuisine_coverage: string[];
    dietary_coverage: string[];
    meal_type_coverage: string[];
  };
}

export interface IngredientUsageTarget {
  ingredient: string;
  target_meals_per_week: number;
  current_usage: number;
  remaining_opportunities: number;
}

export class HeroIngredientManager {
  // Comprehensive ingredient database with versatility scores
  private readonly INGREDIENT_DATABASE: Record<string, HeroIngredient> = {
    // Proteins - High versatility
    'eggs': {
      name: 'eggs',
      versatility_score: 0.95,
      cost_efficiency: 0.9,
      cultural_compatibility: ['American', 'French', 'Asian', 'Italian', 'Mexican'],
      storage_life: 14,
      bulk_friendly: true,
      dietary_safe: ['vegetarian'],
      usage_contexts: ['protein', 'binding', 'breakfast'],
      seasonal_availability: { peak_months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], off_season_months: [] }
    },
    
    'chicken_thighs': {
      name: 'chicken thighs',
      versatility_score: 0.9,
      cost_efficiency: 0.85,
      cultural_compatibility: ['American', 'Asian', 'Mediterranean', 'Mexican', 'Indian'],
      storage_life: 3,
      bulk_friendly: true,
      dietary_safe: [],
      usage_contexts: ['protein', 'main'],
      seasonal_availability: { peak_months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], off_season_months: [] }
    },

    'ground_turkey': {
      name: 'ground turkey',
      versatility_score: 0.85,
      cost_efficiency: 0.8,
      cultural_compatibility: ['American', 'Italian', 'Mexican', 'Mediterranean'],
      storage_life: 2,
      bulk_friendly: true,
      dietary_safe: [],
      usage_contexts: ['protein', 'main'],
      seasonal_availability: { peak_months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], off_season_months: [] }
    },

    // Vegetables - High versatility
    'onions': {
      name: 'onions',
      versatility_score: 0.98,
      cost_efficiency: 0.95,
      cultural_compatibility: ['American', 'French', 'Italian', 'Asian', 'Mexican', 'Indian', 'Mediterranean'],
      storage_life: 30,
      bulk_friendly: true,
      dietary_safe: ['vegetarian', 'vegan', 'gluten-free', 'dairy-free'],
      usage_contexts: ['aromatics', 'base', 'vegetable'],
      seasonal_availability: { peak_months: [8, 9, 10], off_season_months: [] }
    },

    'garlic': {
      name: 'garlic',
      versatility_score: 0.95,
      cost_efficiency: 0.9,
      cultural_compatibility: ['Italian', 'Asian', 'Mediterranean', 'Mexican', 'Indian'],
      storage_life: 60,
      bulk_friendly: true,
      dietary_safe: ['vegetarian', 'vegan', 'gluten-free', 'dairy-free'],
      usage_contexts: ['aromatics', 'seasoning'],
      seasonal_availability: { peak_months: [6, 7, 8], off_season_months: [] }
    },

    'bell_peppers': {
      name: 'bell peppers',
      versatility_score: 0.85,
      cost_efficiency: 0.75,
      cultural_compatibility: ['American', 'Italian', 'Mexican', 'Asian', 'Mediterranean'],
      storage_life: 7,
      bulk_friendly: false,
      dietary_safe: ['vegetarian', 'vegan', 'gluten-free', 'dairy-free'],
      usage_contexts: ['vegetable', 'color', 'crunch'],
      seasonal_availability: { peak_months: [6, 7, 8, 9], off_season_months: [12, 1, 2] }
    },

    'carrots': {
      name: 'carrots',
      versatility_score: 0.8,
      cost_efficiency: 0.85,
      cultural_compatibility: ['American', 'French', 'Asian', 'Mediterranean'],
      storage_life: 21,
      bulk_friendly: true,
      dietary_safe: ['vegetarian', 'vegan', 'gluten-free', 'dairy-free'],
      usage_contexts: ['vegetable', 'sweetness', 'base'],
      seasonal_availability: { peak_months: [9, 10, 11], off_season_months: [] }
    },

    // Pantry staples
    'rice': {
      name: 'rice',
      versatility_score: 0.9,
      cost_efficiency: 0.95,
      cultural_compatibility: ['Asian', 'Mexican', 'Indian', 'Mediterranean'],
      storage_life: 365,
      bulk_friendly: true,
      dietary_safe: ['vegetarian', 'vegan', 'gluten-free', 'dairy-free'],
      usage_contexts: ['carbohydrate', 'base', 'filling'],
      seasonal_availability: { peak_months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], off_season_months: [] }
    },

    'olive_oil': {
      name: 'olive oil',
      versatility_score: 0.92,
      cost_efficiency: 0.8,
      cultural_compatibility: ['Italian', 'Mediterranean', 'American', 'Mexican'],
      storage_life: 365,
      bulk_friendly: true,
      dietary_safe: ['vegetarian', 'vegan', 'gluten-free', 'dairy-free'],
      usage_contexts: ['fat', 'cooking', 'flavor'],
      seasonal_availability: { peak_months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], off_season_months: [] }
    },

    'canned_tomatoes': {
      name: 'canned tomatoes',
      versatility_score: 0.85,
      cost_efficiency: 0.9,
      cultural_compatibility: ['Italian', 'Mexican', 'American', 'Mediterranean', 'Indian'],
      storage_life: 730,
      bulk_friendly: true,
      dietary_safe: ['vegetarian', 'vegan', 'gluten-free', 'dairy-free'],
      usage_contexts: ['base', 'sauce', 'acidity'],
      seasonal_availability: { peak_months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], off_season_months: [] }
    },

    // Legumes
    'black_beans': {
      name: 'black beans',
      versatility_score: 0.75,
      cost_efficiency: 0.95,
      cultural_compatibility: ['Mexican', 'American', 'Latin American'],
      storage_life: 730,
      bulk_friendly: true,
      dietary_safe: ['vegetarian', 'vegan', 'gluten-free', 'dairy-free'],
      usage_contexts: ['protein', 'fiber', 'filling'],
      seasonal_availability: { peak_months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], off_season_months: [] }
    },

    'lentils': {
      name: 'lentils',
      versatility_score: 0.8,
      cost_efficiency: 0.9,
      cultural_compatibility: ['Indian', 'Mediterranean', 'American'],
      storage_life: 365,
      bulk_friendly: true,
      dietary_safe: ['vegetarian', 'vegan', 'gluten-free', 'dairy-free'],
      usage_contexts: ['protein', 'fiber', 'base'],
      seasonal_availability: { peak_months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], off_season_months: [] }
    }
  };

  /**
   * Select optimal hero ingredients based on user context
   */
  async selectHeroIngredients(
    culturalBackground: string[],
    availableIngredients: string[] = [],
    costPriority: number = 0.5,
    dietaryRestrictions: string[] = []
  ): Promise<HeroIngredientSelection> {
    console.log('Selecting hero ingredients...');
    console.log(`Cultural background: ${culturalBackground.join(', ')}`);
    console.log(`Cost priority: ${costPriority}`);
    console.log(`Dietary restrictions: ${dietaryRestrictions.join(', ')}`);

    // Filter ingredients by dietary restrictions
    const safeIngredients = this.filterBySafetyRequirements(dietaryRestrictions);
    
    // Score ingredients based on user context
    const scoredIngredients = this.scoreIngredients(
      safeIngredients,
      culturalBackground,
      availableIngredients,
      costPriority
    );

    // Select optimal combination (3-5 ingredients)
    const selectedIngredients = this.selectOptimalCombination(scoredIngredients, culturalBackground);

    // Calculate usage targets and cost estimates
    const usageFrequency = this.calculateUsageFrequency(selectedIngredients);
    const costSavings = this.estimateCostSavings(selectedIngredients, usageFrequency);
    const coverage = this.analyzeCoverage(selectedIngredients, culturalBackground);

    const rationale = this.generateSelectionRationale(selectedIngredients, culturalBackground, costPriority);

    console.log(`Selected ${selectedIngredients.length} hero ingredients: ${selectedIngredients.map(i => i.name).join(', ')}`);
    console.log(`Estimated weekly savings: $${costSavings.toFixed(2)}`);

    return {
      selected_ingredients: selectedIngredients,
      selection_rationale: rationale,
      expected_usage_frequency: usageFrequency,
      cost_savings_estimate: costSavings,
      coverage_analysis: coverage
    };
  }

  /**
   * Enhance a meal with hero ingredients where appropriate
   */
  async enhanceWithHeroIngredients(
    meal: any,
    heroIngredients: string[],
    costPriority: number = 0.5
  ): Promise<any> {
    if (!meal || !heroIngredients.length) return meal;

    console.log(`Enhancing meal "${meal.title || meal.name}" with hero ingredients`);

    const enhancedMeal = { ...meal };
    let modificationsApplied = 0;
    const maxModifications = 3; // Don't overwhelm the meal

    // Try to incorporate 2-3 hero ingredients naturally
    const targetHeroCount = Math.min(3, heroIngredients.length);
    const applicableHeros = this.findApplicableHeroIngredients(meal, heroIngredients);

    for (let i = 0; i < Math.min(targetHeroCount, applicableHeros.length) && modificationsApplied < maxModifications; i++) {
      const heroIngredient = applicableHeros[i];
      const ingredient = this.INGREDIENT_DATABASE[heroIngredient];
      
      if (ingredient && this.canEnhanceMealWithIngredient(meal, ingredient)) {
        const enhancement = this.applyHeroIngredientEnhancement(enhancedMeal, ingredient);
        if (enhancement.applied) {
          modificationsApplied++;
          console.log(`Enhanced meal with ${ingredient.name}: ${enhancement.description}`);
        }
      }
    }

    // Track hero ingredients used
    enhancedMeal.heroIngredients = heroIngredients.filter(hero =>
      enhancedMeal.ingredients.some((ing: string) => 
        ing.toLowerCase().includes(hero.toLowerCase())
      )
    );

    return enhancedMeal;
  }

  /**
   * Track hero ingredient usage across meal plan
   */
  trackHeroIngredientUsage(
    mealPlan: any[],
    targetHeroIngredients: string[]
  ): {
    usage_stats: Record<string, { count: number; meals: string[] }>;
    target_achievement: Record<string, { target: number; actual: number; percentage: number }>;
    recommendations: string[];
  } {
    const usageStats: Record<string, { count: number; meals: string[] }> = {};
    const targetUsage = 3; // Target 3-4 meals per week per hero ingredient

    // Initialize tracking
    targetHeroIngredients.forEach(hero => {
      usageStats[hero] = { count: 0, meals: [] };
    });

    // Count usage across meal plan
    mealPlan.forEach((meal, index) => {
      const mealId = meal.title || meal.name || `Meal ${index + 1}`;
      const mealIngredients = meal.ingredients || [];
      
      targetHeroIngredients.forEach(hero => {
        const used = mealIngredients.some((ing: string) => 
          ing.toLowerCase().includes(hero.toLowerCase())
        );
        
        if (used) {
          usageStats[hero].count++;
          usageStats[hero].meals.push(mealId);
        }
      });
    });

    // Calculate target achievement
    const targetAchievement: Record<string, { target: number; actual: number; percentage: number }> = {};
    targetHeroIngredients.forEach(hero => {
      const actual = usageStats[hero].count;
      const percentage = Math.round((actual / targetUsage) * 100);
      targetAchievement[hero] = {
        target: targetUsage,
        actual,
        percentage
      };
    });

    // Generate recommendations
    const recommendations = this.generateUsageRecommendations(targetAchievement, usageStats);

    return {
      usage_stats: usageStats,
      target_achievement: targetAchievement,
      recommendations
    };
  }

  // Private helper methods

  private filterBySafetyRequirements(dietaryRestrictions: string[]): HeroIngredient[] {
    if (dietaryRestrictions.length === 0) {
      return Object.values(this.INGREDIENT_DATABASE);
    }

    return Object.values(this.INGREDIENT_DATABASE).filter(ingredient => {
      return dietaryRestrictions.every(restriction => 
        ingredient.dietary_safe.includes(restriction.toLowerCase()) ||
        this.isIngredientSafeForRestriction(ingredient, restriction)
      );
    });
  }

  private isIngredientSafeForRestriction(ingredient: HeroIngredient, restriction: string): boolean {
    const restrictionLower = restriction.toLowerCase();
    const ingredientName = ingredient.name.toLowerCase();

    switch (restrictionLower) {
      case 'vegetarian':
        return !['chicken_thighs', 'ground_turkey'].includes(ingredientName);
      case 'vegan':
        return !['eggs', 'chicken_thighs', 'ground_turkey'].includes(ingredientName);
      case 'gluten-free':
        return true; // All our hero ingredients are naturally gluten-free
      case 'dairy-free':
        return true; // None of our hero ingredients contain dairy
      case 'nut-free':
        return true; // None of our hero ingredients are nuts
      default:
        return true;
    }
  }

  private scoreIngredients(
    ingredients: HeroIngredient[],
    culturalBackground: string[],
    availableIngredients: string[],
    costPriority: number
  ): Array<{ ingredient: HeroIngredient; score: number }> {
    return ingredients.map(ingredient => {
      let score = 0;

      // Base versatility score (30% weight)
      score += ingredient.versatility_score * 0.3;

      // Cost efficiency (weighted by user's cost priority)
      score += ingredient.cost_efficiency * (0.2 + costPriority * 0.2);

      // Cultural compatibility bonus
      const culturalMatch = culturalBackground.some(culture =>
        ingredient.cultural_compatibility.some(compatible =>
          compatible.toLowerCase().includes(culture.toLowerCase()) ||
          culture.toLowerCase().includes(compatible.toLowerCase())
        )
      );
      if (culturalMatch) score += 0.15;

      // Already available bonus
      const alreadyAvailable = availableIngredients.some(available =>
        available.toLowerCase().includes(ingredient.name.toLowerCase()) ||
        ingredient.name.toLowerCase().includes(available.toLowerCase())
      );
      if (alreadyAvailable) score += 0.1;

      // Storage life bonus (longer storage = better for bulk buying)
      if (ingredient.storage_life > 14) score += 0.05;
      if (ingredient.bulk_friendly) score += 0.05;

      return { ingredient, score };
    });
  }

  private selectOptimalCombination(
    scoredIngredients: Array<{ ingredient: HeroIngredient; score: number }>,
    culturalBackground: string[]
  ): HeroIngredient[] {
    // Sort by score descending
    scoredIngredients.sort((a, b) => b.score - a.score);

    const selected: HeroIngredient[] = [];
    const maxIngredients = 5;
    const minIngredients = 3;

    // Ensure we have coverage across different usage contexts
    const neededContexts = ['protein', 'vegetable', 'aromatics', 'base'];
    const contextCoverage: Record<string, boolean> = {};

    // First pass: select highest scoring ingredients that provide context coverage
    for (const scored of scoredIngredients) {
      if (selected.length >= maxIngredients) break;

      const ingredient = scored.ingredient;
      const providesNeededContext = ingredient.usage_contexts.some(context =>
        neededContexts.includes(context) && !contextCoverage[context]
      );

      if (providesNeededContext || selected.length < minIngredients) {
        selected.push(ingredient);
        
        // Mark contexts as covered
        ingredient.usage_contexts.forEach(context => {
          if (neededContexts.includes(context)) {
            contextCoverage[context] = true;
          }
        });
      }
    }

    // Second pass: fill remaining slots with highest scoring ingredients
    for (const scored of scoredIngredients) {
      if (selected.length >= maxIngredients) break;
      if (!selected.includes(scored.ingredient)) {
        selected.push(scored.ingredient);
      }
    }

    return selected;
  }

  private calculateUsageFrequency(ingredients: HeroIngredient[]): Record<string, number> {
    const frequency: Record<string, number> = {};
    
    ingredients.forEach(ingredient => {
      // Target usage: 3-4 times per week for high versatility ingredients
      // 2-3 times per week for medium versatility ingredients
      if (ingredient.versatility_score >= 0.9) {
        frequency[ingredient.name] = 4;
      } else if (ingredient.versatility_score >= 0.8) {
        frequency[ingredient.name] = 3;
      } else {
        frequency[ingredient.name] = 2;
      }
    });

    return frequency;
  }

  private estimateCostSavings(
    ingredients: HeroIngredient[],
    usageFrequency: Record<string, number>
  ): number {
    let totalSavings = 0;

    ingredients.forEach(ingredient => {
      const weeklyUsage = usageFrequency[ingredient.name] || 0;
      const estimatedSavingsPerUse = ingredient.cost_efficiency * 2; // $2 max savings per use
      totalSavings += weeklyUsage * estimatedSavingsPerUse;
    });

    return totalSavings;
  }

  private analyzeCoverage(
    ingredients: HeroIngredient[],
    culturalBackground: string[]
  ): { cuisine_coverage: string[]; dietary_coverage: string[]; meal_type_coverage: string[] } {
    const cuisineCoverage = new Set<string>();
    const dietaryCoverage = new Set<string>();
    const mealTypeCoverage = new Set<string>();

    ingredients.forEach(ingredient => {
      ingredient.cultural_compatibility.forEach(cuisine => cuisineCoverage.add(cuisine));
      ingredient.dietary_safe.forEach(diet => dietaryCoverage.add(diet));
      ingredient.usage_contexts.forEach(context => mealTypeCoverage.add(context));
    });

    return {
      cuisine_coverage: Array.from(cuisineCoverage),
      dietary_coverage: Array.from(dietaryCoverage),
      meal_type_coverage: Array.from(mealTypeCoverage)
    };
  }

  private generateSelectionRationale(
    ingredients: HeroIngredient[],
    culturalBackground: string[],
    costPriority: number
  ): string[] {
    const rationale: string[] = [];

    rationale.push(`Selected ${ingredients.length} hero ingredients for optimal cost savings and versatility`);

    if (costPriority >= 0.7) {
      rationale.push('High cost priority: Emphasized bulk-friendly ingredients with long storage life');
    }

    const highVersatility = ingredients.filter(ing => ing.versatility_score >= 0.9);
    if (highVersatility.length > 0) {
      rationale.push(`${highVersatility.length} highly versatile ingredients selected: ${highVersatility.map(ing => ing.name).join(', ')}`);
    }

    if (culturalBackground.length > 0) {
      const culturalMatches = ingredients.filter(ing =>
        ing.cultural_compatibility.some(compat =>
          culturalBackground.some(bg =>
            compat.toLowerCase().includes(bg.toLowerCase()) ||
            bg.toLowerCase().includes(compat.toLowerCase())
          )
        )
      );
      if (culturalMatches.length > 0) {
        rationale.push(`${culturalMatches.length} ingredients selected for cultural compatibility with ${culturalBackground.join(', ')}`);
      }
    }

    return rationale;
  }

  private findApplicableHeroIngredients(meal: any, heroIngredients: string[]): string[] {
    // Filter hero ingredients that could work well in this meal
    return heroIngredients.filter(hero => {
      const ingredient = this.INGREDIENT_DATABASE[hero];
      if (!ingredient) return false;

      // Check if meal already contains this ingredient
      const alreadyHasIngredient = meal.ingredients?.some((ing: string) =>
        ing.toLowerCase().includes(hero.toLowerCase())
      );
      if (alreadyHasIngredient) return false;

      // Check if ingredient context matches meal needs
      const mealTitle = (meal.title || meal.name || '').toLowerCase();
      const mealIngredients = (meal.ingredients || []).join(' ').toLowerCase();

      // Basic compatibility check
      if (ingredient.usage_contexts.includes('protein') && 
          (mealTitle.includes('salad') || mealIngredients.includes('protein'))) {
        return true;
      }

      if (ingredient.usage_contexts.includes('vegetable') &&
          (!mealIngredients.includes(hero) && mealIngredients.length < 8)) {
        return true;
      }

      if (ingredient.usage_contexts.includes('aromatics') &&
          !mealIngredients.includes('onion') && !mealIngredients.includes('garlic')) {
        return true;
      }

      return false;
    });
  }

  private canEnhanceMealWithIngredient(meal: any, ingredient: HeroIngredient): boolean {
    // Check if adding this ingredient makes sense for the meal
    const mealIngredients = (meal.ingredients || []).join(' ').toLowerCase();
    
    // Don't add if already present
    if (mealIngredients.includes(ingredient.name.toLowerCase())) {
      return false;
    }

    // Don't overwhelm the meal with too many ingredients
    if (meal.ingredients && meal.ingredients.length > 12) {
      return false;
    }

    return true;
  }

  private applyHeroIngredientEnhancement(
    meal: any,
    ingredient: HeroIngredient
  ): { applied: boolean; description: string } {
    if (!meal.ingredients) meal.ingredients = [];
    if (!meal.instructions) meal.instructions = [];

    const originalIngredientCount = meal.ingredients.length;
    
    // Add the hero ingredient appropriately
    switch (ingredient.usage_contexts[0]) {
      case 'protein':
        meal.ingredients.push(ingredient.name);
        meal.instructions.push(`Add ${ingredient.name} as protein component.`);
        break;
        
      case 'vegetable':
        meal.ingredients.push(ingredient.name);
        meal.instructions.push(`Include ${ingredient.name} for added nutrition and flavor.`);
        break;
        
      case 'aromatics':
        meal.ingredients.unshift(ingredient.name); // Add at beginning for aromatics
        if (meal.instructions.length > 0) {
          meal.instructions[0] = `Start by cooking ${ingredient.name}, then ${meal.instructions[0].toLowerCase()}`;
        } else {
          meal.instructions.push(`Cook ${ingredient.name} as aromatic base.`);
        }
        break;
        
      default:
        meal.ingredients.push(ingredient.name);
        meal.instructions.push(`Incorporate ${ingredient.name} as needed.`);
    }

    const enhanced = meal.ingredients.length > originalIngredientCount;
    const description = enhanced ? 
      `Added ${ingredient.name} as ${ingredient.usage_contexts[0]}` : 
      'No enhancement applied';

    return { applied: enhanced, description };
  }

  private generateUsageRecommendations(
    targetAchievement: Record<string, { target: number; actual: number; percentage: number }>,
    usageStats: Record<string, { count: number; meals: string[] }>
  ): string[] {
    const recommendations: string[] = [];

    Object.entries(targetAchievement).forEach(([ingredient, achievement]) => {
      if (achievement.percentage < 75) {
        recommendations.push(
          `Increase ${ingredient} usage: currently ${achievement.actual}/${achievement.target} meals (${achievement.percentage}%)`
        );
      } else if (achievement.percentage > 125) {
        recommendations.push(
          `Consider reducing ${ingredient} usage: currently ${achievement.actual}/${achievement.target} meals (${achievement.percentage}%)`
        );
      }
    });

    const totalUsage = Object.values(usageStats).reduce((sum, stat) => sum + stat.count, 0);
    const averageUsage = totalUsage / Object.keys(usageStats).length;
    
    if (averageUsage < 2.5) {
      recommendations.push('Overall hero ingredient usage is low - consider featuring them more prominently');
    } else if (averageUsage > 4.5) {
      recommendations.push('Hero ingredients may be overused - ensure variety with other ingredients');
    }

    if (recommendations.length === 0) {
      recommendations.push('Hero ingredient usage is well-balanced across the meal plan');
    }

    return recommendations;
  }
}