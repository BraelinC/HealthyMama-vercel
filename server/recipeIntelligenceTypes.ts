/**
 * Enhanced Recipe Intelligence Types
 * Defines data structures for the advanced recipe analysis and time calculation system
 */

export interface RecipeComplexityFactors {
  techniqueComplexity: number;    // 1-5 scale
  ingredientCount: number;        // actual count
  equipmentRequired: string[];    // ['oven', 'blender', etc.]
  timingCritical: boolean;        // requires precise timing
  multiStep: boolean;             // multiple cooking stages
  skillRequired: string[];        // ['knife_skills', 'seasoning', etc.]
}

export interface CookingTimeFactors {
  prepWork: {
    chopping: number;       // minutes
    marinating: number;     // minutes  
    mixing: number;         // minutes
    setup: number;          // minutes
  };
  activeTime: {
    cooking: number;        // minutes
    monitoring: number;     // minutes requiring attention
  };
  passiveTime: {
    baking: number;         // minutes
    simmering: number;      // minutes
    resting: number;        // minutes
  };
}

export interface DifficultyLevel {
  level: number;          // 1-5
  description: string;
  timeMultiplier: number; // how much longer it takes for beginners
  techniques: string[];
}

export interface RecipeAnalysisResult {
  complexity: number;
  estimatedTime: number;
  timeBreakdown: string[];
  feasible: boolean;
  recommendations: string[];
}

export interface MealAnalysis {
  targetComplexity: number;
  estimatedTime: number;
  timeBreakdown: string[];
  feasible: boolean;
  recommendations: string[];
}

export interface RecipeValidation {
  timeAccurate: boolean;
  complexityAccurate: boolean;
  feasible: boolean;
}

// Equipment complexity mapping
export const EQUIPMENT_COMPLEXITY: Record<string, number> = {
  'stovetop': 1,
  'oven': 1.5,
  'microwave': 0.5,
  'toaster': 0.5,
  'blender': 2,
  'food_processor': 2,
  'stand_mixer': 2.5,
  'hand_mixer': 1.5,
  'sous_vide': 4,
  'smoker': 3.5,
  'deep_fryer': 3,
  'pressure_cooker': 2.5,
  'slow_cooker': 1,
  'pasta_machine': 3,
  'mandoline': 3.5,
  'mortar_pestle': 2,
  'grill': 2.5,
  'air_fryer': 1.5,
  'rice_cooker': 1
};

// Cuisine complexity adjustments
export const CUISINE_COMPLEXITY: Record<string, number> = {
  'american': 0,
  'italian': 0.5,
  'mexican': 0.5,
  'chinese': 1,
  'indian': 1.5,
  'french': 2,
  'thai': 1.5,
  'japanese': 1.5,
  'mediterranean': 0.5,
  'korean': 1.5,
  'vietnamese': 1,
  'middle_eastern': 1,
  'moroccan': 1.5,
  'ethiopian': 2,
  'molecular': 3
};

// Technique complexity mapping
export const TECHNIQUE_COMPLEXITY: Record<string, number> = {
  // Basic techniques (Level 1)
  'mixing': 1,
  'heating': 1,
  'assembly': 1,
  'basic_seasoning': 1,
  'basic_browning': 1.5,    // Simple browning (like ground beef)
  
  // Easy techniques (Level 2)
  'sautéing': 2,
  'boiling': 2,
  'basic_knife_skills': 2,
  'layering': 2,
  'steaming': 2,
  
  // Moderate techniques (Level 3)
  'roasting': 3,
  'braising': 3,
  'sauce_making': 3,
  'temperature_control': 3,
  'grilling': 3,
  'stir_frying': 3,
  'advanced_knife_skills': 3,
  
  // Advanced techniques (Level 4)
  'emulsification': 4,
  'reduction': 4,
  'caramelization': 4,       // True caramelization (onions, sugar)
  'precise_seasoning': 4,
  'pan_searing': 4,
  'deglazing': 4,
  
  // Expert techniques (Level 5)
  'tempering': 5,
  'confit': 5,
  'molecular_techniques': 5,
  'pastry_work': 5,
  'fermentation': 5,
  'smoking': 5
};

// Dietary restriction complexity adjustments
export const DIETARY_COMPLEXITY: Record<string, number> = {
  'vegetarian': 0,
  'vegan': 0.5,
  'gluten-free': 0.5,
  'dairy-free': 0.3,
  'nut-free': 0.2,
  'soy-free': 0.2,
  'keto': 1,
  'paleo': 0.5,
  'low-carb': 0.3,
  'low-sodium': 0.3,
  'diabetic': 0.5,
  'raw': 2,
  'whole30': 0.8
};