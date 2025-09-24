/**
 * Dietary Validation Service
 * 
 * Validates generated recipes and meal plans for dietary compliance
 * Integrates with existing dietaryCulturalConflictResolver for pattern matching
 */

import { resolveDietaryCulturalConflicts, hasQuickConflict, CONFLICT_PATTERNS } from './dietaryCulturalConflictResolver';

export interface DietaryValidationResult {
  isCompliant: boolean;
  violations: DietaryViolation[];
  suggestions: string[];
  confidence: number;
  validationTime: number;
}

export interface DietaryViolation {
  ingredient: string;
  restrictionViolated: string;
  severity: 'high' | 'medium' | 'low';
  alternativeSuggestions: string[];
  detectedIn: 'title' | 'ingredients' | 'instructions';
}

export interface MealPlanValidationResult {
  overallCompliance: number;
  totalMeals: number;
  compliantMeals: number;
  violations: Record<string, DietaryValidationResult>;
  summary: string[];
}

/**
 * Validate a single recipe for dietary compliance
 */
export async function validateRecipeDietaryCompliance(
  recipe: any,
  restrictions: string[]
): Promise<DietaryValidationResult> {
  const startTime = Date.now();
  
  if (!recipe || !restrictions || restrictions.length === 0) {
    return {
      isCompliant: true,
      violations: [],
      suggestions: [],
      confidence: 1.0,
      validationTime: Date.now() - startTime
    };
  }

  const violations: DietaryViolation[] = [];
  const suggestions: string[] = [];
  
  // Normalize restrictions
  const normalizedRestrictions = restrictions.map(r => r.toLowerCase().trim());
  
  // Check recipe title for conflicts
  if (recipe.title) {
    const titleViolations = await scanTextForViolations(
      recipe.title,
      normalizedRestrictions,
      'title'
    );
    violations.push(...titleViolations);
  }
  
  // Check ingredients list
  if (recipe.ingredients && Array.isArray(recipe.ingredients)) {
    for (const ingredient of recipe.ingredients) {
      const ingredientStr = typeof ingredient === 'string' ? ingredient : ingredient.name || '';
      const ingredientViolations = await scanTextForViolations(
        ingredientStr,
        normalizedRestrictions,
        'ingredients'
      );
      violations.push(...ingredientViolations);
    }
  }
  
  // Check instructions for hidden ingredients
  if (recipe.instructions && Array.isArray(recipe.instructions)) {
    const instructionsText = recipe.instructions.join(' ');
    const instructionViolations = await scanTextForViolations(
      instructionsText,
      normalizedRestrictions,
      'instructions'
    );
    violations.push(...instructionViolations);
  }
  
  // Generate suggestions for violations
  if (violations.length > 0) {
    const uniqueViolations = removeDuplicateViolations(violations);
    
    for (const violation of uniqueViolations) {
      if (violation.alternativeSuggestions.length > 0) {
        suggestions.push(
          `Replace "${violation.ingredient}" with ${violation.alternativeSuggestions.slice(0, 2).join(' or ')}`
        );
      }
    }
    
    // Try to get AI-powered alternatives
    try {
      const resolution = await resolveDietaryCulturalConflicts(
        recipe.title || 'dish',
        restrictions,
        [] // No cultural context for basic validation
      );
      
      if (resolution.suggestedAlternatives.length > 0) {
        suggestions.push(`Consider alternative: "${resolution.suggestedAlternatives[0].dishName}"`);
      }
    } catch (error) {
      console.warn('Error getting AI resolution suggestions:', error);
    }
  }
  
  const confidence = calculateValidationConfidence(violations, recipe);
  
  return {
    isCompliant: violations.length === 0,
    violations: removeDuplicateViolations(violations),
    suggestions,
    confidence,
    validationTime: Date.now() - startTime
  };
}

/**
 * Validate entire meal plan for dietary compliance
 */
export async function validateMealPlanDietaryCompliance(
  mealPlan: any,
  restrictions: string[]
): Promise<MealPlanValidationResult> {
  
  if (!mealPlan?.meal_plan || !restrictions || restrictions.length === 0) {
    return {
      overallCompliance: 100,
      totalMeals: 0,
      compliantMeals: 0,
      violations: {},
      summary: ['No dietary restrictions specified or no meal plan provided']
    };
  }

  const violations: Record<string, DietaryValidationResult> = {};
  let totalMeals = 0;
  let compliantMeals = 0;
  
  // Check each day and meal
  for (const dayKey in mealPlan.meal_plan) {
    const day = mealPlan.meal_plan[dayKey];
    
    for (const mealType in day) {
      const meal = day[mealType];
      totalMeals++;
      
      const mealKey = `${dayKey}_${mealType}`;
      const validation = await validateRecipeDietaryCompliance(meal, restrictions);
      
      if (!validation.isCompliant) {
        violations[mealKey] = validation;
      } else {
        compliantMeals++;
      }
    }
  }
  
  const overallCompliance = totalMeals > 0 ? Math.round((compliantMeals / totalMeals) * 100) : 100;
  
  // Generate summary
  const summary: string[] = [];
  summary.push(`${compliantMeals}/${totalMeals} meals (${overallCompliance}%) comply with dietary restrictions`);
  
  if (Object.keys(violations).length > 0) {
    const violationTypes = new Set<string>();
    Object.values(violations).forEach(v => {
      v.violations.forEach(viol => violationTypes.add(viol.restrictionViolated));
    });
    
    summary.push(`Violations found for: ${Array.from(violationTypes).join(', ')}`);
    summary.push(`Most common violations: ${getMostCommonViolations(violations)}`);
  } else {
    summary.push('All meals comply with specified dietary restrictions');
  }
  
  return {
    overallCompliance,
    totalMeals,
    compliantMeals,
    violations,
    summary
  };
}

/**
 * Quick validation check - returns boolean only
 */
export function hasQuickDietaryViolation(text: string, restrictions: string[]): boolean {
  if (!text || !restrictions || restrictions.length === 0) return false;
  
  const normalizedText = text.toLowerCase();
  const normalizedRestrictions = restrictions.map(r => r.toLowerCase());
  
  for (const restriction of normalizedRestrictions) {
    const pattern = getConflictPattern(restriction);
    if (pattern) {
      const hasConflict = pattern.conflictsWith.some(conflictItem =>
        normalizedText.includes(conflictItem.toLowerCase())
      );
      if (hasConflict) return true;
    }
  }
  
  return false;
}

/**
 * Get suggested fixes for a recipe with violations
 */
export async function getSuggestedRecipeFixes(
  recipe: any,
  validationResult: DietaryValidationResult,
  restrictions: string[]
): Promise<any> {
  
  if (validationResult.isCompliant) {
    return recipe; // No fixes needed
  }
  
  let fixedRecipe = { ...recipe };
  
  // Try to apply automatic fixes
  for (const violation of validationResult.violations) {
    if (violation.alternativeSuggestions.length > 0) {
      const bestAlternative = violation.alternativeSuggestions[0];
      
      // Replace in title
      if (violation.detectedIn === 'title' && fixedRecipe.title) {
        fixedRecipe.title = fixedRecipe.title.replace(
          new RegExp(violation.ingredient, 'gi'),
          bestAlternative
        );
      }
      
      // Replace in ingredients
      if (violation.detectedIn === 'ingredients' && fixedRecipe.ingredients) {
        fixedRecipe.ingredients = fixedRecipe.ingredients.map((ing: any) => {
          const ingredientStr = typeof ing === 'string' ? ing : ing.name || '';
          if (ingredientStr.toLowerCase().includes(violation.ingredient.toLowerCase())) {
            return typeof ing === 'string' 
              ? ingredientStr.replace(new RegExp(violation.ingredient, 'gi'), bestAlternative)
              : { ...ing, name: ingredientStr.replace(new RegExp(violation.ingredient, 'gi'), bestAlternative) };
          }
          return ing;
        });
      }
    }
  }
  
  return fixedRecipe;
}

/**
 * Core validation logic - scan text for dietary violations
 */
async function scanTextForViolations(
  text: string,
  restrictions: string[],
  location: 'title' | 'ingredients' | 'instructions'
): Promise<DietaryViolation[]> {
  
  const violations: DietaryViolation[] = [];
  const normalizedText = text.toLowerCase();
  
  for (const restriction of restrictions) {
    const pattern = getConflictPattern(restriction);
    
    if (pattern) {
      for (const conflictItem of pattern.conflictsWith) {
        if (normalizedText.includes(conflictItem.toLowerCase())) {
          violations.push({
            ingredient: conflictItem,
            restrictionViolated: restriction,
            severity: getSeverityLevel(conflictItem, restriction),
            alternativeSuggestions: pattern.substitutions[conflictItem] || [],
            detectedIn: location
          });
        }
      }
    }
  }
  
  return violations;
}

/**
 * Get conflict pattern for a dietary restriction
 */
function getConflictPattern(restriction: string) {
  return CONFLICT_PATTERNS.find(p => 
    p.dietary.some(d => restriction.toLowerCase().includes(d.toLowerCase()))
  );
}

/**
 * Determine severity level for a violation
 */
function getSeverityLevel(ingredient: string, restriction: string): 'high' | 'medium' | 'low' {
  // High severity for major allergens and strict restrictions
  const highSeverityIngredients = ['milk', 'eggs', 'nuts', 'shellfish', 'wheat', 'soy'];
  const strictRestrictions = ['vegan', 'vegetarian', 'gluten-free', 'halal', 'kosher'];
  
  if (strictRestrictions.some(strict => restriction.toLowerCase().includes(strict)) &&
      highSeverityIngredients.some(severe => ingredient.toLowerCase().includes(severe))) {
    return 'high';
  }
  
  if (ingredient.toLowerCase().includes('meat') || 
      ingredient.toLowerCase().includes('dairy') ||
      ingredient.toLowerCase().includes('gluten')) {
    return 'high';
  }
  
  return 'medium';
}

/**
 * Remove duplicate violations
 */
function removeDuplicateViolations(violations: DietaryViolation[]): DietaryViolation[] {
  const seen = new Set<string>();
  return violations.filter(violation => {
    const key = `${violation.ingredient}-${violation.restrictionViolated}-${violation.detectedIn}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Calculate confidence score for validation
 */
function calculateValidationConfidence(violations: DietaryViolation[], recipe: any): number {
  // Base confidence
  let confidence = 0.9;
  
  // Reduce confidence for each violation
  confidence -= violations.length * 0.1;
  
  // Reduce confidence if recipe has limited data
  if (!recipe.ingredients || recipe.ingredients.length < 3) {
    confidence -= 0.2;
  }
  
  if (!recipe.instructions || recipe.instructions.length < 2) {
    confidence -= 0.1;
  }
  
  return Math.max(0.1, Math.min(1.0, confidence));
}

/**
 * Get most common violations from meal plan validation
 */
function getMostCommonViolations(violations: Record<string, DietaryValidationResult>): string {
  const violationCounts: Record<string, number> = {};
  
  Object.values(violations).forEach(result => {
    result.violations.forEach(violation => {
      const key = violation.ingredient;
      violationCounts[key] = (violationCounts[key] || 0) + 1;
    });
  });
  
  const sorted = Object.entries(violationCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([ingredient, count]) => `${ingredient} (${count}x)`);
    
  return sorted.join(', ') || 'Various ingredients';
}

/**
 * Export for use in tests and external validation
 */
export const validationUtils = {
  scanTextForViolations,
  getConflictPattern,
  getSeverityLevel,
  removeDuplicateViolations,
  calculateValidationConfidence
};