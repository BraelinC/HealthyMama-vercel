import type { Profile } from '@shared/schema';
import type { GoalWeights, SimplifiedUserProfile } from '@shared/schema';

/**
 * Convert traditional profile format to weight-based profile format
 */
export function convertTraditionalToWeightBased(
  traditionalProfile: any
): SimplifiedUserProfile {
  // Extract goal weights from primary goal and preferences
  const goalWeights = deriveGoalWeightsFromTraditionalProfile(traditionalProfile);
  
  // Extract dietary restrictions from preferences or members
  const dietaryRestrictions = extractDietaryRestrictions(traditionalProfile);
  
  return {
    dietaryRestrictions,
    goalWeights,
    culturalBackground: traditionalProfile.cultural_background || [],
    familySize: traditionalProfile.family_size || 1,
    availableIngredients: [] // Could be populated from user input
  };
}

/**
 * Convert weight-based profile format back to traditional profile format
 */
export function convertWeightBasedToTraditional(
  weightBasedProfile: SimplifiedUserProfile,
  existingProfile?: any
): Partial<any> {
  // Derive primary goal from weight priorities
  const primaryGoal = derivePrimaryGoalFromWeights(weightBasedProfile.goalWeights);
  
  return {
    profile_name: existingProfile?.profile_name || 'Smart Profile',
    primary_goal: primaryGoal,
    family_size: weightBasedProfile.familySize,
    members: existingProfile?.members || [],
    profile_type: 'weight-based', // Special type to identify smart profiles
    preferences: weightBasedProfile.dietaryRestrictions,
    goals: convertGoalWeightsToGoalsArray(weightBasedProfile.goalWeights),
    cultural_background: weightBasedProfile.culturalBackground
  };
}

/**
 * Derive goal weights from traditional profile structure
 */
function deriveGoalWeightsFromTraditionalProfile(profile: any): GoalWeights {
  const weights: GoalWeights = {
    cost: 0.5,
    health: 0.5,
    cultural: 0.5,
    variety: 0.5,
    time: 0.5
  };

  // Analyze primary goal to set initial weights
  const primaryGoal = profile.primary_goal?.toLowerCase() || '';
  
  if (primaryGoal.includes('save money') || primaryGoal.includes('budget')) {
    weights.cost = 0.8;
    weights.health = 0.6;
  } else if (primaryGoal.includes('health') || primaryGoal.includes('nutrition')) {
    weights.health = 0.8;
    weights.cost = 0.4;
  } else if (primaryGoal.includes('time') || primaryGoal.includes('quick') || primaryGoal.includes('prep')) {
    weights.time = 0.8;
    weights.variety = 0.6;
  } else if (primaryGoal.includes('variety') || primaryGoal.includes('diverse')) {
    weights.variety = 0.8;
    weights.cultural = 0.7;
  } else if (primaryGoal.includes('muscle') || primaryGoal.includes('protein')) {
    weights.health = 0.8;
    weights.cost = 0.5;
  }

  // Boost cultural weight if cultural background is present
  if (profile.cultural_background && profile.cultural_background.length > 0) {
    weights.cultural = Math.max(weights.cultural, 0.7);
  }

  // Analyze family size for time considerations
  if (profile.family_size > 4) {
    weights.time = Math.max(weights.time, 0.6);
    weights.cost = Math.max(weights.cost, 0.6);
  }

  // Check if there are goals stored as weight format already
  if (profile.goals && Array.isArray(profile.goals)) {
    const existingWeights = parseGoalsArrayToWeights(profile.goals);
    if (existingWeights) {
      return existingWeights;
    }
  }

  return weights;
}

/**
 * Parse goals array that might contain weight information
 */
function parseGoalsArrayToWeights(goals: string[]): GoalWeights | null {
  const weights: Partial<GoalWeights> = {};
  let hasWeightData = false;

  goals.forEach(goal => {
    if (goal.includes(':')) {
      const [key, value] = goal.split(':');
      const numValue = parseFloat(value);
      
      if (!isNaN(numValue) && numValue >= 0 && numValue <= 1) {
        if (key in { cost: 1, health: 1, cultural: 1, variety: 1, time: 1 }) {
          weights[key as keyof GoalWeights] = numValue;
          hasWeightData = true;
        }
      }
    }
  });

  if (hasWeightData && Object.keys(weights).length >= 3) {
    return {
      cost: weights.cost ?? 0.5,
      health: weights.health ?? 0.5,
      cultural: weights.cultural ?? 0.5,
      variety: weights.variety ?? 0.5,
      time: weights.time ?? 0.5
    };
  }

  return null;
}

/**
 * Convert goal weights back to goals array format for storage
 */
function convertGoalWeightsToGoalsArray(weights: GoalWeights): string[] {
  return [
    `cost:${weights.cost}`,
    `health:${weights.health}`,
    `cultural:${weights.cultural}`,
    `variety:${weights.variety}`,
    `time:${weights.time}`
  ];
}

/**
 * Derive primary goal description from weight priorities
 */
function derivePrimaryGoalFromWeights(weights: GoalWeights): string {
  // Find the highest weight(s)
  const maxWeight = Math.max(...Object.values(weights));
  const topPriorities = Object.entries(weights)
    .filter(([_, weight]) => weight === maxWeight)
    .map(([goal]) => goal);

  // Create descriptive goal based on top priorities
  if (topPriorities.includes('cost') && maxWeight > 0.7) {
    return 'Save Money';
  } else if (topPriorities.includes('health') && maxWeight > 0.7) {
    return 'Improve Health';
  } else if (topPriorities.includes('time') && maxWeight > 0.7) {
    return 'Save Time';
  } else if (topPriorities.includes('variety') && maxWeight > 0.7) {
    return 'Eat More Variety';
  } else if (topPriorities.includes('cultural') && maxWeight > 0.7) {
    return 'Cultural Cuisine Focus';
  } else {
    return 'Weight-Based Planning';
  }
}

/**
 * Extract dietary restrictions from traditional profile
 */
function extractDietaryRestrictions(profile: any): string[] {
  const restrictions = new Set<string>();

  // From direct preferences
  if (profile.preferences && Array.isArray(profile.preferences)) {
    profile.preferences.forEach(pref => {
      if (isDietaryRestriction(pref)) {
        restrictions.add(pref);
      }
    });
  }

  // From family members
  if (profile.members && Array.isArray(profile.members)) {
    profile.members.forEach((member: any) => {
      if (member.preferences && Array.isArray(member.preferences)) {
        member.preferences.forEach(pref => {
          if (isDietaryRestriction(pref)) {
            restrictions.add(pref);
          }
        });
      }
    });
  }

  return Array.from(restrictions);
}

/**
 * Check if a preference is a dietary restriction
 */
function isDietaryRestriction(preference: string): boolean {
  const dietaryKeywords = [
    'vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'keto', 'paleo',
    'low-carb', 'high-protein', 'halal', 'kosher', 'nut-free', 'soy-free',
    'low-sodium', 'organic', 'pescatarian', 'mediterranean'
  ];

  return dietaryKeywords.some(keyword => 
    preference.toLowerCase().includes(keyword.toLowerCase())
  );
}

/**
 * Merge profiles when switching between systems, preserving data
 */
export function mergeProfileData(
  currentProfile: any,
  newProfileData: any
): any {
  return {
    ...currentProfile,
    ...newProfileData,
    // Preserve important fields
    cultural_background: newProfileData.cultural_background || currentProfile.cultural_background || [],
    family_size: newProfileData.family_size || currentProfile.family_size || 1,
    // Merge preferences intelligently
    preferences: mergeDietaryPreferences(
      currentProfile.preferences || [],
      newProfileData.preferences || []
    )
  };
}

/**
 * Merge dietary preferences from different sources
 */
function mergeDietaryPreferences(current: string[], newPrefs: string[]): string[] {
  const merged = new Set([...current, ...newPrefs]);
  return Array.from(merged);
}