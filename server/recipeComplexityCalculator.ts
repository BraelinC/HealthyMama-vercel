/**
 * Recipe Complexity Calculator
 * Analyzes and scores recipe complexity based on multiple factors
 */

import { 
  RecipeComplexityFactors, 
  DifficultyLevel, 
  EQUIPMENT_COMPLEXITY, 
  TECHNIQUE_COMPLEXITY 
} from './recipeIntelligenceTypes';

export class RecipeComplexityCalculator {
  
  private difficultyLevels: DifficultyLevel[] = [
    {
      level: 1,
      description: "Beginner - Basic mixing, heating, assembly",
      timeMultiplier: 1.0,
      techniques: ['mixing', 'heating', 'assembly', 'basic_seasoning']
    },
    {
      level: 1.5,
      description: "Easy Beginner - Simple prep with basic cooking",
      timeMultiplier: 1.1,
      techniques: ['mixing', 'heating', 'basic_knife_skills', 'assembly']
    },
    {
      level: 2, 
      description: "Easy - Simple cooking methods, minimal timing",
      timeMultiplier: 1.2,
      techniques: ['sautéing', 'boiling', 'basic_knife_skills', 'layering', 'steaming']
    },
    {
      level: 2.5,
      description: "Easy-Moderate - Basic cooking with some technique",
      timeMultiplier: 1.3,
      techniques: ['sautéing', 'basic_seasoning', 'simple_grilling', 'pan_cooking']
    },
    {
      level: 3,
      description: "Moderate - Multiple steps, some technique required",
      timeMultiplier: 1.4,
      techniques: ['roasting', 'braising', 'sauce_making', 'temperature_control', 'grilling']
    },
    {
      level: 3.5,
      description: "Moderate-Advanced - Complex preparations",
      timeMultiplier: 1.55,
      techniques: ['advanced_seasoning', 'sauce_making', 'timing_coordination', 'marinating']
    },
    {
      level: 4,
      description: "Advanced - Complex techniques, precise timing",
      timeMultiplier: 1.7,
      techniques: ['emulsification', 'reduction', 'caramelization', 'precise_seasoning', 'pan_searing']
    },
    {
      level: 4.5,
      description: "Advanced-Expert - Professional techniques",
      timeMultiplier: 1.85,
      techniques: ['advanced_techniques', 'critical_timing', 'complex_preparations']
    },
    {
      level: 5,
      description: "Expert - Professional techniques, critical timing",
      timeMultiplier: 2.0,
      techniques: ['tempering', 'confit', 'molecular_techniques', 'pastry_work', 'fermentation']
    }
  ];

  /**
   * Calculate overall complexity score for a recipe with 0.5 increments
   */
  calculateComplexity(factors: RecipeComplexityFactors): number {
    let score = 0;
    
    // Base technique complexity (40% weight)
    score += factors.techniqueComplexity * 0.4;
    
    // Ingredient count factor (20% weight)
    // Scale: 1-3 ingredients = 1, 4-6 = 2, 7-10 = 3, 11-15 = 4, 16+ = 5
    const ingredientScore = this.calculateIngredientComplexity(factors.ingredientCount);
    score += ingredientScore * 0.2;
    
    // Equipment complexity (15% weight)
    const equipmentScore = this.calculateEquipmentComplexity(factors.equipmentRequired);
    score += equipmentScore * 0.15;
    
    // Timing critical factor (15% weight)
    score += factors.timingCritical ? 1.5 : 0;
    
    // Multi-step factor (10% weight)
    score += factors.multiStep ? 1.0 : 0;
    
    // Round to nearest 0.5 and ensure between 1-5
    const roundedScore = Math.round(score * 2) / 2;
    return Math.min(Math.max(roundedScore, 1), 5);
  }
  
  /**
   * Calculate ingredient complexity based on count
   */
  private calculateIngredientComplexity(count: number): number {
    if (count <= 3) return 1;
    if (count <= 6) return 2;
    if (count <= 10) return 3;
    if (count <= 15) return 4;
    return 5;
  }
  
  /**
   * Calculate equipment complexity score
   */
  private calculateEquipmentComplexity(equipment: string[]): number {
    if (equipment.length === 0) return 1;
    
    const totalComplexity = equipment.reduce((sum, item) => {
      const cleanItem = item.toLowerCase().replace(/[^a-z_]/g, '');
      return sum + (EQUIPMENT_COMPLEXITY[cleanItem] || 1);
    }, 0);
    
    const avgComplexity = totalComplexity / equipment.length;
    
    // Scale average complexity to 1-5 range
    return Math.min(Math.max(avgComplexity, 1), 5);
  }
  
  /**
   * Analyze techniques mentioned in recipe description
   */
  analyzeTechniques(description: string, ingredients: string[]): {
    techniques: string[];
    avgComplexity: number;
  } {
    const foundTechniques: string[] = [];
    const descLower = description.toLowerCase();
    
    // Check for technique keywords in description
    Object.keys(TECHNIQUE_COMPLEXITY).forEach(technique => {
      const keywords = this.getTechniqueKeywords(technique);
      if (keywords.some(keyword => descLower.includes(keyword))) {
        foundTechniques.push(technique);
      }
    });
    
    // Analyze ingredients for implied techniques
    ingredients.forEach(ingredient => {
      const impliedTechniques = this.getImpliedTechniques(ingredient);
      foundTechniques.push(...impliedTechniques);
    });
    
    // Remove duplicates
    const uniqueTechniques = [...new Set(foundTechniques)];
    
    // Calculate average complexity
    const avgComplexity = uniqueTechniques.length > 0 
      ? uniqueTechniques.reduce((sum, tech) => sum + (TECHNIQUE_COMPLEXITY[tech] || 1), 0) / uniqueTechniques.length
      : 1;
    
    return {
      techniques: uniqueTechniques,
      avgComplexity: Math.min(Math.max(avgComplexity, 1), 5)
    };
  }
  
  /**
   * Get keyword variations for technique detection
   */
  private getTechniqueKeywords(technique: string): string[] {
    const keywordMap: Record<string, string[]> = {
      'sautéing': ['sauté', 'sautéed', 'sautéing', 'pan fry'],
      'roasting': ['roast', 'roasted', 'roasting', 'bake in oven'],
      'braising': ['braise', 'braised', 'braising', 'slow cook'],
      'grilling': ['grill', 'grilled', 'grilling', 'barbecue', 'bbq'],
      'steaming': ['steam', 'steamed', 'steaming'],
      'boiling': ['boil', 'boiled', 'boiling'],
      'emulsification': ['emulsify', 'whisk until thick', 'mayonnaise', 'hollandaise'],
      'reduction': ['reduce', 'reduced', 'reducing', 'simmer until thick'],
      'caramelization': ['caramelize', 'caramelized', 'deeply golden', 'golden brown and crispy'],
      'basic_browning': ['brown', 'browned', 'browning'], // Separate from caramelization
      'tempering': ['temper', 'tempering', 'chocolate work'],
      'fermentation': ['ferment', 'fermented', 'fermentation', 'cultured'],
      'basic_knife_skills': ['chop', 'dice', 'mince'], // Basic chopping
      'advanced_knife_skills': ['julienne', 'brunoise', 'chiffonade'], // Advanced cuts
      'sauce_making': ['sauce', 'gravy', 'reduction', 'pan sauce'],
      'basic_seasoning': ['season', 'seasoning', 'salt and pepper', 'add spices']
    };
    
    return keywordMap[technique] || [technique];
  }
  
  /**
   * Get techniques implied by ingredients
   */
  private getImpliedTechniques(ingredient: string): string[] {
    const ingredientLower = ingredient.toLowerCase();
    const implications: string[] = [];
    
    // Vegetables that typically require chopping
    if (['onion', 'garlic', 'carrot', 'celery', 'pepper', 'tomato'].some(v => ingredientLower.includes(v))) {
      implications.push('basic_knife_skills');
    }
    
    // Proteins that require temperature control
    if (['chicken', 'beef', 'pork', 'fish', 'lamb'].some(p => ingredientLower.includes(p))) {
      implications.push('temperature_control');
    }
    
    // Dairy that might require emulsification
    if (['cream', 'butter', 'egg'].some(d => ingredientLower.includes(d))) {
      implications.push('emulsification');
    }
    
    return implications;
  }
  
  /**
   * Get difficulty level details with 0.5 increment support
   */
  getDifficultyLevel(complexity: number): DifficultyLevel {
    // Find the exact match or closest level
    const exactMatch = this.difficultyLevels.find(level => level.level === complexity);
    if (exactMatch) {
      return exactMatch;
    }
    
    // Find closest level if no exact match
    const closestLevel = this.difficultyLevels.reduce((closest, current) => {
      return Math.abs(current.level - complexity) < Math.abs(closest.level - complexity) 
        ? current 
        : closest;
    });
    
    return closestLevel;
  }
  
  /**
   * Estimate complexity from recipe text analysis
   */
  estimateComplexityFromText(
    description: string, 
    ingredients: string[], 
    instructions: string[]
  ): RecipeComplexityFactors {
    
    const techniqueAnalysis = this.analyzeTechniques(description, ingredients);
    
    // Analyze instructions for complexity indicators
    const instructionText = instructions.join(' ').toLowerCase();
    const stepCount = instructions.length;
    
    // Check for timing critical indicators
    const timingCritical = /precise|exactly|immediately|quickly|don't overcook|watch carefully/.test(instructionText);
    
    // Check for multi-step process
    const multiStep = stepCount > 3 || /meanwhile|while|at the same time|separately/.test(instructionText);
    
    // Estimate equipment from instructions
    const equipment = this.extractEquipmentFromInstructions(instructionText);
    
    return {
      techniqueComplexity: techniqueAnalysis.avgComplexity,
      ingredientCount: ingredients.length,
      equipmentRequired: equipment,
      timingCritical,
      multiStep,
      skillRequired: techniqueAnalysis.techniques
    };
  }
  
  /**
   * Extract equipment mentioned in instructions
   */
  private extractEquipmentFromInstructions(instructionText: string): string[] {
    const equipment: string[] = [];
    
    Object.keys(EQUIPMENT_COMPLEXITY).forEach(eq => {
      if (instructionText.includes(eq.replace('_', ' '))) {
        equipment.push(eq);
      }
    });
    
    // Common equipment mentions
    if (instructionText.includes('oven') || instructionText.includes('bake')) equipment.push('oven');
    if (instructionText.includes('pan') || instructionText.includes('skillet')) equipment.push('stovetop');
    if (instructionText.includes('blender') || instructionText.includes('blend')) equipment.push('blender');
    if (instructionText.includes('food processor') || instructionText.includes('process')) equipment.push('food_processor');
    if (instructionText.includes('grill')) equipment.push('grill');
    
    return [...new Set(equipment)];
  }
}