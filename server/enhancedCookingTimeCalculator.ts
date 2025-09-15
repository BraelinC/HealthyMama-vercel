/**
 * Enhanced Cooking Time Calculator
 * Provides realistic time estimates with prep/active/passive time breakdown
 */

import { CookingTimeFactors, DifficultyLevel } from './recipeIntelligenceTypes';

export class EnhancedCookingTimeCalculator {
  
  /**
   * Calculate total cooking time with detailed breakdown
   */
  calculateTotalTime(factors: CookingTimeFactors, complexity: number): {
    totalTime: number;
    prepTime: number;
    activeTime: number;
    passiveTime: number;
    breakdown: string[];
  } {
    
    const difficultyMultiplier = this.getDifficultyMultiplier(complexity);
    
    // Calculate each phase
    const prepTime = (
      factors.prepWork.chopping + 
      factors.prepWork.mixing + 
      factors.prepWork.setup
    ) * difficultyMultiplier;
    
    const activeTime = (
      factors.activeTime.cooking + 
      factors.activeTime.monitoring
    ) * difficultyMultiplier;
    
    // Passive time not affected by skill level
    const passiveTime = 
      factors.passiveTime.baking + 
      factors.passiveTime.simmering + 
      factors.passiveTime.resting;
    
    const marinatingTime = factors.prepWork.marinating; // Separate from active prep
    
    const totalTime = prepTime + activeTime + passiveTime;
    
    const breakdown = this.generateTimeBreakdown(factors, difficultyMultiplier);
    
    return {
      totalTime: Math.round(totalTime),
      prepTime: Math.round(prepTime),
      activeTime: Math.round(activeTime),
      passiveTime: Math.round(passiveTime),
      breakdown
    };
  }
  
  /**
   * Get difficulty multiplier for time calculations with 0.5 increment support
   * More conservative multipliers for realistic timing
   */
  private getDifficultyMultiplier(complexity: number): number {
    const multiplierMap: Record<number, number> = {
      1.0: 1.0,
      1.5: 1.025,
      2.0: 1.05,
      2.5: 1.075,
      3.0: 1.1,
      3.5: 1.15,
      4.0: 1.2,
      4.5: 1.25,
      5.0: 1.3
    };
    
    // Return exact match or interpolate between closest values
    if (multiplierMap[complexity]) {
      return multiplierMap[complexity];
    }
    
    // Find closest values for interpolation
    const levels = Object.keys(multiplierMap).map(Number).sort((a, b) => a - b);
    const lowerLevel = levels.filter(level => level <= complexity).pop() || 1.0;
    const upperLevel = levels.filter(level => level >= complexity)[0] || 5.0;
    
    if (lowerLevel === upperLevel) {
      return multiplierMap[lowerLevel];
    }
    
    // Linear interpolation
    const ratio = (complexity - lowerLevel) / (upperLevel - lowerLevel);
    const lowerMultiplier = multiplierMap[lowerLevel];
    const upperMultiplier = multiplierMap[upperLevel];
    
    return lowerMultiplier + ratio * (upperMultiplier - lowerMultiplier);
  }
  
  /**
   * Generate detailed time breakdown
   */
  private generateTimeBreakdown(factors: CookingTimeFactors, multiplier: number): string[] {
    const breakdown: string[] = [];
    
    if (factors.prepWork.chopping > 0) {
      breakdown.push(`Chopping: ${Math.round(factors.prepWork.chopping * multiplier)}min`);
    }
    if (factors.prepWork.mixing > 0) {
      breakdown.push(`Mixing/Prep: ${Math.round(factors.prepWork.mixing * multiplier)}min`);
    }
    if (factors.prepWork.setup > 0) {
      breakdown.push(`Setup: ${Math.round(factors.prepWork.setup * multiplier)}min`);
    }
    if (factors.activeTime.cooking > 0) {
      breakdown.push(`Active Cooking: ${Math.round(factors.activeTime.cooking * multiplier)}min`);
    }
    if (factors.activeTime.monitoring > 0) {
      breakdown.push(`Monitoring: ${Math.round(factors.activeTime.monitoring * multiplier)}min`);
    }
    if (factors.passiveTime.baking > 0) {
      breakdown.push(`Baking: ${factors.passiveTime.baking}min`);
    }
    if (factors.passiveTime.simmering > 0) {
      breakdown.push(`Simmering: ${factors.passiveTime.simmering}min`);
    }
    if (factors.passiveTime.resting > 0) {
      breakdown.push(`Resting: ${factors.passiveTime.resting}min`);
    }
    if (factors.prepWork.marinating > 0) {
      breakdown.push(`Marinating: ${factors.prepWork.marinating}min (can be done ahead)`);
    }
    
    return breakdown;
  }
  
  /**
   * Estimate time factors from recipe analysis
   */
  estimateFromRecipeDescription(
    description: string, 
    ingredients: string[], 
    instructions: string[],
    mealType: string = 'dinner'
  ): CookingTimeFactors {
    
    const factors: CookingTimeFactors = {
      prepWork: { chopping: 0, marinating: 0, mixing: 0, setup: 0 },
      activeTime: { cooking: 0, monitoring: 0 },
      passiveTime: { baking: 0, simmering: 0, resting: 0 }
    };
    
    // Estimate chopping time based on vegetables
    factors.prepWork.chopping = this.estimateChoppingTime(ingredients);
    
    // Estimate based on cooking methods mentioned
    factors.prepWork.marinating = this.estimateMarinatingTime(description, instructions);
    factors.passiveTime.baking = this.estimateBakingTime(description, instructions);
    factors.passiveTime.simmering = this.estimateSimmeringTime(description, instructions);
    factors.passiveTime.resting = this.estimateRestingTime(description, instructions);
    
    // Estimate active cooking time
    factors.activeTime.cooking = this.estimateActiveCookingTime(description, instructions, mealType);
    factors.activeTime.monitoring = this.estimateMonitoringTime(description, instructions);
    
    // Base times
    factors.prepWork.setup = this.getBaseSetupTime(mealType);
    factors.prepWork.mixing = this.getBaseMixingTime(ingredients.length, instructions.length);
    
    return factors;
  }
  
  /**
   * Estimate chopping time based on ingredients
   */
  private estimateChoppingTime(ingredients: string[]): number {
    let choppingTime = 0;
    
    ingredients.forEach(ingredient => {
      const ingredientLower = ingredient.toLowerCase();
      
      // Vegetables that require chopping (more realistic times)
      if (['onion', 'garlic', 'shallot'].some(v => ingredientLower.includes(v))) {
        choppingTime += 1.5; // 1.5 minutes per aromatics
      }
      if (['carrot', 'celery', 'pepper', 'mushroom'].some(v => ingredientLower.includes(v))) {
        choppingTime += 2; // 2 minutes per medium veg
      }
      if (['tomato', 'potato', 'zucchini', 'eggplant'].some(v => ingredientLower.includes(v))) {
        choppingTime += 2.5; // 2.5 minutes per large veg
      }
      if (['herbs', 'parsley', 'cilantro', 'basil'].some(h => ingredientLower.includes(h))) {
        choppingTime += 0.5; // 0.5 minute per herb
      }
      if (['ginger', 'jalapeño', 'chili'].some(s => ingredientLower.includes(s))) {
        choppingTime += 1; // 1 minute per spice/hot ingredient
      }
    });
    
    return Math.min(choppingTime, 15); // Cap at 15 minutes
  }
  
  /**
   * Estimate marinating time from recipe text
   */
  private estimateMarinatingTime(description: string, instructions: string[]): number {
    const text = (description + ' ' + instructions.join(' ')).toLowerCase();
    
    if (text.includes('overnight') || text.includes('24 hour')) return 720; // 12 hours
    if (text.includes('4 hour') || text.includes('4-hour')) return 240;
    if (text.includes('2 hour') || text.includes('2-hour')) return 120;
    if (text.includes('1 hour') || text.includes('1-hour')) return 60;
    if (text.includes('30 min') || text.includes('half hour')) return 30;
    if (text.includes('marinate') || text.includes('marinade')) return 30; // Default
    
    return 0;
  }
  
  /**
   * Estimate baking time
   */
  private estimateBakingTime(description: string, instructions: string[]): number {
    const text = (description + ' ' + instructions.join(' ')).toLowerCase();
    
    // Look for specific time mentions
    const bakingTimeMatch = text.match(/bake.*?(\d+)\s*(?:min|minute)/);
    if (bakingTimeMatch) {
      return parseInt(bakingTimeMatch[1]);
    }
    
    // Look for oven temperature as indicator
    if (text.includes('oven') || text.includes('bake')) {
      if (text.includes('casserole') || text.includes('roast')) return 45;
      if (text.includes('cookie') || text.includes('muffin')) return 15;
      if (text.includes('bread') || text.includes('cake')) return 30;
      return 25; // Default baking time
    }
    
    return 0;
  }
  
  /**
   * Estimate simmering time
   */
  private estimateSimmeringTime(description: string, instructions: string[]): number {
    const text = (description + ' ' + instructions.join(' ')).toLowerCase();
    
    const simmerTimeMatch = text.match(/simmer.*?(\d+)\s*(?:min|minute)/);
    if (simmerTimeMatch) {
      return parseInt(simmerTimeMatch[1]);
    }
    
    if (text.includes('simmer') || text.includes('reduce')) {
      if (text.includes('sauce') || text.includes('reduction')) return 10;
      if (text.includes('soup') || text.includes('stew')) return 20;
      return 15; // Default simmer time
    }
    
    return 0;
  }
  
  /**
   * Estimate resting time
   */
  private estimateRestingTime(description: string, instructions: string[]): number {
    const text = (description + ' ' + instructions.join(' ')).toLowerCase();
    
    if (text.includes('rest') || text.includes('cool') || text.includes('set aside')) {
      if (text.includes('meat') || text.includes('steak')) return 5; // Meat resting
      if (text.includes('dough') || text.includes('bread')) return 15; // Dough rising
      return 3; // General resting
    }
    
    return 0;
  }
  
  /**
   * Estimate active cooking time
   */
  private estimateActiveCookingTime(description: string, instructions: string[], mealType: string): number {
    const text = (description + ' ' + instructions.join(' ')).toLowerCase();
    const stepCount = instructions.length;
    
    let baseTime = 8; // Base cooking time (reduced)
    
    // Adjust for meal type
    if (mealType === 'breakfast') baseTime = 3;
    if (mealType === 'lunch') baseTime = 6;
    if (mealType === 'dinner') baseTime = 10;
    
    // Add time for cooking methods (more conservative)
    if (text.includes('sauté') || text.includes('fry')) baseTime += 3;
    if (text.includes('grill') || text.includes('roast')) baseTime += 5;
    if (text.includes('braise') || text.includes('stew')) baseTime += 8;
    if (text.includes('sauce') && text.includes('from scratch')) baseTime += 5;
    
    // Add time for complexity (number of steps) - reduced
    baseTime += Math.max(0, stepCount - 4) * 1; // 1 min per extra step beyond 4
    
    return Math.min(baseTime, 30); // Cap at 30 minutes active time
  }
  
  /**
   * Estimate monitoring time
   */
  private estimateMonitoringTime(description: string, instructions: string[]): number {
    const text = (description + ' ' + instructions.join(' ')).toLowerCase();
    
    let monitoringTime = 0;
    
    // Add time for techniques requiring attention
    if (text.includes('stir frequently') || text.includes('stir occasionally')) monitoringTime += 3;
    if (text.includes('watch carefully') || text.includes('don\'t burn')) monitoringTime += 5;
    if (text.includes('temperature') || text.includes('thermometer')) monitoringTime += 2;
    if (text.includes('reduce') || text.includes('thicken')) monitoringTime += 3;
    
    return Math.min(monitoringTime, 15); // Cap at 15 minutes
  }
  
  /**
   * Get base setup time by meal type
   */
  private getBaseSetupTime(mealType: string): number {
    const setupTimes = {
      'breakfast': 2,
      'lunch': 3,
      'dinner': 4,
      'snack': 1
    };
    
    return setupTimes[mealType as keyof typeof setupTimes] || 3;
  }
  
  /**
   * Get base mixing time
   */
  private getBaseMixingTime(ingredientCount: number, stepCount: number): number {
    // More ingredients and steps = more mixing
    const baseTime = Math.min(ingredientCount / 3, 5); // 1 min per 3 ingredients, cap at 5
    const stepTime = Math.min(stepCount / 2, 3); // 0.5 min per step, cap at 3
    
    return Math.round(baseTime + stepTime);
  }
  
  /**
   * Create time factors for a specific meal type with base estimates
   */
  createBaseMealTimeFactors(mealType: string, complexity: number): CookingTimeFactors {
    const baseTimes: Record<string, CookingTimeFactors> = {
      breakfast: {
        prepWork: { chopping: 2, marinating: 0, mixing: 2, setup: 1 },
        activeTime: { cooking: 5, monitoring: 1 },
        passiveTime: { baking: 0, simmering: 0, resting: 0 }
      },
      lunch: {
        prepWork: { chopping: 4, marinating: 0, mixing: 3, setup: 2 },
        activeTime: { cooking: 8, monitoring: 2 },
        passiveTime: { baking: 0, simmering: 3, resting: 0 }
      },
      dinner: {
        prepWork: { chopping: 6, marinating: 0, mixing: 3, setup: 2 },
        activeTime: { cooking: 12, monitoring: 3 },
        passiveTime: { baking: 8, simmering: 5, resting: 2 }
      },
      snack: {
        prepWork: { chopping: 0, marinating: 0, mixing: 1, setup: 1 },
        activeTime: { cooking: 2, monitoring: 0 },
        passiveTime: { baking: 0, simmering: 0, resting: 0 }
      }
    };
    
    const base = baseTimes[mealType] || baseTimes.dinner;
    
    // More conservative complexity adjustment
    const complexityMultiplier = 0.9 + (complexity - 1) * 0.05; // 0.9 to 1.1 range
    
    return {
      prepWork: {
        chopping: Math.round(base.prepWork.chopping * complexityMultiplier),
        marinating: base.prepWork.marinating,
        mixing: Math.round(base.prepWork.mixing * complexityMultiplier),
        setup: Math.round(base.prepWork.setup * complexityMultiplier)
      },
      activeTime: {
        cooking: Math.round(base.activeTime.cooking * complexityMultiplier),
        monitoring: Math.round(base.activeTime.monitoring * complexityMultiplier)
      },
      passiveTime: {
        baking: Math.round(base.passiveTime.baking * complexityMultiplier),
        simmering: Math.round(base.passiveTime.simmering * complexityMultiplier),
        resting: base.passiveTime.resting
      }
    };
  }
}