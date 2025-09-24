/**
 * Weight-Based Meal Planning System - Main Engine
 * 
 * Implements the generalized meal planning prompt system where weights represent
 * decision priorities for resolving conflicts between objectives. Most meals
 * satisfy multiple objectives simultaneously, with mandatory dietary restrictions
 * taking absolute precedence.
 */

export interface GoalWeights {
  cost: number;        // Save money priority (0-1)
  health: number;      // Nutrition/wellness priority (0-1) 
  cultural: number;    // Cultural cuisine priority (0-1)
  variety: number;     // Meal diversity priority (0-1)
  time: number;        // Quick/easy meal priority (0-1)
}

export interface SimplifiedUserProfile {
  // Mandatory (100% compliance)
  dietaryRestrictions: string[];
  
  // Weight-based priorities
  goalWeights: GoalWeights;
  
  // Basic info
  culturalBackground: string[];
  familySize: number;
  availableIngredients?: string[];
}

export interface MealPlanRequest {
  profile: SimplifiedUserProfile;
  numDays: number;
  mealsPerDay: number;
  maxCookTime?: number;
  maxDifficulty?: number;
}

export interface WeightBasedMeal {
  id: string;
  title: string;
  description: string;
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
  
  // Weight-based metadata
  objectiveOverlap: string[];      // Which objectives this meal satisfies
  heroIngredients: string[];       // Which hero ingredients used
  culturalSource?: string;         // If from predetermined cultural meals
  weightSatisfaction: {            // How well it satisfies each weight
    cost: number;
    health: number;
    cultural: number;
    variety: number;
    time: number;
  };
  adaptationNotes?: string[];      // If meal was adapted from predetermined
}

export class WeightBasedMealPlanner {
  private smartCulturalSelector: any;  // Will be injected
  private predeterminedMealLibrary: any;  // Will be injected
  private mealAdaptationEngine: any;   // Will be injected
  private heroIngredientManager: any;  // Will be injected

  constructor(dependencies?: {
    smartCulturalSelector?: any;
    predeterminedMealLibrary?: any;
    mealAdaptationEngine?: any;
    heroIngredientManager?: any;
  }) {
    // Initialize with provided dependencies or create real implementations
    this.smartCulturalSelector = dependencies?.smartCulturalSelector;
    this.predeterminedMealLibrary = dependencies?.predeterminedMealLibrary;
    this.mealAdaptationEngine = dependencies?.mealAdaptationEngine;
    this.heroIngredientManager = dependencies?.heroIngredientManager;
    
    // Lazy load real implementations if not provided
    if (!this.smartCulturalSelector) {
      import('./SmartCulturalSelector').then(module => {
        this.smartCulturalSelector = new module.SmartCulturalSelector();
      }).catch(() => {
        this.smartCulturalSelector = new MockCulturalSelector();
      });
    }
    
    if (!this.mealAdaptationEngine) {
      import('./MealAdaptationEngine').then(module => {
        this.mealAdaptationEngine = new module.MealAdaptationEngine();
      }).catch(() => {
        this.mealAdaptationEngine = new MockAdaptationEngine();
      });
    }
    
    // Use mock implementations for missing components
    if (!this.predeterminedMealLibrary) {
      this.predeterminedMealLibrary = new MockMealLibrary();
    }
    if (!this.heroIngredientManager) {
      this.heroIngredientManager = new MockHeroIngredientManager();
    }
  }

  /**
   * Generate complete meal plan using weight-based decision system
   */
  async generateMealPlan(request: MealPlanRequest): Promise<{
    success: boolean;
    mealPlan: any;
    metadata: {
      culturalMealsUsed: number;
      heroIngredientsSelected: string[];
      averageObjectiveOverlap: number;
      weightSatisfactionScores: GoalWeights;
      generationStrategy: string;
    };
  }> {
    const startTime = Date.now();
    console.log('🚀 Starting weight-based meal plan generation');
    console.log('Profile weights:', request.profile.goalWeights);

    try {
      // Step 1: Initialize planning context
      const planningContext = await this.initializePlanningContext(request);
      
      // Step 2: Generate meal slots using weight-based logic
      const mealPlan = await this.generateMealSlots(request, planningContext);
      
      // Step 3: Validate and optimize the plan
      const optimizedPlan = await this.validateAndOptimizePlan(mealPlan, request);
      
      // Step 4: Generate metadata and shopping list
      const finalPlan = await this.finalizeMealPlan(optimizedPlan, planningContext);

      const metadata = {
        culturalMealsUsed: planningContext.culturalMealsUsed,
        heroIngredientsSelected: planningContext.heroIngredients,
        averageObjectiveOverlap: this.calculateAverageObjectiveOverlap(finalPlan),
        weightSatisfactionScores: this.calculateWeightSatisfaction(finalPlan, request.profile.goalWeights),
        generationStrategy: 'weight-based-with-cultural-integration',
        processingTimeMs: Date.now() - startTime
      };

      console.log('✅ Weight-based meal plan generated successfully');
      console.log(`Cultural meals used: ${metadata.culturalMealsUsed}/${this.calculateOptimalCulturalMealCount(request)}`);
      console.log(`Hero ingredients: ${metadata.heroIngredientsSelected.join(', ')}`);

      return {
        success: true,
        mealPlan: finalPlan,
        metadata
      };

    } catch (error) {
      console.error('❌ Weight-based meal plan generation failed:', error);
      return {
        success: false,
        mealPlan: null,
        metadata: {
          culturalMealsUsed: 0,
          heroIngredientsSelected: [],
          averageObjectiveOverlap: 0,
          weightSatisfactionScores: { cost: 0, health: 0, cultural: 0, variety: 0, time: 0 },
          generationStrategy: 'failed',
          error: error.message
        }
      };
    }
  }

  /**
   * Initialize planning context with hero ingredients and cultural meal analysis
   */
  private async initializePlanningContext(request: MealPlanRequest) {
    const totalMeals = request.numDays * request.mealsPerDay;
    
    // Select hero ingredients based on cultural background and cost priority
    const heroIngredients = await this.heroIngredientManager.selectHeroIngredients(
      request.profile.culturalBackground,
      request.profile.availableIngredients,
      request.profile.goalWeights.cost
    );

    // Calculate optimal cultural meal count
    const optimalCulturalMealCount = this.calculateOptimalCulturalMealCount(request);

    // Load and filter predetermined cultural meals
    const availableCulturalMeals = await this.predeterminedMealLibrary.getCompatibleMeals(
      request.profile.culturalBackground,
      request.profile.dietaryRestrictions
    );

    return {
      totalMeals,
      heroIngredients,
      optimalCulturalMealCount,
      availableCulturalMeals,
      culturalMealsUsed: 0,
      mealsGenerated: []
    };
  }

  /**
   * Generate each meal slot using weight-based decision logic
   */
  private async generateMealSlots(request: MealPlanRequest, context: any): Promise<WeightBasedMeal[]> {
    const meals: WeightBasedMeal[] = [];
    const totalMeals = request.numDays * request.mealsPerDay;

    for (let mealIndex = 0; mealIndex < totalMeals; mealIndex++) {
      const mealSlotContext = {
        day: Math.floor(mealIndex / request.mealsPerDay) + 1,
        mealType: this.getMealType(mealIndex % request.mealsPerDay),
        slotIndex: mealIndex,
        previousMeals: meals
      };

      console.log(`Generating meal ${mealIndex + 1}/${totalMeals}: ${mealSlotContext.mealType} for day ${mealSlotContext.day}`);

      // Decide whether to use cultural meal or generate new meal
      const shouldUseCulturalMeal = this.smartCulturalSelector.shouldUseCulturalMeal(
        context,
        mealSlotContext,
        request.profile.goalWeights
      );

      let meal: WeightBasedMeal;

      if (shouldUseCulturalMeal && context.availableCulturalMeals.length > 0) {
        // Use predetermined cultural meal
        meal = await this.generateCulturalMeal(context, mealSlotContext, request);
        context.culturalMealsUsed++;
      } else {
        // Generate new meal using weight-based prompt
        meal = await this.generateNewMeal(context, mealSlotContext, request);
      }

      meals.push(meal);
    }

    return meals;
  }

  /**
   * Use predetermined cultural meal with potential adaptation
   */
  private async generateCulturalMeal(
    context: any, 
    mealSlotContext: any, 
    request: MealPlanRequest
  ): Promise<WeightBasedMeal> {
    // Select best cultural meal for this slot
    const selectedCulturalMeal = this.smartCulturalSelector.selectBestCulturalMeal(
      context.availableCulturalMeals,
      request.profile.goalWeights,
      mealSlotContext
    );

    // Check if adaptation is needed for dietary restrictions
    const adaptedMeal = await this.mealAdaptationEngine.adaptMealIfNeeded(
      selectedCulturalMeal,
      request.profile.dietaryRestrictions,
      request.profile.goalWeights
    );

    // Enhance with hero ingredients
    const enhancedMeal = await this.heroIngredientManager.enhanceWithHeroIngredients(
      adaptedMeal,
      context.heroIngredients,
      request.profile.goalWeights.cost
    );

    return {
      ...enhancedMeal,
      id: `cultural_${mealSlotContext.slotIndex}`,
      culturalSource: selectedCulturalMeal.culture,
      objectiveOverlap: this.calculateObjectiveOverlap(enhancedMeal, request.profile.goalWeights),
      weightSatisfaction: this.calculateMealWeightSatisfaction(enhancedMeal, request.profile.goalWeights)
    };
  }

  /**
   * Generate new meal using weight-based prompt system
   */
  private async generateNewMeal(
    context: any,
    mealSlotContext: any,
    request: MealPlanRequest
  ): Promise<WeightBasedMeal> {
    // Build weight-based prompt using your improved system
    const prompt = this.buildWeightBasedPrompt(
      request.profile.goalWeights,
      context.heroIngredients,
      mealSlotContext,
      request.profile.dietaryRestrictions,
      request.profile.familySize
    );

    console.log('Generated prompt for new meal:', prompt.substring(0, 200) + '...');

    // Call AI generation (this would integrate with your existing AI service)
    const generatedMeal = await this.callAIMealGeneration(prompt, request);

    // Validate and enhance the generated meal
    const validatedMeal = await this.validateGeneratedMeal(generatedMeal, request, context);

    return {
      ...validatedMeal,
      id: `generated_${mealSlotContext.slotIndex}`,
      objectiveOverlap: this.calculateObjectiveOverlap(validatedMeal, request.profile.goalWeights),
      weightSatisfaction: this.calculateMealWeightSatisfaction(validatedMeal, request.profile.goalWeights)
    };
  }

  /**
   * Build weight-based prompt using the generalized system
   */
  private buildWeightBasedPrompt(
    weights: GoalWeights,
    heroIngredients: string[],
    mealContext: any,
    dietaryRestrictions: string[],
    familySize: number
  ): string {
    let prompt = `🏆 Generate a meal using weight-based decision priorities. You are an expert meal planner creating a ${mealContext.mealType} for ${familySize} people.\n\n`;

    // Core concept explanation
    prompt += `🎯 CORE CONCEPT:\n`;
    prompt += `Weights are decision priorities for resolving conflicts, not meal quotas.\n`;
    prompt += `Most meals should satisfy multiple objectives simultaneously.\n`;
    prompt += `Dietary restrictions are NON-NEGOTIABLE and apply to 100% of the meal.\n\n`;

    // Mandatory dietary restrictions (100% compliance)
    if (dietaryRestrictions.length > 0) {
      prompt += `🚫 MANDATORY DIETARY RESTRICTIONS (100% compliance required):\n`;
      dietaryRestrictions.forEach(restriction => {
        prompt += `- ${restriction}\n`;
      });
      prompt += `ALL ingredients and preparations must be safe for these restrictions.\n\n`;
    }

    // Weight-based priorities
    prompt += `⚖️ WEIGHT-BASED PRIORITIES (use to resolve conflicts):\n`;
    
    if (weights.cost >= 0.7) {
      prompt += `- VERY HIGH PRIORITY (${(weights.cost * 100).toFixed(0)}%): Cost savings through smart ingredient choices\n`;
    } else if (weights.cost >= 0.5) {
      prompt += `- HIGH PRIORITY (${(weights.cost * 100).toFixed(0)}%): Balance cost and quality\n`;
    }

    if (weights.health >= 0.7) {
      prompt += `- VERY HIGH PRIORITY (${(weights.health * 100).toFixed(0)}%): Nutritional density and balanced macros\n`;
    } else if (weights.health >= 0.5) {
      prompt += `- HIGH PRIORITY (${(weights.health * 100).toFixed(0)}%): Healthy ingredients and preparation\n`;
    }

    if (weights.cultural >= 0.5) {
      prompt += `- CULTURAL PRIORITY (${(weights.cultural * 100).toFixed(0)}%): Incorporate cultural flavors and techniques\n`;
    }

    if (weights.time >= 0.7) {
      prompt += `- VERY HIGH PRIORITY (${(weights.time * 100).toFixed(0)}%): Minimize prep and cooking time\n`;
    } else if (weights.time >= 0.5) {
      prompt += `- HIGH PRIORITY (${(weights.time * 100).toFixed(0)}%): Keep preparation practical\n`;
    }

    if (weights.variety >= 0.5) {
      prompt += `- VARIETY PRIORITY (${(weights.variety * 100).toFixed(0)}%): Use diverse ingredients and techniques\n`;
    }

    // Hero ingredient strategy
    if (heroIngredients.length > 0) {
      prompt += `\n🎯 HERO INGREDIENT STRATEGY:\n`;
      prompt += `Incorporate 2-3 of these versatile ingredients: ${heroIngredients.join(', ')}\n`;
      prompt += `These ingredients work across cuisines and maximize cost savings.\n`;
    }

    // Objective overlap requirement
    prompt += `\n🎯 OBJECTIVE OVERLAP (CRITICAL):\n`;
    prompt += `This meal should demonstrate meaningful overlap of objectives:\n`;
    prompt += `- Meets dietary restrictions (mandatory)\n`;
    prompt += `- Satisfies at least 2-3 high-priority weight goals\n`;
    prompt += `- Uses practical cooking methods for the time priority\n`;
    prompt += `- Balances cost with nutritional value\n\n`;

    // Implementation guidance
    prompt += `📋 IMPLEMENTATION:\n`;
    prompt += `1. Start with a base recipe that naturally satisfies multiple objectives\n`;
    prompt += `2. Modify ingredients/techniques based on weight priorities\n`;
    prompt += `3. When objectives conflict, use weights to guide decisions\n`;
    prompt += `4. Ensure the final meal is practical and appealing\n\n`;

    // JSON format requirement
    prompt += `RETURN FORMAT: Valid JSON with this structure:\n`;
    prompt += `{\n`;
    prompt += `  "title": "Meal Name",\n`;
    prompt += `  "description": "Brief description",\n`;
    prompt += `  "ingredients": ["ingredient1", "ingredient2"],\n`;
    prompt += `  "instructions": ["step1", "step2"],\n`;
    prompt += `  "nutrition": {"calories": 450, "protein_g": 25, "carbs_g": 35, "fat_g": 18},\n`;
    prompt += `  "cook_time_minutes": 25,\n`;
    prompt += `  "difficulty": 2.5,\n`;
    prompt += `  "objective_satisfaction": ["cost_effective", "healthy", "quick"],\n`;
    prompt += `  "weight_rationale": "Brief explanation of how weights guided decisions"\n`;
    prompt += `}`;

    return prompt;
  }

  // Helper methods
  private calculateOptimalCulturalMealCount(request: MealPlanRequest): number {
    const totalMeals = request.numDays * request.mealsPerDay;
    const culturalWeight = request.profile.goalWeights.cultural;
    
    // 20-35% optimal range with weight-based adjustment
    const basePortion = totalMeals * 0.25; // 25% baseline
    const weightAdjustment = culturalWeight * 0.15; // Up to 15% more if high weight
    const optimalCount = Math.ceil(basePortion + (basePortion * weightAdjustment));
    
    // Clamp to sensible ranges based on your specification
    if (totalMeals <= 7) return Math.min(Math.max(optimalCount, 1), 3);
    if (totalMeals <= 14) return Math.min(Math.max(optimalCount, 2), 4);
    return Math.min(Math.max(optimalCount, 3), 6);
  }

  private getMealType(mealIndex: number): string {
    const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'];
    return mealTypes[mealIndex] || 'meal';
  }

  private calculateObjectiveOverlap(meal: any, weights: GoalWeights): string[] {
    // Calculate which objectives this meal satisfies
    const satisfied = [];
    // Implementation would analyze meal properties against weights
    return satisfied;
  }

  private calculateMealWeightSatisfaction(meal: any, weights: GoalWeights): GoalWeights {
    // Calculate how well this meal satisfies each weight priority
    return {
      cost: 0.8, // Placeholder - would analyze actual meal properties
      health: 0.7,
      cultural: 0.6,
      variety: 0.9,
      time: 0.8
    };
  }

  private calculateAverageObjectiveOverlap(mealPlan: WeightBasedMeal[]): number {
    const totalOverlaps = mealPlan.reduce((sum, meal) => sum + meal.objectiveOverlap.length, 0);
    return totalOverlaps / mealPlan.length;
  }

  private calculateWeightSatisfaction(mealPlan: WeightBasedMeal[], weights: GoalWeights): GoalWeights {
    // Calculate average satisfaction across all meals
    return {
      cost: 0.8, // Placeholder - would calculate from actual meal data
      health: 0.7,
      cultural: 0.6,
      variety: 0.9,
      time: 0.8
    };
  }

  // Placeholder methods for integration points
  private async validateAndOptimizePlan(mealPlan: WeightBasedMeal[], request: MealPlanRequest): Promise<WeightBasedMeal[]> {
    // Validate the plan meets all requirements and optimize if needed
    return mealPlan;
  }

  private async finalizeMealPlan(mealPlan: WeightBasedMeal[], context: any): Promise<any> {
    // Generate shopping list, prep tips, and final formatting
    return {
      meal_plan: this.formatMealPlanForClient(mealPlan),
      shopping_list: this.generateShoppingList(mealPlan),
      prep_tips: this.generatePrepTips(mealPlan),
      hero_ingredients: context.heroIngredients
    };
  }

  private formatMealPlanForClient(meals: WeightBasedMeal[]): any {
    // Format meals into day structure expected by client
    const formatted: any = {};
    meals.forEach((meal, index) => {
      const day = Math.floor(index / 3) + 1; // Assuming 3 meals per day
      const mealType = this.getMealType(index % 3);
      
      if (!formatted[`day_${day}`]) {
        formatted[`day_${day}`] = {};
      }
      
      formatted[`day_${day}`][mealType] = {
        title: meal.title,
        description: meal.description,
        ingredients: meal.ingredients,
        instructions: meal.instructions,
        nutrition: meal.nutrition,
        cook_time_minutes: meal.cook_time_minutes,
        difficulty: meal.difficulty
      };
    });
    
    return formatted;
  }

  private generateShoppingList(meals: WeightBasedMeal[]): string[] {
    const allIngredients = meals.flatMap(meal => meal.ingredients);
    return [...new Set(allIngredients)];
  }

  private generatePrepTips(meals: WeightBasedMeal[]): string[] {
    return [
      "Group similar prep tasks together to save time",
      "Prep hero ingredients in batches for multiple meals",
      "Focus on weight-based priorities when making substitutions"
    ];
  }

  private async callAIMealGeneration(prompt: string, request: MealPlanRequest): Promise<any> {
    console.log('Calling AI generation with weight-based prompt');
    
    try {
      // Use OpenAI for meal generation - integrating with existing system
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are a weight-based meal planning expert. Generate a single meal following the specific priority weights. Always return valid JSON in the exact format requested.`
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.8,
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error('No content received from OpenAI');
      }

      // Parse the JSON response
      const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
      const mealData = JSON.parse(cleanedContent);
      
      return mealData;
      
    } catch (error) {
      console.error('AI meal generation failed:', error);
      // Return a fallback meal
      return {
        title: "Simple Balanced Meal",
        description: "A nutritious and balanced meal option",
        ingredients: ["protein source", "vegetables", "whole grains", "healthy fats"],
        instructions: ["Prepare protein", "Cook vegetables", "Serve with grains"],
        nutrition: { calories: 450, protein_g: 25, carbs_g: 35, fat_g: 18 },
        cook_time_minutes: 25,
        difficulty: 2,
        objective_satisfaction: ["health", "time"],
        weight_rationale: "Fallback meal designed for balanced nutrition and quick preparation"
      };
    }
  }

  private async validateGeneratedMeal(meal: any, request: MealPlanRequest, context: any): Promise<any> {
    // Validate and enhance the AI-generated meal
    console.log('Validating generated meal:', meal.title || 'Untitled');
    
    // Ensure required fields exist with defaults
    const validatedMeal = {
      title: meal.title || 'Generated Meal',
      description: meal.description || 'A delicious meal created with weight-based priorities',
      ingredients: Array.isArray(meal.ingredients) ? meal.ingredients : ['basic ingredients'],
      instructions: Array.isArray(meal.instructions) ? meal.instructions : ['prepare ingredients', 'cook meal'],
      nutrition: {
        calories: meal.nutrition?.calories || 400,
        protein_g: meal.nutrition?.protein_g || 20,
        carbs_g: meal.nutrition?.carbs_g || 30,
        fat_g: meal.nutrition?.fat_g || 15
      },
      cook_time_minutes: meal.cook_time_minutes || 30,
      difficulty: Math.min(Math.max(meal.difficulty || 2, 1), 5), // Clamp between 1-5
      
      // Weight-based specific fields
      objective_satisfaction: Array.isArray(meal.objective_satisfaction) ? meal.objective_satisfaction : ['balanced'],
      weight_rationale: meal.weight_rationale || 'Generated using weight-based priorities'
    };

    // Validate dietary restrictions compliance
    if (request.profile.dietaryRestrictions.length > 0) {
      // Use the meal adaptation engine for proper validation
      if (this.mealAdaptationEngine && this.mealAdaptationEngine.validateCompliance) {
        const compliance = this.mealAdaptationEngine.validateCompliance(
          validatedMeal,
          request.profile.dietaryRestrictions
        );
        
        if (!compliance.isCompliant) {
          console.warn('❌ Meal violates dietary restrictions:', compliance.violations);
          console.log('Attempting to adapt meal for compliance...');
          
          // Try to adapt the meal
          const adaptationResult = await this.mealAdaptationEngine.adaptMealIfNeeded(
            validatedMeal,
            request.profile.dietaryRestrictions,
            request.profile.goalWeights
          );
          
          if (adaptationResult.isAdapted) {
            console.log('✅ Meal successfully adapted:', adaptationResult.adaptations);
            return {
              ...adaptationResult.meal,
              adaptationNotes: adaptationResult.adaptations,
              dietary_compliant: true
            };
          } else {
            // If adaptation failed, mark as non-compliant
            validatedMeal.dietary_warnings = compliance.violations;
            validatedMeal.dietary_compliant = false;
          }
        } else {
          validatedMeal.dietary_compliant = true;
        }
      } else {
        // Fallback to basic compliance check
        const restrictionCompliance = this.checkDietaryCompliance(
          validatedMeal.ingredients,
          request.profile.dietaryRestrictions
        );
        
        if (!restrictionCompliance.isCompliant) {
          console.warn('Meal may not comply with dietary restrictions:', restrictionCompliance.violations);
          validatedMeal.dietary_warnings = restrictionCompliance.violations;
          validatedMeal.dietary_compliant = false;
        } else {
          validatedMeal.dietary_compliant = true;
        }
      }
    } else {
      validatedMeal.dietary_compliant = true;
    }

    // Enhance with hero ingredients if available
    if (context.heroIngredients && context.heroIngredients.length > 0) {
      const heroIngredientsUsed = validatedMeal.ingredients.filter(ingredient => 
        context.heroIngredients.some(hero => 
          ingredient.toLowerCase().includes(hero.toLowerCase())
        )
      );
      
      if (heroIngredientsUsed.length > 0) {
        validatedMeal.hero_ingredients_used = heroIngredientsUsed;
      }
    }

    return validatedMeal;
  }

  private checkDietaryCompliance(ingredients: string[], restrictions: string[]): {
    isCompliant: boolean;
    violations: string[];
  } {
    const violations: string[] = [];
    const ingredientText = ingredients.join(' ').toLowerCase();
    
    // Basic dietary restriction checking
    const restrictionChecks = {
      'vegetarian': ['meat', 'chicken', 'beef', 'pork', 'fish', 'seafood'],
      'vegan': ['meat', 'chicken', 'beef', 'pork', 'fish', 'seafood', 'dairy', 'milk', 'cheese', 'eggs'],
      'gluten-free': ['wheat', 'flour', 'bread', 'pasta', 'gluten'],
      'dairy-free': ['milk', 'cheese', 'butter', 'cream', 'yogurt'],
      'nut-free': ['nuts', 'almond', 'peanut', 'walnut', 'cashew'],
      'keto': [], // More complex validation needed
      'paleo': ['grain', 'wheat', 'rice', 'beans', 'dairy']
    };

    restrictions.forEach(restriction => {
      const restrictionKey = restriction.toLowerCase().replace(/[^a-z-]/g, '');
      const forbiddenItems = restrictionChecks[restrictionKey] || [];
      
      forbiddenItems.forEach(item => {
        if (ingredientText.includes(item)) {
          violations.push(`${restriction}: contains ${item}`);
        }
      });
    });

    return {
      isCompliant: violations.length === 0,
      violations
    };
  }
}

// Mock implementations for testing and standalone operation
class MockCulturalSelector {
  shouldUseCulturalMeal(context: any, mealSlotContext: any, weights: GoalWeights): boolean {
    // Use cultural meals when cultural weight is high
    return weights.cultural > 0.5 && context.availableCulturalMeals.length > 0;
  }

  selectBestCulturalMeal(availableMeals: any[], weights: GoalWeights, mealSlotContext: any): any {
    // Simple selection - return first available meal
    return availableMeals[0] || {
      title: "Traditional Cultural Dish",
      ingredients: ["traditional ingredients"],
      instructions: ["traditional preparation"],
      culture: "mixed"
    };
  }
}

class MockMealLibrary {
  async getCompatibleMeals(culturalBackground: string[], dietaryRestrictions: string[]): Promise<any[]> {
    // Return empty array for now - could be enhanced with real data
    return [];
  }
}

class MockAdaptationEngine {
  async adaptMealIfNeeded(meal: any, dietaryRestrictions: string[], weights: GoalWeights): Promise<any> {
    // Return meal as-is for now - could add adaptation logic
    return meal;
  }
}

class MockHeroIngredientManager {
  async selectHeroIngredients(culturalBackground: string[], availableIngredients: string[] = [], costWeight: number): Promise<string[]> {
    // Return basic hero ingredients based on cost priority
    const basicHeroIngredients = [
      'rice', 'beans', 'chicken', 'eggs', 'potatoes', 'onions', 'garlic', 'olive oil'
    ];
    
    // Return more ingredients if cost is a high priority
    const count = costWeight > 0.7 ? 6 : costWeight > 0.5 ? 4 : 2;
    return basicHeroIngredients.slice(0, count);
  }

  async enhanceWithHeroIngredients(meal: any, heroIngredients: string[], costWeight: number): Promise<any> {
    // Add hero ingredients to meal if not already present
    const enhancedMeal = { ...meal };
    
    heroIngredients.forEach(hero => {
      if (!meal.ingredients.some((ing: string) => ing.toLowerCase().includes(hero.toLowerCase()))) {
        enhancedMeal.ingredients.push(hero);
      }
    });
    
    return enhancedMeal;
  }
}