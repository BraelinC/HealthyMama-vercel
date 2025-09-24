/**
 * Meal Adaptation Engine
 * 
 * Adapts cultural and predetermined meals to comply with dietary restrictions
 * while maintaining authenticity and appeal
 */

import type { GoalWeights } from '../shared/schema';

interface Meal {
  id?: string;
  title: string;
  ingredients: string[];
  instructions: string[];
  culture?: string;
  nutrition?: any;
  cookTime?: number;
  difficulty?: number;
}

interface AdaptationResult {
  meal: Meal;
  adaptations: string[];
  isAdapted: boolean;
}

export class MealAdaptationEngine {
  // Common ingredient substitutions for dietary restrictions
  private substitutions = {
    'vegetarian': {
      'chicken': ['tofu', 'tempeh', 'chickpeas', 'mushrooms'],
      'beef': ['black beans', 'lentils', 'plant-based ground', 'mushrooms'],
      'pork': ['jackfruit', 'tempeh', 'mushrooms'],
      'fish': ['tofu', 'hearts of palm', 'banana blossom'],
      'seafood': ['king oyster mushrooms', 'hearts of palm'],
      'bacon': ['tempeh bacon', 'mushroom bacon', 'coconut bacon'],
      'meat': ['plant protein', 'beans', 'lentils', 'tofu']
    },
    'vegan': {
      'chicken': ['tofu', 'tempeh', 'chickpeas', 'seitan'],
      'beef': ['black beans', 'lentils', 'plant-based ground', 'mushrooms'],
      'pork': ['jackfruit', 'tempeh', 'mushrooms'],
      'fish': ['tofu', 'hearts of palm', 'banana blossom'],
      'seafood': ['king oyster mushrooms', 'hearts of palm'],
      'milk': ['almond milk', 'oat milk', 'soy milk', 'coconut milk'],
      'cheese': ['nutritional yeast', 'cashew cheese', 'vegan cheese'],
      'butter': ['vegan butter', 'coconut oil', 'olive oil'],
      'eggs': ['flax eggs', 'chia eggs', 'tofu scramble', 'chickpea flour'],
      'cream': ['coconut cream', 'cashew cream', 'oat cream'],
      'yogurt': ['coconut yogurt', 'almond yogurt', 'soy yogurt'],
      'honey': ['maple syrup', 'agave nectar', 'date syrup']
    },
    'gluten-free': {
      'wheat flour': ['rice flour', 'almond flour', 'coconut flour', 'gluten-free flour blend'],
      'pasta': ['rice pasta', 'corn pasta', 'zucchini noodles', 'gluten-free pasta'],
      'bread': ['gluten-free bread', 'rice cakes', 'corn tortillas'],
      'soy sauce': ['tamari', 'coconut aminos'],
      'flour': ['gluten-free flour', 'almond flour', 'rice flour'],
      'breadcrumbs': ['gluten-free breadcrumbs', 'crushed rice crackers', 'almond meal']
    },
    'dairy-free': {
      'milk': ['almond milk', 'oat milk', 'soy milk', 'coconut milk'],
      'cheese': ['nutritional yeast', 'cashew cheese', 'dairy-free cheese'],
      'butter': ['olive oil', 'coconut oil', 'dairy-free butter'],
      'cream': ['coconut cream', 'cashew cream', 'oat cream'],
      'yogurt': ['coconut yogurt', 'almond yogurt', 'soy yogurt'],
      'ice cream': ['coconut ice cream', 'banana ice cream', 'dairy-free ice cream']
    },
    'nut-free': {
      'almonds': ['sunflower seeds', 'pumpkin seeds'],
      'almond milk': ['oat milk', 'soy milk', 'rice milk'],
      'peanut butter': ['sunflower seed butter', 'tahini', 'soy butter'],
      'cashews': ['sunflower seeds', 'hemp seeds'],
      'walnuts': ['pumpkin seeds', 'sunflower seeds'],
      'pecans': ['pepitas', 'sunflower seeds'],
      'nut': ['seed', 'coconut']
    },
    'keto': {
      'rice': ['cauliflower rice', 'shirataki rice'],
      'pasta': ['zucchini noodles', 'shirataki noodles', 'spaghetti squash'],
      'potatoes': ['cauliflower', 'turnips', 'radishes'],
      'bread': ['cloud bread', 'almond flour bread', 'coconut flour bread'],
      'sugar': ['stevia', 'erythritol', 'monk fruit sweetener'],
      'flour': ['almond flour', 'coconut flour']
    }
  };

  /**
   * Check if meal needs adaptation and adapt if necessary
   */
  async adaptMealIfNeeded(
    meal: Meal,
    dietaryRestrictions: string[],
    weights: GoalWeights
  ): Promise<AdaptationResult> {
    if (!dietaryRestrictions || dietaryRestrictions.length === 0) {
      return { meal, adaptations: [], isAdapted: false };
    }

    const adaptations: string[] = [];
    let adaptedMeal = { ...meal };
    let needsAdaptation = false;

    // Check each dietary restriction
    for (const restriction of dietaryRestrictions) {
      const normalizedRestriction = restriction.toLowerCase().trim();
      const substitutionMap = this.substitutions[normalizedRestriction];
      
      if (substitutionMap) {
        // Check and adapt ingredients
        adaptedMeal.ingredients = adaptedMeal.ingredients.map(ingredient => {
          const lowerIngredient = ingredient.toLowerCase();
          
          for (const [original, substitutes] of Object.entries(substitutionMap)) {
            if (lowerIngredient.includes(original)) {
              needsAdaptation = true;
              const substitute = this.selectBestSubstitute(substitutes, weights);
              const adaptedIngredient = ingredient.replace(
                new RegExp(original, 'gi'), 
                substitute
              );
              adaptations.push(`Replaced ${original} with ${substitute} for ${restriction}`);
              return adaptedIngredient;
            }
          }
          
          return ingredient;
        });

        // Adapt instructions if needed
        if (needsAdaptation) {
          adaptedMeal.instructions = adaptedMeal.instructions.map(instruction => {
            let adaptedInstruction = instruction;
            
            for (const [original, substitutes] of Object.entries(substitutionMap)) {
              if (adaptedInstruction.toLowerCase().includes(original)) {
                const substitute = substitutes[0]; // Use first substitute in instructions
                adaptedInstruction = adaptedInstruction.replace(
                  new RegExp(original, 'gi'),
                  substitute
                );
              }
            }
            
            return adaptedInstruction;
          });
        }
      }

      // Additional checks for specific restrictions
      if (normalizedRestriction.includes('allerg')) {
        // Handle specific allergies
        const allergen = this.extractAllergen(normalizedRestriction);
        if (allergen) {
          adaptedMeal = this.removeAllergen(adaptedMeal, allergen, adaptations);
          needsAdaptation = true;
        }
      }
    }

    // Update title if significantly adapted
    if (needsAdaptation && adaptations.length > 2) {
      const mainRestriction = dietaryRestrictions[0];
      adaptedMeal.title = `${mainRestriction}-Friendly ${adaptedMeal.title}`;
    }

    return {
      meal: adaptedMeal,
      adaptations,
      isAdapted: needsAdaptation
    };
  }

  /**
   * Select the best substitute based on goal weights
   */
  private selectBestSubstitute(substitutes: string[], weights: GoalWeights): string {
    if (substitutes.length === 1) return substitutes[0];

    // Cost-conscious selection
    if (weights.cost > 0.7) {
      const economical = ['beans', 'lentils', 'tofu', 'oat milk', 'rice flour'];
      const costEffective = substitutes.find(sub => 
        economical.some(econ => sub.includes(econ))
      );
      if (costEffective) return costEffective;
    }

    // Health-conscious selection
    if (weights.health > 0.7) {
      const healthy = ['tempeh', 'chickpeas', 'almond', 'cashew', 'quinoa'];
      const nutritious = substitutes.find(sub =>
        healthy.some(h => sub.includes(h))
      );
      if (nutritious) return nutritious;
    }

    // Default to first option
    return substitutes[0];
  }

  /**
   * Extract allergen from allergy string
   */
  private extractAllergen(allergyString: string): string | null {
    const commonAllergens = ['peanut', 'tree nut', 'milk', 'egg', 'soy', 'wheat', 'fish', 'shellfish'];
    const lower = allergyString.toLowerCase();
    
    for (const allergen of commonAllergens) {
      if (lower.includes(allergen)) {
        return allergen;
      }
    }
    
    // Try to extract from "allergic to X" pattern
    const match = lower.match(/allergic to (\w+)/);
    return match ? match[1] : null;
  }

  /**
   * Remove allergen from meal
   */
  private removeAllergen(meal: Meal, allergen: string, adaptations: string[]): Meal {
    const adaptedMeal = { ...meal };
    
    // Filter out ingredients containing the allergen
    const originalCount = adaptedMeal.ingredients.length;
    adaptedMeal.ingredients = adaptedMeal.ingredients.filter(ingredient => {
      const contains = ingredient.toLowerCase().includes(allergen.toLowerCase());
      if (contains) {
        adaptations.push(`Removed ${ingredient} due to ${allergen} allergy`);
      }
      return !contains;
    });

    // If we removed too many ingredients, the meal might not work
    if (adaptedMeal.ingredients.length < originalCount * 0.7) {
      adaptations.push(`Warning: Significant ingredients removed due to ${allergen} allergy`);
    }

    return adaptedMeal;
  }

  /**
   * Validate that a meal complies with all dietary restrictions
   */
  validateCompliance(meal: Meal, dietaryRestrictions: string[]): {
    isCompliant: boolean;
    violations: string[];
  } {
    const violations: string[] = [];
    
    for (const restriction of dietaryRestrictions) {
      const normalizedRestriction = restriction.toLowerCase().trim();
      
      // Check common restriction violations
      const restrictionChecks = {
        'vegetarian': ['meat', 'chicken', 'beef', 'pork', 'fish', 'seafood'],
        'vegan': ['meat', 'chicken', 'beef', 'pork', 'fish', 'seafood', 'dairy', 'milk', 'cheese', 'eggs', 'honey'],
        'gluten-free': ['wheat', 'flour', 'bread', 'pasta', 'gluten'],
        'dairy-free': ['milk', 'cheese', 'butter', 'cream', 'yogurt', 'dairy'],
        'nut-free': ['nut', 'almond', 'cashew', 'peanut', 'walnut', 'pecan']
      };

      const forbiddenItems = restrictionChecks[normalizedRestriction] || [];
      const ingredientText = meal.ingredients.join(' ').toLowerCase();
      
      for (const forbidden of forbiddenItems) {
        if (ingredientText.includes(forbidden)) {
          // Check for false positives (e.g., "coconut" contains "nut" but is not a tree nut)
          if (forbidden === 'nut' && ingredientText.includes('coconut')) {
            continue;
          }
          violations.push(`Contains ${forbidden} (violates ${restriction})`);
        }
      }
    }

    return {
      isCompliant: violations.length === 0,
      violations
    };
  }
}