/**
 * Dietary-Cultural Conflict Resolution System
 * 
 * Intelligently resolves conflicts between cultural cuisine preferences and dietary restrictions
 * Example: "vegetarian Chinese beef dish" → suggests "Chinese tofu stir-fry" instead
 * 
 * Integrates with enhanced nlpCultureParser structured cuisine data for smarter recommendations
 */

import { CuisineData, CultureParserResult } from './nlpCultureParser.js';

export interface ConflictResolution {
  hasConflict: boolean;
  conflictType: 'ingredient' | 'cooking_method' | 'dietary_restriction' | 'none';
  originalRequest: string;
  suggestedAlternatives: AlternativeSuggestion[];
  confidence: number;
  culturalAuthenticity: number; // 0-1 score for how authentic the alternative is
  explanations: string[];
}

export interface AlternativeSuggestion {
  dishName: string;
  cuisine: string;
  description: string;
  substituteIngredients: IngredientSubstitution[];
  difficultyRating: number;
  cookTime: number;
  culturalNotes: string;
  dietaryCompliance: string[];
}

export interface IngredientSubstitution {
  original: string;
  substitute: string;
  reason: string;
  culturalContext?: string;
}

interface ConflictPattern {
  dietary: string[];
  conflictsWith: string[];
  substitutions: { [key: string]: string[] };
  cookingMethodAlternatives?: { [key: string]: string[] };
}

// Comprehensive conflict resolution database
export const CONFLICT_PATTERNS: ConflictPattern[] = [
  // VEGETARIAN CONFLICTS
  {
    dietary: ['vegetarian', 'veggie'],
    conflictsWith: ['beef', 'pork', 'chicken', 'lamb', 'fish', 'seafood', 'meat', 'bacon', 'ham', 'sausage'],
    substitutions: {
      'beef': ['tofu', 'tempeh', 'mushrooms', 'seitan', 'plant-based meat'],
      'chicken': ['tofu', 'cauliflower', 'chickpeas', 'mushrooms'],
      'pork': ['jackfruit', 'mushrooms', 'tempeh'],
      'fish': ['tofu', 'hearts of palm', 'banana peels'],
      'bacon': ['tempeh bacon', 'coconut bacon', 'shiitake bacon'],
      'ground meat': ['lentils', 'mushrooms', 'crumbled tofu'],
      'sausage': ['plant-based sausage', 'seasoned mushrooms']
    },
    cookingMethodAlternatives: {
      'bbq meat': ['grilled vegetables', 'bbq tofu', 'grilled portobello'],
      'stir-fry meat': ['stir-fry tofu', 'stir-fry tempeh', 'vegetable stir-fry']
    }
  },
  
  // VEGAN CONFLICTS
  {
    dietary: ['vegan'],
    conflictsWith: ['beef', 'pork', 'chicken', 'fish', 'dairy', 'milk', 'cheese', 'butter', 'eggs', 'honey'],
    substitutions: {
      'beef': ['tofu', 'tempeh', 'mushrooms', 'lentils'],
      'chicken': ['tofu', 'cauliflower', 'jackfruit'],
      'cheese': ['nutritional yeast', 'cashew cheese', 'almond cheese'],
      'milk': ['almond milk', 'oat milk', 'coconut milk'],
      'butter': ['coconut oil', 'olive oil', 'vegan butter'],
      'eggs': ['flax eggs', 'aquafaba', 'chia eggs'],
      'honey': ['maple syrup', 'agave nectar', 'date syrup']
    }
  },
  
  // HALAL CONFLICTS
  {
    dietary: ['halal'],
    conflictsWith: ['pork', 'bacon', 'ham', 'alcohol', 'wine', 'beer', 'gelatin'],
    substitutions: {
      'pork': ['beef', 'lamb', 'chicken', 'turkey'],
      'bacon': ['turkey bacon', 'beef bacon', 'halal bacon'],
      'wine': ['grape juice', 'pomegranate juice', 'halal cooking wine'],
      'alcohol': ['vinegar', 'citrus juice', 'broth']
    }
  },
  
  // KOSHER CONFLICTS
  {
    dietary: ['kosher'],
    conflictsWith: ['pork', 'shellfish', 'mixing meat and dairy'],
    substitutions: {
      'pork': ['beef', 'lamb', 'chicken', 'turkey'],
      'shellfish': ['fish with scales', 'chicken', 'vegetables'],
      'cream with meat': ['coconut cream', 'cashew cream', 'broth']
    }
  },
  
  // GLUTEN-FREE CONFLICTS
  {
    dietary: ['gluten-free', 'gluten free', 'celiac'],
    conflictsWith: ['wheat', 'pasta', 'bread', 'flour', 'soy sauce', 'beer'],
    substitutions: {
      'pasta': ['rice noodles', 'zucchini noodles', 'gluten-free pasta'],
      'bread': ['gluten-free bread', 'lettuce wraps', 'rice paper'],
      'flour': ['rice flour', 'almond flour', 'coconut flour'],
      'soy sauce': ['tamari', 'coconut aminos', 'gluten-free soy sauce'],
      'noodles': ['rice noodles', 'shirataki noodles', 'zucchini noodles']
    }
  },
  
  // DAIRY-FREE CONFLICTS
  {
    dietary: ['dairy-free', 'dairy free', 'lactose intolerant'],
    conflictsWith: ['milk', 'cheese', 'butter', 'cream', 'yogurt'],
    substitutions: {
      'milk': ['almond milk', 'oat milk', 'coconut milk'],
      'cheese': ['nutritional yeast', 'dairy-free cheese', 'cashew cheese'],
      'butter': ['coconut oil', 'olive oil', 'dairy-free butter'],
      'cream': ['coconut cream', 'cashew cream', 'oat cream'],
      'yogurt': ['coconut yogurt', 'almond yogurt', 'oat yogurt']
    }
  },
  
  // KETO CONFLICTS
  {
    dietary: ['keto', 'ketogenic', 'low-carb'],
    conflictsWith: ['rice', 'pasta', 'bread', 'potatoes', 'sugar', 'beans', 'fruit'],
    substitutions: {
      'rice': ['cauliflower rice', 'shirataki rice', 'broccoli rice'],
      'pasta': ['zucchini noodles', 'shirataki noodles', 'spaghetti squash'],
      'bread': ['lettuce wraps', 'portobello caps', 'cauliflower bread'],
      'potatoes': ['cauliflower', 'turnips', 'radishes'],
      'sugar': ['stevia', 'erythritol', 'monk fruit'],
      'beans': ['green beans', 'asparagus', 'broccoli']
    }
  }
];

// Cultural cuisine mappings for better substitution context
const CULTURAL_SUBSTITUTION_CONTEXT = {
  'Chinese': {
    'beef': { substitute: 'tofu', preparation: 'marinated in soy sauce and cornstarch', culturalNote: 'Tofu is traditional in Chinese cuisine' },
    'chicken': { substitute: 'mushrooms', preparation: 'shiitake or king oyster mushrooms', culturalNote: 'Mushrooms are prized in Chinese cooking' },
    'pork': { substitute: 'tempeh', preparation: 'five-spice seasoned tempeh', culturalNote: 'Maintains umami depth' }
  },
  'Italian': {
    'meat': { substitute: 'mushrooms', preparation: 'mixed wild mushrooms', culturalNote: 'Italy has rich vegetarian traditions' },
    'cheese': { substitute: 'nutritional yeast', preparation: 'with herbs and garlic', culturalNote: 'Provides umami like parmesan' }
  },
  'Mexican': {
    'beef': { substitute: 'black beans', preparation: 'seasoned with cumin and chili', culturalNote: 'Beans are traditional Mexican protein' },
    'cheese': { substitute: 'cashew crema', preparation: 'blended cashews with lime', culturalNote: 'Maintains creamy texture' }
  },
  'Indian': {
    'meat': { substitute: 'paneer or legumes', preparation: 'traditional preparation methods', culturalNote: 'India has extensive vegetarian tradition' },
    'dairy': { substitute: 'coconut milk', preparation: 'full-fat coconut milk', culturalNote: 'Common in South Indian cuisine' }
  },
  'Japanese': {
    'meat': { substitute: 'tofu', preparation: 'silken or firm tofu', culturalNote: 'Tofu originated in Japan' },
    'fish': { substitute: 'mushrooms', preparation: 'dashi-marinated mushrooms', culturalNote: 'Provides umami depth' }
  },
  'Thai': {
    'meat': { substitute: 'tofu', preparation: 'pressed and marinated tofu', culturalNote: 'Common in Thai Buddhist cuisine' },
    'fish sauce': { substitute: 'soy sauce with seaweed', preparation: 'adds oceanic flavor', culturalNote: 'Maintains umami profile' }
  }
};

/**
 * Main conflict resolution function
 * Analyzes meal requests for dietary-cultural conflicts and provides alternatives
 */
export async function resolveDietaryCulturalConflicts(
  mealRequest: string,
  dietaryRestrictions: string[],
  culturalBackground: string[]
): Promise<ConflictResolution> {
  
  const startTime = Date.now();
  console.log(`🔍 Analyzing conflicts for: "${mealRequest}" with restrictions: [${dietaryRestrictions.join(', ')}] and cultures: [${culturalBackground.join(', ')}]`);
  
  // Normalize inputs
  const normalizedRequest = mealRequest.toLowerCase();
  const normalizedRestrictions = dietaryRestrictions.map(r => r.toLowerCase());
  
  // Detect conflicts
  const conflicts = detectConflicts(normalizedRequest, normalizedRestrictions);
  
  if (conflicts.length === 0) {
    return {
      hasConflict: false,
      conflictType: 'none',
      originalRequest: mealRequest,
      suggestedAlternatives: [],
      confidence: 1.0,
      culturalAuthenticity: 1.0,
      explanations: ['No conflicts detected - meal aligns with dietary restrictions']
    };
  }
  
  // Generate alternative suggestions
  const alternatives = await generateAlternatives(
    mealRequest,
    conflicts,
    normalizedRestrictions,
    culturalBackground
  );
  
  // Calculate confidence and authenticity scores
  const confidence = calculateConfidenceScore(conflicts, alternatives);
  const culturalAuthenticity = calculateCulturalAuthenticity(alternatives, culturalBackground);
  
  // Generate explanations
  const explanations = generateConflictExplanations(conflicts, alternatives);
  
  console.log(`✅ Conflict resolution complete in ${Date.now() - startTime}ms. Found ${alternatives.length} alternatives.`);
  
  return {
    hasConflict: true,
    conflictType: determineConflictType(conflicts),
    originalRequest: mealRequest,
    suggestedAlternatives: alternatives,
    confidence,
    culturalAuthenticity,
    explanations
  };
}

/**
 * Detect conflicts between meal request and dietary restrictions
 */
function detectConflicts(mealRequest: string, dietaryRestrictions: string[]): any[] {
  const conflicts: any[] = [];
  
  for (const restriction of dietaryRestrictions) {
    const pattern = CONFLICT_PATTERNS.find(p => 
      p.dietary.some(d => restriction.includes(d))
    );
    
    if (pattern) {
      const foundConflicts = pattern.conflictsWith.filter(conflictItem =>
        mealRequest.includes(conflictItem)
      );
      
      if (foundConflicts.length > 0) {
        conflicts.push({
          restriction,
          pattern,
          conflictingItems: foundConflicts
        });
      }
    }
  }
  
  return conflicts;
}

/**
 * Generate alternative meal suggestions that resolve conflicts
 */
async function generateAlternatives(
  originalRequest: string,
  conflicts: any[],
  dietaryRestrictions: string[],
  culturalBackground: string[]
): Promise<AlternativeSuggestion[]> {
  
  const alternatives: AlternativeSuggestion[] = [];
  
  // For each detected culture, generate culturally appropriate alternatives
  for (const culture of culturalBackground) {
    const culturalAlternatives = generateCulturalAlternatives(
      originalRequest,
      conflicts,
      culture,
      dietaryRestrictions
    );
    alternatives.push(...culturalAlternatives);
  }
  
  // If no cultural background provided, generate generic alternatives
  if (culturalBackground.length === 0) {
    const genericAlternatives = generateGenericAlternatives(originalRequest, conflicts);
    alternatives.push(...genericAlternatives);
  }
  
  // Sort by cultural authenticity and practical feasibility
  return alternatives
    .sort((a, b) => b.culturalAuthenticity - a.culturalAuthenticity)
    .slice(0, 5); // Return top 5 alternatives
}

/**
 * Generate culturally appropriate alternatives
 */
function generateCulturalAlternatives(
  originalRequest: string,
  conflicts: any[],
  culture: string,
  dietaryRestrictions: string[]
): AlternativeSuggestion[] {
  
  const alternatives: AlternativeSuggestion[] = [];
  const culturalContext = CULTURAL_SUBSTITUTION_CONTEXT[culture] || {};
  
  // Extract dish type from original request
  const dishType = extractDishType(originalRequest);
  
  for (const conflict of conflicts) {
    for (const conflictingItem of conflict.conflictingItems) {
      const substitutions = conflict.pattern.substitutions[conflictingItem] || [];
      
      for (const substitute of substitutions.slice(0, 2)) { // Top 2 substitutions per conflict
        const culturalSubstitute = culturalContext[conflictingItem] || {
          substitute,
          preparation: `traditional ${culture.toLowerCase()} style`,
          culturalNote: `Adapted for ${culture} cuisine`
        };
        
        const newDishName = generateDishName(originalRequest, conflictingItem, culturalSubstitute.substitute, culture);
        
        alternatives.push({
          dishName: newDishName,
          cuisine: culture,
          description: `${culture} ${dishType} with ${culturalSubstitute.substitute} instead of ${conflictingItem}`,
          substituteIngredients: [{
            original: conflictingItem,
            substitute: culturalSubstitute.substitute,
            reason: `Dietary restriction: ${conflict.restriction}`,
            culturalContext: culturalSubstitute.culturalNote
          }],
          difficultyRating: estimateDifficulty(newDishName, culturalSubstitute.substitute),
          cookTime: estimateCookTime(newDishName, culturalSubstitute.substitute),
          culturalNotes: culturalSubstitute.culturalNote,
          dietaryCompliance: dietaryRestrictions
        });
      }
    }
  }
  
  return alternatives;
}

/**
 * Generate generic alternatives when no cultural context
 */
function generateGenericAlternatives(originalRequest: string, conflicts: any[]): AlternativeSuggestion[] {
  const alternatives: AlternativeSuggestion[] = [];
  
  for (const conflict of conflicts) {
    for (const conflictingItem of conflict.conflictingItems) {
      const substitutions = conflict.pattern.substitutions[conflictingItem] || [];
      
      const bestSubstitute = substitutions[0]; // Use best substitute
      if (bestSubstitute) {
        const newDishName = generateDishName(originalRequest, conflictingItem, bestSubstitute, 'International');
        
        alternatives.push({
          dishName: newDishName,
          cuisine: 'International',
          description: `Modified version with ${bestSubstitute} instead of ${conflictingItem}`,
          substituteIngredients: [{
            original: conflictingItem,
            substitute: bestSubstitute,
            reason: `Dietary restriction: ${conflict.restriction}`
          }],
          difficultyRating: estimateDifficulty(newDishName, bestSubstitute),
          cookTime: estimateCookTime(newDishName, bestSubstitute),
          culturalNotes: 'International fusion adaptation',
          dietaryCompliance: [conflict.restriction]
        });
      }
    }
  }
  
  return alternatives;
}

/**
 * Helper functions
 */

function extractDishType(request: string): string {
  const dishTypes = ['stir-fry', 'curry', 'soup', 'salad', 'pasta', 'rice', 'noodles', 'casserole', 'sandwich'];
  const found = dishTypes.find(type => request.toLowerCase().includes(type));
  return found || 'dish';
}

function generateDishName(original: string, conflictItem: string, substitute: string, culture: string): string {
  const baseName = original.replace(new RegExp(conflictItem, 'gi'), substitute);
  return `${culture} ${baseName}`.replace(/\s+/g, ' ').trim();
}

function estimateDifficulty(dishName: string, substitute: string): number {
  // Simple heuristic based on substitute complexity
  const complexSubstitutes = ['tempeh', 'seitan', 'cashew cheese'];
  const mediumSubstitutes = ['tofu', 'mushrooms', 'nutritional yeast'];
  
  if (complexSubstitutes.some(s => substitute.includes(s))) return 3.0;
  if (mediumSubstitutes.some(s => substitute.includes(s))) return 2.0;
  return 1.5;
}

function estimateCookTime(dishName: string, substitute: string): number {
  // Simple heuristic based on cooking method and substitute
  if (dishName.includes('stir-fry')) return 15;
  if (dishName.includes('soup') || dishName.includes('curry')) return 30;
  if (dishName.includes('casserole') || dishName.includes('baked')) return 45;
  return 25;
}

function determineConflictType(conflicts: any[]): 'ingredient' | 'cooking_method' | 'dietary_restriction' | 'none' {
  if (conflicts.length === 0) return 'none';
  if (conflicts.some(c => c.conflictingItems.length > 0)) return 'ingredient';
  return 'dietary_restriction';
}

function calculateConfidenceScore(conflicts: any[], alternatives: AlternativeSuggestion[]): number {
  if (alternatives.length === 0) return 0.1;
  if (alternatives.length >= 3) return 0.9;
  return 0.7;
}

function calculateCulturalAuthenticity(alternatives: AlternativeSuggestion[], culturalBackground: string[]): number {
  if (culturalBackground.length === 0) return 1.0;
  
  const authenticAlternatives = alternatives.filter(alt => 
    culturalBackground.includes(alt.cuisine)
  );
  
  return authenticAlternatives.length / Math.max(alternatives.length, 1);
}

function generateConflictExplanations(conflicts: any[], alternatives: AlternativeSuggestion[]): string[] {
  const explanations: string[] = [];
  
  for (const conflict of conflicts) {
    explanations.push(
      `${conflict.restriction} restriction conflicts with: ${conflict.conflictingItems.join(', ')}`
    );
  }
  
  if (alternatives.length > 0) {
    explanations.push(`Generated ${alternatives.length} culturally appropriate alternatives`);
  }
  
  return explanations;
}

/**
 * Quick conflict check function for real-time validation
 */
export function hasQuickConflict(mealRequest: string, dietaryRestrictions: string[]): boolean {
  const normalizedRequest = mealRequest.toLowerCase();
  const normalizedRestrictions = dietaryRestrictions.map(r => r.toLowerCase());
  
  return detectConflicts(normalizedRequest, normalizedRestrictions).length > 0;
}

/**
 * Get suggested substitutions for a specific ingredient and dietary restriction
 */
export function getIngredientSubstitutions(ingredient: string, dietaryRestriction: string): string[] {
  const pattern = CONFLICT_PATTERNS.find(p => 
    p.dietary.some(d => dietaryRestriction.toLowerCase().includes(d))
  );
  
  if (!pattern) return [];
  
  return pattern.substitutions[ingredient.toLowerCase()] || [];
}

/**
 * ENHANCED: Resolve conflicts using structured cuisine data from nlpCultureParser
 */
export async function resolveConflictsWithCuisineData(
  mealRequest: string,
  dietaryRestrictions: string[],
  cultureParserResult: CultureParserResult
): Promise<ConflictResolution> {
  const normalizedRequest = mealRequest.toLowerCase();
  const normalizedRestrictions = dietaryRestrictions.map(r => r.toLowerCase());
  
  // Detect basic conflicts first
  const conflicts = detectConflicts(normalizedRequest, normalizedRestrictions);
  
  if (conflicts.length === 0) {
    return {
      hasConflict: false,
      conflictType: 'none',
      originalRequest: mealRequest,
      suggestedAlternatives: [],
      confidence: 1.0,
      culturalAuthenticity: 1.0,
      explanations: ['No dietary conflicts detected']
    };
  }

  // Generate enhanced alternatives using structured cuisine data
  const alternatives = generateEnhancedAlternatives(
    mealRequest,
    conflicts,
    cultureParserResult,
    dietaryRestrictions
  );

  return {
    hasConflict: true,
    conflictType: determineConflictType(conflicts),
    originalRequest: mealRequest,
    suggestedAlternatives: alternatives,
    confidence: calculateConfidenceScore(conflicts, alternatives),
    culturalAuthenticity: calculateEnhancedAuthenticity(alternatives, cultureParserResult),
    explanations: generateEnhancedExplanations(conflicts, alternatives, cultureParserResult)
  };
}

/**
 * Generate alternatives using the structured cuisine data
 */
function generateEnhancedAlternatives(
  originalRequest: string,
  conflicts: any[],
  cultureResult: CultureParserResult,
  dietaryRestrictions: string[]
): AlternativeSuggestion[] {
  const alternatives: AlternativeSuggestion[] = [];
  
  // For each detected culture with cuisine data
  for (const cultureName of cultureResult.cultureTags) {
    const cuisineData = cultureResult.cuisineData?.[cultureName];
    if (!cuisineData) continue;

    // Generate alternatives based on structured cuisine data
    const cultureAlternatives = generateCultureSpecificAlternatives(
      originalRequest,
      conflicts,
      cultureName,
      cuisineData,
      dietaryRestrictions
    );
    
    alternatives.push(...cultureAlternatives);
  }

  // If no culture-specific data, fallback to original method
  if (alternatives.length === 0) {
    for (const cultureName of cultureResult.cultureTags) {
      const fallbackAlts = generateCulturalAlternatives(
        originalRequest,
        conflicts,
        cultureName,
        dietaryRestrictions
      );
      alternatives.push(...fallbackAlts);
    }
  }

  // Sort by cultural authenticity and relevance
  return alternatives
    .sort((a, b) => b.culturalAuthenticity - a.culturalAuthenticity)
    .slice(0, 5); // Top 5 alternatives
}

/**
 * Generate culture-specific alternatives using structured cuisine data
 */
function generateCultureSpecificAlternatives(
  originalRequest: string,
  conflicts: any[],
  cultureName: string,
  cuisineData: CuisineData,
  dietaryRestrictions: string[]
): AlternativeSuggestion[] {
  const alternatives: AlternativeSuggestion[] = [];
  
  // Use staple dishes as base for alternatives
  for (const stapleDish of cuisineData.staple_dishes.slice(0, 3)) {
    for (const conflict of conflicts) {
      for (const conflictingItem of conflict.conflictingItems) {
        
        // Find appropriate substitutes from the cuisine's common ingredients
        const substitutes = findCulturalSubstitutes(
          conflictingItem,
          cuisineData,
          conflict.restriction
        );
        
        for (const substitute of substitutes.slice(0, 2)) {
          const adaptedDish = adaptDishToDietaryRestriction(
            stapleDish,
            conflictingItem,
            substitute,
            cultureName,
            cuisineData
          );
          
          alternatives.push(adaptedDish);
        }
      }
    }
  }
  
  return alternatives;
}

/**
 * Find culturally appropriate substitutes using cuisine data
 */
function findCulturalSubstitutes(
  conflictingItem: string,
  cuisineData: CuisineData,
  restriction: string
): string[] {
  const substitutes: string[] = [];
  
  // Check healthy swaps first
  const healthySwap = cuisineData.healthy_swaps.find(
    swap => swap.original.toLowerCase().includes(conflictingItem.toLowerCase())
  );
  if (healthySwap) {
    substitutes.push(healthySwap.swap);
  }
  
  // Add culturally appropriate proteins/vegetables based on restriction
  if (restriction.includes('vegetarian') || restriction.includes('vegan')) {
    substitutes.push(...cuisineData.common_vegetables.slice(0, 2));
    // Add tofu/tempeh if it's common in this cuisine
    const proteinAlts = cuisineData.common_proteins.filter(p => 
      p.includes('tofu') || p.includes('tempeh') || p.includes('beans')
    );
    substitutes.push(...proteinAlts);
  }
  
  // Use traditional conflict resolution as fallback
  const pattern = CONFLICT_PATTERNS.find(p => 
    p.dietary.some(d => restriction.toLowerCase().includes(d))
  );
  
  if (pattern) {
    const traditionalSubs = pattern.substitutions[conflictingItem.toLowerCase()] || [];
    substitutes.push(...traditionalSubs.slice(0, 2));
  }
  
  return [...new Set(substitutes)]; // Remove duplicates
}

/**
 * Adapt a staple dish to dietary restrictions
 */
function adaptDishToDietaryRestriction(
  stapleDish: {name: string; description: string; ingredients: string[]},
  conflictingItem: string,
  substitute: string,
  cultureName: string,
  cuisineData: CuisineData
): AlternativeSuggestion {
  const adaptedName = stapleDish.name.replace(
    new RegExp(conflictingItem, 'gi'),
    substitute
  );
  
  return {
    dishName: adaptedName || `${cultureName} ${substitute} dish`,
    cuisine: cultureName,
    description: `Traditional ${stapleDish.name} adapted with ${substitute} instead of ${conflictingItem}`,
    substituteIngredients: [{
      original: conflictingItem,
      substitute: substitute,
      reason: `Dietary adaptation maintaining ${cultureName} authenticity`,
      culturalContext: `Common in traditional ${cultureName} cooking`
    }],
    difficultyRating: estimateDifficulty(stapleDish.name, substitute),
    cookTime: estimateCookTime(stapleDish.name, substitute),
    culturalNotes: `Uses traditional ${cultureName} cooking methods: ${cuisineData.cooking_methods.join(', ')}`,
    dietaryCompliance: cuisineData.dietary_restrictions || []
  };
}

/**
 * Calculate enhanced cultural authenticity using structured data
 */
function calculateEnhancedAuthenticity(
  alternatives: AlternativeSuggestion[],
  cultureResult: CultureParserResult
): number {
  if (alternatives.length === 0) return 0;
  
  const authenticityScores = alternatives.map(alt => {
    const hasStructuredData = cultureResult.cuisineData?.[alt.cuisine] ? 0.5 : 0;
    const culturalMatch = cultureResult.cultureTags.includes(alt.cuisine) ? 0.5 : 0;
    return hasStructuredData + culturalMatch;
  });
  
  return authenticityScores.reduce((sum, score) => sum + score, 0) / alternatives.length;
}

/**
 * Generate enhanced explanations using structured data
 */
function generateEnhancedExplanations(
  conflicts: any[],
  alternatives: AlternativeSuggestion[],
  cultureResult: CultureParserResult
): string[] {
  const explanations: string[] = [];
  
  for (const conflict of conflicts) {
    explanations.push(
      `${conflict.restriction} restriction conflicts with: ${conflict.conflictingItems.join(', ')}`
    );
  }
  
  if (cultureResult.cuisineData) {
    const culturesWithData = Object.keys(cultureResult.cuisineData);
    explanations.push(
      `Used detailed ${culturesWithData.join(', ')} cuisine data for authentic alternatives`
    );
  }
  
  if (alternatives.length > 0) {
    explanations.push(
      `Generated ${alternatives.length} culturally authentic alternatives using traditional cooking methods and ingredients`
    );
  }
  
  return explanations;
}