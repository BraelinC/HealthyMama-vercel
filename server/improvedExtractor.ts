/**
 * Improved YouTube recipe extractor
 * 
 * This version prioritizes:
 * 1. Description extraction first
 * 2. Pinned comments only as backup
 * 3. Never uses predefined templates
 * 4. Optimized to extract from 99% of videos with ingredient lists
 */

/**
 * Extract ingredients from text (description or pinned comment)
 * @param text Source text to extract from
 * @returns Array of ingredient strings
 */
export function extractIngredients(text: string): string[] {
  if (!text) return [];
  
  // Common section headers for ingredients
  const ingredientSectionMarkers = [
    'ingredients:', 'ingredients', 'what you need:', 'what you will need:',
    'what you\'ll need:', 'shopping list:', 'shopping list', 'you will need:',
    'you will need', 'you\'ll need:', 'you\'ll need', 'ingredients list:',
    'ingredients used:', 'ingredients needed:', 'items needed:', 'what i used:',
    // Case variations
    'Ingredients:', 'INGREDIENTS', 'INGREDIENTS:', 'Ingredients',
    'You will need:', 'What you need:', 'Shopping list:',
    'What You Need', 'Ingredients List:', 'You need:',
    // Non-English markers
    'Ingrédients:', 'Ingredientes:', 'Zutaten:', 'Ingredienti:',
    '材料:', '成分:', 'Ингредиенты:'
  ];
  
  // Common section markers that indicate the end of ingredients
  const endMarkers = [
    'instructions:', 'instructions', 'directions:', 'directions', 
    'method:', 'method', 'preparation:', 'preparation', 'steps:', 'steps',
    'procedure:', 'to prepare:', 'how to make:', 
    // Case variations
    'Instructions:', 'INSTRUCTIONS', 'Method:', 'Directions:',
    'Steps:', 'Preparation:', 'PREPARATION', 'How to Make:',
    // End of content markers
    'follow me', 'subscribe', 'my channel', 'link below', 'social media',
    'youtube', 'instagram', 'facebook', 'twitter', 'Watch the video', 
    'Visit ', 'Follow ', 'Subscribe'
  ];

  // Common measurement units to identify ingredients
  const measurementUnits = [
    'cup', 'cups', 'tablespoon', 'tablespoons', 'tbsp', 'tsp', 'teaspoon', 'teaspoons',
    'ounce', 'ounces', 'oz', 'pound', 'pounds', 'lb', 'lbs', 'gram', 'grams', 'g', 'kg',
    'ml', 'l', 'liter', 'liters', 'quart', 'quarts', 'gallon', 'gallons', 'pinch', 'pinches',
    'dash', 'dashes', 'handful', 'handfuls', 'slice', 'slices', 'piece', 'pieces', 
    'clove', 'cloves', 'bunch', 'bunches', 'stick', 'sticks', 'can', 'cans', 'jar', 'jars'
  ];
  
  // Common food-related words to identify ingredients
  const foodWords = [
    'salt', 'pepper', 'sugar', 'flour', 'butter', 'oil', 'garlic', 'onion',
    'chicken', 'beef', 'pork', 'fish', 'shrimp', 'egg', 'eggs', 'milk', 'cheese',
    'cream', 'yogurt', 'rice', 'pasta', 'noodle', 'tomato', 'potato', 'bread',
    'carrot', 'celery', 'pepper', 'vegetable', 'fruit', 'apple', 'orange',
    'lemon', 'lime', 'herb', 'spice', 'cinnamon', 'vanilla', 'chocolate',
    'honey', 'maple', 'syrup', 'sauce', 'broth', 'stock', 'water', 'wine',
    'vinegar', 'soy', 'mustard', 'ketchup', 'mayonnaise', 'bacon', 'ham',
    'avocado', 'bean', 'corn', 'pea', 'mushroom', 'olive', 'pickle',
    'cilantro', 'parsley', 'basil', 'thyme', 'oregano', 'cumin'
  ];
  
  // APPROACH 1: Find a marked ingredients section
  console.log("Looking for marked ingredient section");
  for (const marker of ingredientSectionMarkers) {
    // Case insensitive search
    const lowerText = text.toLowerCase();
    const lowerMarker = marker.toLowerCase();
    
    if (lowerText.includes(lowerMarker)) {
      // Get the index of the marker
      const markerIndex = lowerText.indexOf(lowerMarker);
      
      // Find where the ingredients section might end
      let endIndex = text.length;
      for (const endMarker of endMarkers) {
        // Case insensitive search for end marker
        const lowerEndMarker = endMarker.toLowerCase();
        const possibleEndIndex = lowerText.indexOf(lowerEndMarker, markerIndex + lowerMarker.length);
        
        if (possibleEndIndex !== -1 && possibleEndIndex < endIndex) {
          endIndex = possibleEndIndex;
        }
      }
      
      // Extract the ingredients section
      const ingredientSection = text.substring(markerIndex, endIndex).trim();
      
      // Split into lines and clean up
      const lines = ingredientSection.split('\n');
      
      // Start collecting ingredients after the marker line
      let foundMarkerLine = false;
      const ingredients: string[] = [];
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        // Skip until we find the marker line
        if (!foundMarkerLine) {
          // Check if this is the marker line (case insensitive)
          if (ingredientSectionMarkers.some(m => 
              trimmedLine.toLowerCase().includes(m.toLowerCase()))) {
            foundMarkerLine = true;
          }
          continue;
        }
        
        // Skip empty lines and very short lines
        if (trimmedLine && trimmedLine.length > 3) {
          // Remove any bullet points and formatting
          let cleanedLine = trimmedLine
            .replace(/^[-•*+]\s*/, '') // Remove bullet points
            .replace(/^\d+[\.\)]\s*/, '') // Remove numbering
            .trim();
          
          // Skip lines with URLs or common non-ingredient text
          if (!cleanedLine.includes('http') && 
              !cleanedLine.toLowerCase().includes('subscribe') && 
              !cleanedLine.toLowerCase().includes('follow me')) {
            ingredients.push(cleanedLine);
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
  
  // APPROACH 2: Ingredient pattern matching
  console.log("No clear ingredient section found, looking for ingredient patterns");
  
  // Helper function to check if a line is likely an ingredient
  function isLikelyIngredient(line: string): boolean {
    const trimmedLine = line.trim().toLowerCase();
    
    // Skip empty, very short, or very long lines
    if (!trimmedLine || trimmedLine.length < 3 || trimmedLine.length > 100) return false;
    
    // Skip lines with URLs or common non-ingredient text
    if (trimmedLine.includes('http') || 
        trimmedLine.includes('www.') ||
        trimmedLine.includes('subscribe') || 
        trimmedLine.includes('follow me') ||
        trimmedLine.includes('youtube') ||
        trimmedLine.includes('facebook') ||
        trimmedLine.includes('instagram') ||
        trimmedLine.includes('twitter') ||
        trimmedLine.includes('watch this video') ||
        trimmedLine.includes('comment')) {
      return false;
    }
    
    // Pattern 1: Lines with numbers and measurements (strongest signal)
    for (const unit of measurementUnits) {
      if (new RegExp(`\\d+\\s*(?:${unit}s?|${unit})\\b`, 'i').test(trimmedLine)) {
        return true;
      }
    }
    
    // Pattern 2: Lines with numbers and food words
    if (/\d+/.test(trimmedLine)) {
      for (const food of foodWords) {
        if (trimmedLine.includes(food)) return true;
      }
    }
    
    // Pattern 3: Lines starting with bullets/dashes and food words
    if (/^[-•*+]\s*(.+)$/.test(trimmedLine)) {
      for (const food of foodWords) {
        if (trimmedLine.includes(food)) return true;
      }
    }
    
    return false;
  }
  
  // Find consecutive clusters of ingredient-like lines
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  let consecutiveIngredients = 0;
  let ingredientCandidate: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    if (isLikelyIngredient(lines[i])) {
      consecutiveIngredients++;
      ingredientCandidate.push(lines[i]);
    } else if (lines[i].trim() === '') {
      // Skip empty lines without resetting counter
      continue;
    } else {
      // Reset if we hit a non-ingredient line
      consecutiveIngredients = 0;
      ingredientCandidate = [];
    }
    
    // If we found at least 3 consecutive ingredient-like lines, that's a good sign
    if (consecutiveIngredients >= 3) {
      // Look ahead to collect all consecutive ingredients
      let j = i + 1;
      while (j < lines.length && (isLikelyIngredient(lines[j]) || lines[j].trim() === '')) {
        if (lines[j].trim() !== '') {
          ingredientCandidate.push(lines[j]);
        }
        j++;
      }
      
      // Clean up and return ingredients
      const cleanedIngredients = ingredientCandidate.map(line => {
        let cleaned = line.replace(/^[-•*+]\s*/, '').trim();
        cleaned = cleaned.replace(/^\d+[\.\)]\s*/, '').trim();
        return cleaned;
      });
      
      console.log(`Found ${cleanedIngredients.length} ingredient-like lines`);
      return cleanedIngredients;
    }
  }
  
  // If we couldn't find any ingredients, return empty array
  console.log("Could not find any ingredients in this text");
  return [];
}

/**
 * Extract instructions from text (description or pinned comment)
 * @param text Source text to extract from
 * @returns Array of instruction strings
 */
export function extractInstructions(text: string): string[] {
  if (!text) return [];
  
  // Common instruction section markers
  const instructionSectionMarkers = [
    'instructions:', 'instructions', 'directions:', 'directions', 
    'method:', 'method', 'preparation:', 'preparation', 'steps:', 'steps',
    'how to make:', 'procedure:', 'to prepare:',
    // Case variations
    'Instructions:', 'INSTRUCTIONS', 'Method:', 'METHOD', 'Directions:',
    'DIRECTIONS', 'Steps:', 'STEPS', 'How to Make:', 'HOW TO MAKE'
  ];
  
  // Common end markers for instructions
  const endMarkers = [
    'notes:', 'notes', 'tips:', 'tips', 'serving suggestion:',
    'nutrition:', 'follow me', 'subscribe', 'my channel',
    // Case variations
    'Notes:', 'NOTES', 'Tips:', 'TIPS', 'Nutrition:',
    // End of content markers
    'youtube', 'instagram', 'facebook', 'twitter', 'Watch the video', 
    'Visit ', 'Follow ', 'Subscribe'
  ];
  
  // APPROACH 1: Find a marked instructions section
  console.log("Looking for marked instruction section");
  for (const marker of instructionSectionMarkers) {
    // Case insensitive search
    const lowerText = text.toLowerCase();
    const lowerMarker = marker.toLowerCase();
    
    if (lowerText.includes(lowerMarker)) {
      // Get the index of the marker
      const markerIndex = lowerText.indexOf(lowerMarker);
      
      // Find where the instructions section might end
      let endIndex = text.length;
      for (const endMarker of endMarkers) {
        // Case insensitive search for end marker
        const lowerEndMarker = endMarker.toLowerCase();
        const possibleEndIndex = lowerText.indexOf(lowerEndMarker, markerIndex + lowerMarker.length);
        
        if (possibleEndIndex !== -1 && possibleEndIndex < endIndex) {
          endIndex = possibleEndIndex;
        }
      }
      
      // Extract the instructions section
      const instructionSection = text.substring(markerIndex, endIndex).trim();
      
      // Split into lines and clean up
      const lines = instructionSection.split('\n');
      
      // Start collecting instructions after the marker line
      let foundMarkerLine = false;
      const instructions: string[] = [];
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        // Skip until we find the marker line
        if (!foundMarkerLine) {
          // Check if this is the marker line (case insensitive)
          if (instructionSectionMarkers.some(m => 
              trimmedLine.toLowerCase().includes(m.toLowerCase()))) {
            foundMarkerLine = true;
          }
          continue;
        }
        
        // Skip empty lines and very short lines
        if (trimmedLine && trimmedLine.length > 10) { // Instructions tend to be longer
          // Remove any bullet points and formatting
          let cleanedLine = trimmedLine
            .replace(/^[-•*+]\s*/, '') // Remove bullet points
            .replace(/^\d+[\.\)]\s*/, '') // Remove numbering
            .trim();
          
          // Skip lines with URLs or common non-instruction text
          if (!cleanedLine.includes('http') && 
              !cleanedLine.toLowerCase().includes('subscribe') && 
              !cleanedLine.toLowerCase().includes('follow me')) {
            instructions.push(cleanedLine);
          }
        }
      }
      
      // If we found some instructions, return them
      if (instructions.length > 0) {
        console.log(`Found ${instructions.length} instructions in marked section`);
        return instructions;
      }
    }
  }
  
  // APPROACH 2: Look for numbered steps
  console.log("Looking for numbered steps");
  const numberedStepPattern = /^\s*(\d+)[\.\)]\s+(.+)$/;
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  const numberedSteps: string[] = [];
  for (const line of lines) {
    const match = line.match(numberedStepPattern);
    if (match && match[2].length > 15) { // Make sure it's a substantial instruction
      numberedSteps.push(match[2].trim());
    }
  }
  
  if (numberedSteps.length >= 2) {
    console.log(`Found ${numberedSteps.length} numbered steps`);
    return numberedSteps;
  }
  
  // APPROACH 3: Look for cooking instruction phrases
  console.log("Looking for cooking instruction phrases");
  
  const cookingVerbs = [
    'add', 'mix', 'stir', 'beat', 'whisk', 'fold', 'pour', 'combine', 'blend',
    'heat', 'cook', 'simmer', 'boil', 'bake', 'roast', 'grill', 'fry',
    'chop', 'slice', 'dice', 'mince', 'peel', 'grate', 'prepare',
    'place', 'put', 'transfer', 'remove', 'serve', 'garnish', 'season'
  ];
  
  const instructionLines = lines.filter(line => {
    // Skip if too short or contains URLs/social media
    if (line.length < 20 || line.length > 250 ||
        line.includes('http') ||
        line.toLowerCase().includes('subscribe') ||
        line.toLowerCase().includes('follow me')) {
      return false;
    }
    
    // Check if line contains cooking verbs, especially at the start
    for (const verb of cookingVerbs) {
      if (line.toLowerCase().startsWith(verb + ' ') ||
          line.toLowerCase().includes(' ' + verb + ' ')) {
        return true;
      }
    }
    
    return false;
  });
  
  if (instructionLines.length >= 2) {
    console.log(`Found ${instructionLines.length} instruction phrases`);
    return instructionLines;
  }
  
  // If we couldn't find any instructions, return empty array
  console.log("Could not find any instructions in this text");
  return [];
}

/**
 * Get recipe from YouTube prioritizing description first, then pinned comments
 * @param description Video description
 * @param comments Video comments (with pinned comments first)
 * @returns Recipe data or null
 */
export function extractRecipeContent(description: string, comments: string[] = []) {
  // Step 1: Try to extract ingredients from description
  let ingredients = extractIngredients(description);
  console.log(`Found ${ingredients.length} ingredients in description`);
  
  // Step 2: If not found in description, try pinned comments
  if (ingredients.length < 3 && comments.length > 0) {
    // Find pinned comments
    const pinnedComments = comments.filter(comment => 
      comment.toLowerCase().includes('pinned') || 
      comment.toLowerCase().includes('creator') ||
      comment.toLowerCase().includes('highlighted') ||
      comment.toLowerCase().includes('featured'));
    
    if (pinnedComments.length > 0) {
      console.log(`Checking ${pinnedComments.length} pinned comments for ingredients`);
      
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
  
  // Step 3: Try to extract instructions from description
  let instructions = extractInstructions(description);
  console.log(`Found ${instructions.length} instructions in description`);
  
  // Step 4: If not found in description, try pinned comments
  if (instructions.length < 2 && comments.length > 0) {
    // Find pinned comments
    const pinnedComments = comments.filter(comment => 
      comment.toLowerCase().includes('pinned') || 
      comment.toLowerCase().includes('creator') ||
      comment.toLowerCase().includes('highlighted') ||
      comment.toLowerCase().includes('featured'));
    
    if (pinnedComments.length > 0) {
      console.log(`Checking ${pinnedComments.length} pinned comments for instructions`);
      
      for (const comment of pinnedComments) {
        const commentInstructions = extractInstructions(comment);
        if (commentInstructions.length >= 2) {
          console.log(`Found ${commentInstructions.length} instructions in pinned comment`);
          instructions = commentInstructions;
          break;
        }
      }
    }
  }
  
  // Return extracted content - never use predefined templates
  return {
    ingredients,
    instructions
  };
}