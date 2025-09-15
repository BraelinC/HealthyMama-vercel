/**
 * Profile validation for meal generation
 * Ensures all required fields are present before allowing meal plan generation
 */

export interface ProfileValidationResult {
  isValid: boolean;
  missingFields: string[];
  errorMessage?: string;
}

export function validateProfileForMealGeneration(profile: any): ProfileValidationResult {
  const missingFields: string[] = [];

  // Check required fields
  if (!profile) {
    return {
      isValid: false,
      missingFields: ['profile'],
      errorMessage: 'No profile found. Please update your profile before generating meal plans.'
    };
  }

  // Essential fields for V2 prompt builder
  if (!profile.primary_goal) {
    missingFields.push('Primary Goal');
  }

  if (!profile.profile_type || !['individual', 'family'].includes(profile.profile_type)) {
    missingFields.push('Profile Type (Individual/Family)');
  }

  if (profile.profile_type === 'family' && (!profile.family_size || profile.family_size < 1)) {
    missingFields.push('Family Size');
  }

  // Goal weights can be stored as goal_weights object OR goals array - accept both
  const hasGoalWeights = profile.goal_weights && typeof profile.goal_weights === 'object';
  const hasGoalsArray = profile.goals && Array.isArray(profile.goals) && profile.goals.length > 0;
  
  if (!hasGoalWeights && !hasGoalsArray) {
    missingFields.push('Goal Weights (generated from Primary Goal)');
  }

  // Optional but recommended fields
  const recommendedFields: string[] = [];
  
  if (!profile.preferences || profile.preferences.length === 0) {
    recommendedFields.push('Dietary Preferences');
  }

  if (!profile.cultural_background || profile.cultural_background.length === 0) {
    recommendedFields.push('Cultural Background');
  }

  // Build error message
  let errorMessage = '';
  if (missingFields.length > 0) {
    errorMessage = `Please update your profile. Missing required fields: ${missingFields.join(', ')}`;
    
    if (recommendedFields.length > 0) {
      errorMessage += `. Also consider adding: ${recommendedFields.join(', ')} for better meal recommendations.`;
    }
  }

  return {
    isValid: missingFields.length === 0,
    missingFields,
    errorMessage
  };
}

/**
 * Get default goal weights based on primary goal
 * This ensures we always have weights even if not stored in profile
 */
export function getDefaultGoalWeights(primaryGoal: string): any {
  const defaultWeights = {
    cost: 0.5,
    health: 0.5,
    cultural: 0.3,
    time: 0.5,
    variety: 0.5
  };

  // Adjust weights based on primary goal
  switch (primaryGoal) {
    case 'Save Money':
      return {
        cost: 0.85,
        health: 0.6,
        cultural: 0.3,
        time: 0.7,
        variety: 0.4
      };
    
    case 'Eat Healthier':
      return {
        cost: 0.5,
        health: 0.9,
        cultural: 0.4,
        time: 0.5,
        variety: 0.7
      };
    
    case 'Gain Muscle':
      return {
        cost: 0.6,
        health: 0.85,
        cultural: 0.3,
        time: 0.5,
        variety: 0.6
      };
    
    case 'Lose Weight':
      return {
        cost: 0.5,
        health: 0.8,
        cultural: 0.3,
        time: 0.6,
        variety: 0.7
      };
    
    case 'Family Nutrition':
      return {
        cost: 0.7,
        health: 0.7,
        cultural: 0.5,
        time: 0.6,
        variety: 0.6
      };
    
    default:
      return defaultWeights;
  }
}