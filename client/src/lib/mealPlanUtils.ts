/**
 * Utility functions for meal plan management
 */

import { format } from "date-fns";

export interface MealPlanGenerationParams {
  numDays?: number[];
  mealsPerDay?: number[];
  primaryGoal?: string;
  selectedFamilyMembers?: string[];
  nutritionGoal?: string;
  dietaryRestrictions?: string;
  cookTime?: number[];
  difficulty?: number[];
  cuisine?: string;
  startDate?: Date;
}

/**
 * Generates a smart, meaningful name for an auto-saved meal plan
 */
export function generateMealPlanName(params: MealPlanGenerationParams): string {
  const {
    numDays = [7],
    mealsPerDay = [3],
    primaryGoal,
    selectedFamilyMembers = [],
    nutritionGoal,
    dietaryRestrictions,
    cuisine,
    startDate = new Date()
  } = params;

  // Base components
  const dayCount = numDays[0] || 7;
  const mealCount = mealsPerDay[0] || 3;
  const dateStr = format(startDate, "MMM d");

  // Build name components
  const nameComponents: string[] = [];

  // Duration prefix
  if (dayCount === 7) {
    nameComponents.push("Weekly");
  } else if (dayCount === 14) {
    nameComponents.push("Bi-Weekly");
  } else if (dayCount === 30) {
    nameComponents.push("Monthly");
  } else {
    nameComponents.push(`${dayCount}-Day`);
  }

  // Family context
  if (selectedFamilyMembers.length > 0) {
    if (selectedFamilyMembers.length === 1) {
      nameComponents.push("Personal");
    } else if (selectedFamilyMembers.length <= 4) {
      nameComponents.push("Family");
    } else {
      nameComponents.push("Large Family");
    }
  }

  // Primary goal or nutrition focus
  if (primaryGoal) {
    switch (primaryGoal.toLowerCase()) {
      case "save money":
        nameComponents.push("Budget");
        break;
      case "eat healthier":
      case "health":
        nameComponents.push("Healthy");
        break;
      case "gain muscle":
      case "muscle":
        nameComponents.push("Muscle Building");
        break;
      case "lose weight":
      case "weight loss":
        nameComponents.push("Weight Loss");
        break;
      case "family wellness":
        nameComponents.push("Wellness");
        break;
      default:
        // Clean up the goal name
        const cleanGoal = primaryGoal
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        nameComponents.push(cleanGoal);
    }
  } else if (nutritionGoal) {
    // Use nutrition goal if no primary goal
    const cleanNutrition = nutritionGoal
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    nameComponents.push(cleanNutrition);
  }

  // Dietary restrictions
  if (dietaryRestrictions) {
    const restrictions = dietaryRestrictions.toLowerCase();
    if (restrictions.includes("vegetarian")) {
      nameComponents.push("Vegetarian");
    } else if (restrictions.includes("vegan")) {
      nameComponents.push("Vegan");
    } else if (restrictions.includes("keto")) {
      nameComponents.push("Keto");
    } else if (restrictions.includes("paleo")) {
      nameComponents.push("Paleo");
    } else if (restrictions.includes("gluten")) {
      nameComponents.push("Gluten-Free");
    }
  }

  // Cuisine type
  if (cuisine && cuisine !== "any" && cuisine !== "mixed") {
    const cleanCuisine = cuisine
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    nameComponents.push(cleanCuisine);
  }

  // Always end with "Plan"
  nameComponents.push("Plan");

  // Add date
  const baseName = nameComponents.join(" ");
  return `${baseName} - ${dateStr}`;
}

/**
 * Generates a description for an auto-saved meal plan
 */
export function generateMealPlanDescription(params: MealPlanGenerationParams): string {
  const {
    numDays = [7],
    mealsPerDay = [3],
    selectedFamilyMembers = [],
    cookTime = [30],
    difficulty = [3],
    primaryGoal,
    dietaryRestrictions
  } = params;

  const dayCount = numDays[0] || 7;
  const mealCount = mealsPerDay[0] || 3;
  const familySize = selectedFamilyMembers.length;
  const maxCookTime = Math.max(...cookTime);
  const avgDifficulty = difficulty[0] || 3;

  const parts: string[] = [];

  // Basic info
  parts.push(`${dayCount} days with ${mealCount} meals per day`);

  // Family info
  if (familySize > 0) {
    parts.push(`for ${familySize} ${familySize === 1 ? 'person' : 'people'}`);
  }

  // Cooking details
  if (maxCookTime && maxCookTime < 60) {
    parts.push(`under ${maxCookTime} minutes cook time`);
  }

  if (avgDifficulty <= 2) {
    parts.push("easy recipes");
  } else if (avgDifficulty >= 4) {
    parts.push("advanced recipes");
  }

  // Goals and restrictions
  if (primaryGoal) {
    parts.push(`focused on ${primaryGoal.toLowerCase()}`);
  }

  if (dietaryRestrictions) {
    parts.push(`${dietaryRestrictions.toLowerCase()} friendly`);
  }

  return `Auto-generated meal plan: ${parts.join(', ')}.`;
}

/**
 * Determines if a meal plan should be auto-saved based on content
 */
export function shouldAutoSaveMealPlan(mealPlan: any): boolean {
  if (!mealPlan || !mealPlan.meal_plan) {
    return false;
  }

  const dayCount = Object.keys(mealPlan.meal_plan).length;
  
  // Only auto-save if we have at least 2 days of meals
  if (dayCount < 2) {
    return false;
  }

  // Check if meals have proper structure
  const firstDay = Object.values(mealPlan.meal_plan)[0] as any;
  if (!firstDay || typeof firstDay !== 'object') {
    return false;
  }

  const mealCount = Object.keys(firstDay).length;
  
  // Only auto-save if we have at least 2 meals per day
  return mealCount >= 2;
}

/**
 * Creates a unique name by adding timestamp if needed
 */
export function ensureUniqueName(baseName: string, existingNames: string[]): string {
  if (!existingNames.includes(baseName)) {
    return baseName;
  }

  // Add time to make it unique
  const timestamp = format(new Date(), "HH:mm");
  const nameWithTime = `${baseName} (${timestamp})`;
  
  if (!existingNames.includes(nameWithTime)) {
    return nameWithTime;
  }

  // Fallback with seconds
  const timestampWithSeconds = format(new Date(), "HH:mm:ss");
  return `${baseName} (${timestampWithSeconds})`;
}