/**
 * Simple and direct ingredient extraction that prioritizes:
 * 1. Description text first
 * 2. Only uses pinned comments as backup
 * 3. Never falls back to predefined templates
 */

/**
 * Extract ingredients from text (description or pinned comment)
 */
export function extractIngredients(text: string): string[] {
  if (!text) return [];
  
  // Common ingredient section markers
  const ingredientMarkers = [
    'ingredients:', 'ingredients', 'what you need:', 'what you will need:',
    'what you\'ll need:', 'shopping list:', 'shopping list', 'you will need:',
    'you will need', 'you\'ll need:', 'you\'ll need', 'ingredients list:',
    'ingredients used:', 'ingredients needed:', 'items needed:',
    // Case variations
    'Ingredients:', 'INGREDIENTS', 'INGREDIENTS:', 'Ingredients',
    'You will need:', 'What you need:'
  ];
  
  // Common end markers for ingredients section
  const endMarkers = [
    'instructions:', 'instructions', 'directions:', 'directions', 
    'method:', 'method', 'preparation:', 'preparation', 'steps:', 'steps',
    // Case variations
    'Instructions:', 'INSTRUCTIONS', 'Method:', 'Directions:'
  ];
  
  // Common food words for pattern matching
  const foodWords = [
    'salt', 'pepper', 'sugar', 'flour', 'butter', 'oil', 'garlic', 'onion',
    'chicken', 'beef', 'pork', 'fish', 'egg', 'milk', 'cheese', 'cream',
    'rice', 'pasta', 'tomato', 'potato', 'carrot', 'bread'
  ];
  
  // APPROACH 1: Find a marked ingredient section
  for (const marker of ingredientMarkers) {
    if (text.toLowerCase().includes(marker.toLowerCase())) {
      console.log(`Found ingredient marker: ${marker}`);
      
      // Get text starting from the marker
      const startIndex = text.toLowerCase().indexOf(marker.toLowerCase());
      let ingredientSection = text.substring(startIndex);
      
      // Find where the section ends
      for (const endMarker of endMarkers) {
        const endIndex = ingredientSection.toLowerCase().indexOf(endMarker.toLowerCase());
        if (endIndex !== -1) {
          ingredientSection = ingredientSection.substring(0, endIndex);
          break;
        }
      }
      
      // Split into lines and clean
      const lines = ingredientSection.split('\n');
      const ingredients: string[] = [];
      let foundMarkerLine = false;
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        // Skip until we find the marker line
        if (!foundMarkerLine) {
          if (ingredientMarkers.some(m => trimmedLine.toLowerCase().includes(m.toLowerCase()))) {
            foundMarkerLine = true;
          }
          continue;
        }
        
        // Skip empty lines and short lines
        if (trimmedLine && trimmedLine.length > 3) {
          // Skip non-ingredient lines
          if (!trimmedLine.includes('http') && 
              !trimmedLine.toLowerCase().includes('subscribe') && 
              !trimmedLine.toLowerCase().includes('follow')) {
            // Remove bullet points and numbers
            let cleaned = trimmedLine.replace(/^[-•*+]\s*/, '').trim();
            cleaned = cleaned.replace(/^\d+[\.\)]\s*/, '').trim();
            ingredients.push(cleaned);
          }
        }
      }
      
      // If we found enough ingredients, return them
      if (ingredients.length >= 3) {
        console.log(`Found ${ingredients.length} ingredients in marked section`);
        return ingredients;
      }
    }
  }
  
  // APPROACH 2: Find clusters of ingredient-like lines
  console.log("No clearly marked section found, looking for ingredient patterns");
  
  // Check if a line is likely an ingredient
  function isLikelyIngredient(line: string): boolean {
    if (line.length < 3 || line.length > 150) return false;
    if (line.includes('http') || 
        line.includes('subscribe') || 
        line.includes('follow')) return false;
    
    // Check for measurements (strongest signal)
    if (/\d+\s*(cup|cups|tbsp|tsp|tablespoon|teaspoon|oz|ounce|pound|lb|gram|g)s?\b/i.test(line)) {
      return true;
    }
    
    // Check for numbers + food words
    if (/\d+/.test(line)) {
      for (const food of foodWords) {
        if (line.toLowerCase().includes(food)) return true;
      }
    }
    
    return false;
  }
  
  // Look for clusters of ingredient-like lines
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  let consecutiveIngredients = 0;
  let ingredientCandidate: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    if (isLikelyIngredient(lines[i])) {
      consecutiveIngredients++;
      ingredientCandidate.push(lines[i]);
    } else if (lines[i].trim() === '') {
      // Skip empty lines
      continue;
    } else {
      // Reset when hitting non-ingredient line
      consecutiveIngredients = 0;
      ingredientCandidate = [];
    }
    
    // If we have 3+ consecutive ingredients, we found a cluster
    if (consecutiveIngredients >= 3) {
      // Look ahead for more ingredients
      let j = i + 1;
      while (j < lines.length && (isLikelyIngredient(lines[j]) || lines[j].trim() === '')) {
        if (lines[j].trim() !== '') {
          ingredientCandidate.push(lines[j]);
        }
        j++;
      }
      
      // Clean up ingredients
      const cleanedIngredients = ingredientCandidate.map(line => {
        let cleaned = line.replace(/^[-•*+]\s*/, '').trim();
        cleaned = cleaned.replace(/^\d+[\.\)]\s*/, '').trim();
        return cleaned;
      });
      
      console.log(`Found ${cleanedIngredients.length} ingredient-like lines`);
      return cleanedIngredients;
    }
  }
  
  // Return empty if nothing found - never use templates
  console.log("No ingredients found");
  return [];
}

/**
 * Get recipe from YouTube with improved ingredient extraction
 * Prioritize description first, only use pinned comments as backup
 * Never use predefined templates for ingredients
 */
export function extractFromVideo(videoInfo: {
  description: string;
  comments?: string[];
}): { ingredients: string[], instructions: string[] } {
  // Step 1: Try to extract from description first
  let ingredients = extractIngredients(videoInfo.description);
  console.log(`Found ${ingredients.length} ingredients in video description`);
  
  // Step 2: If we couldn't find ingredients in description, try pinned comments only
  if (ingredients.length < 3 && videoInfo.comments && videoInfo.comments.length > 0) {
    // Only check pinned/creator comments
    const pinnedComments = videoInfo.comments.filter(comment => 
      comment.toLowerCase().includes('pinned') ||
      comment.toLowerCase().includes('creator') ||
      comment.toLowerCase().includes('featured')
    );
    
    if (pinnedComments.length > 0) {
      console.log(`Checking ${pinnedComments.length} pinned/creator comments`);
      
      for (const comment of pinnedComments) {
        const commentIngredients = extractIngredients(comment);
        if (commentIngredients.length >= 3) {
          console.log(`Found ${commentIngredients.length} ingredients in pinned comment`);
          ingredients = commentIngredients;
          break;
        }
      }
    }
  }
  
  // Return what we found, leaving instructions as is
  return {
    ingredients: ingredients,
    instructions: [] // You can implement instruction extraction similarly
  };
}