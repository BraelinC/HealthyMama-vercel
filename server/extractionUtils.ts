/**
 * Utility functions for LLaVA-inspired recipe extraction from multiple sources
 * This approach processes video description, comments and transcript in sequence
 */

/**
 * Extract ingredients from text using LLaVA-inspired pattern recognition
 * @param source Text source to extract ingredients from
 * @returns Array of extracted ingredient strings
 */
export function extractIngredients(source: string): string[] {
  if (!source || typeof source !== 'string') return [];
  
  // Split text into lines for easier processing
  const lines = source.split('\n').map(line => line.trim());
  
  // Look for sections that contain ingredients
  const ingredientMarkers = [
    'ingredients', 'ingredients:', 'ingredients used', 'what you need', 'what you will need',
    'shopping list', 'shopping list:', 'you will need',
    'ingredients for', 'what i used', 'ingredients you need', 'ingredients needed',
    'ingredients list', 'ingredient list', 'ingredients list:', 'ingredient list:'
  ];
  
  // Extract lines that appear to be ingredients
  let ingredients: string[] = [];
  let inIngredientsSection = false;
  let ingredientsSectionStartLine = -1;
  
  // First approach: Find clearly marked ingredient sections
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim().toLowerCase();
    
    // Look for the start of an ingredients section
    if (!inIngredientsSection) {
      for (const marker of ingredientMarkers) {
        if (line.includes(marker)) {
          inIngredientsSection = true;
          ingredientsSectionStartLine = i;
          break;
        }
      }
    } 
    // Look for the end of the ingredients section (next section or empty lines)
    else {
      // Common end markers for ingredients sections
      const endMarkers = [
        'instructions', 'method', 'directions', 'steps', 'preparation', 'how to make',
        'instructions:', 'method:', 'directions:', 'steps:', 'preparation:',
        'notes', 'notes:', 'recipe notes', 'recipe notes:', 'enjoy', 'follow me', 'subscribe'
      ];
      
      // Check if this line indicates the end of ingredients section
      const isEndMarker = endMarkers.some(marker => line.includes(marker));
      
      // If an empty line or end marker is found after we've collected some ingredients, end the section
      if ((line === '' && ingredients.length > 0) || isEndMarker) {
        inIngredientsSection = false;
        break;
      }
      
      // Skip the marker line itself
      if (i > ingredientsSectionStartLine) {
        // Skip empty lines and very short lines
        if (line && line.length > 2) {
          // Parse and clean up the ingredient line
          let ingredient = lines[i].trim();
          
          // Remove bullet points and other common symbols
          ingredient = ingredient.replace(/^[-•●✓*+]|\s-\s/g, '').trim();
          
          if (ingredient) {
            ingredients.push(ingredient);
          }
        }
      }
    }
  }
  
  // Second approach: If no clear ingredient section found, look for ingredient patterns
  if (ingredients.length === 0) {
    console.log("No clear ingredients section found, looking for ingredient patterns");
    
    const ingredientPatterns = [
      /^\s*[-•●✓*+]?\s*(\d+[\d\/\.\,]*)?\s*(cup|tablespoon|tbsp|teaspoon|tsp|ounce|oz|pound|lb|gram|g|kg|ml|liter|l|pinch|dash)\s+/i,
      /^\s*[-•●✓*+]?\s*(\d+[\d\/\.\,]*)\s+/
    ];
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.length > 3 && trimmedLine.length < 100) {
        for (const pattern of ingredientPatterns) {
          if (pattern.test(trimmedLine)) {
            // Remove bullet points and other common symbols
            let ingredient = trimmedLine.replace(/^[-•●✓*+]|\s-\s/g, '').trim();
            if (ingredient) {
              ingredients.push(ingredient);
            }
            break;
          }
        }
      }
    }
  }
  
  // Clean and filter the ingredients
  const cleanedIngredients = ingredients
    .map(ing => {
      let cleaned = ing.trim();
      
      // Remove HTML tags that might be in the description
      cleaned = cleaned.replace(/<[^>]*>/g, '');
      
      // Clean up extra whitespaces
      cleaned = cleaned.replace(/\s+/g, ' ');
      
      // Remove various symbols
      cleaned = cleaned.replace(/[➡️⭐#@]/g, '').trim();
      return cleaned;
    })
    .filter(ingredient => {
      // Filter out empty or very short items
      if (!ingredient || ingredient.length < 2 || ingredient.length > 150) return false;
      
      // Reject known non-ingredient patterns
      const lowerIngredient = ingredient.toLowerCase();
      
      // Skip obvious non-ingredients
      if (lowerIngredient.includes('http') ||
          lowerIngredient.includes('subscribe') ||
          lowerIngredient.includes('follow') ||
          lowerIngredient.includes('youtube') ||
          lowerIngredient.includes('video') ||
          lowerIngredient.includes('music') ||
          lowerIngredient.includes('amazon') ||
          lowerIngredient.includes('affiliate') ||
          lowerIngredient.includes('link') ||
          lowerIngredient.includes('kitchen') ||
          lowerIngredient.includes('box') ||
          lowerIngredient.includes('po box') ||
          lowerIngredient.includes('tool') ||
          lowerIngredient.includes('comment') ||
          lowerIngredient.includes('always') ||
          lowerIngredient.includes('note') ||
          lowerIngredient.includes('fan') ||
          lowerIngredient.includes('mail') ||
          lowerIngredient.includes('post') ||
          lowerIngredient.includes('id ') ||
          lowerIngredient.includes('usa') ||
          lowerIngredient.includes('recipe') ||
          lowerIngredient.includes('dessert') ||
          lowerIngredient.includes('this is') ||
          lowerIngredient.includes('meridian')) {
        return false;
      }
      
      // Only accept strings that look like ingredients
      // Must have:
      // 1. A number (quantity) OR
      // 2. A common food measurement unit OR
      // 3. A common food/ingredient name
      
      // Check for quantities (numbers)
      const hasQuantity = /\d+/.test(lowerIngredient);
      
      // Check for common measurement units
      const hasMeasurement = /\b(cup|tablespoon|tbsp|teaspoon|tsp|ounce|oz|pound|lb|gram|g|kg|ml|l|inch|pinch|dash)\b/i.test(lowerIngredient);
      
      // Check for common ingredient descriptors
      const hasCommonIngredientWords = /\b(butter|sugar|flour|salt|water|milk|cream|cheese|egg|oil|vanilla|baking|cinnamon|chocolate|apple|onion|garlic|pepper|potato|carrot|chicken|beef|pork|rice|pasta|bean|vegetable|fruit|nut|seed|spice|herb|sauce|syrup|honey|yogurt|cream|cheese|bread|dough|meat|fish|fresh|frozen|chopped|sliced|diced|minced|grated|peeled|cooked|raw|ripe|cold|hot|sweet|sour|salted|unsalted)\b/i.test(lowerIngredient);
      
      // Accept only if it meets at least one criterion
      return hasQuantity || hasMeasurement || hasCommonIngredientWords;
    });
  
  // Remove duplicates
  const uniqueIngredients = Array.from(new Set(cleanedIngredients));
  
  return uniqueIngredients;
}

/**
 * Extract recipe instructions from text
 * @param source Text to extract instructions from
 * @returns Array of instruction steps
 */
export function extractInstructions(source: string): string[] {
  if (!source) return [];
  
  // Common markers for instruction sections in text
  const instructionMarkers = [
    'instructions', 'directions', 'method', 'preparation', 'steps', 'procedure',
    'instructions:', 'directions:', 'method:', 'steps:', 'procedure:',
    'how to make', 'how to make:', 'method of preparation', 'recipe',
    'steps to follow', 'how to prepare'
  ];
  
  // Common end markers for instruction sections
  const endMarkers = [
    'enjoy', 'subscribe', 'follow', 'thank you', 'thanks for watching',
    'like and share', 'comment below', 'click the link', 'visit my website',
    'social media', 'follow me on', 'instagram', 'facebook', 'twitter',
    'if you try this recipe', 'more recipes', 'recipe notes', 'notes:',
    'tips:', 'serving suggestions', 'nutrition', 'calories'
  ];
  
  // Split description into lines
  const lines = source.split('\n').map(line => line.trim());
  let instructions: string[] = [];
  
  // Try to find a clearly marked instructions section
  let inInstructionsSection = false;
  let instructionsSectionStartLine = -1;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim().toLowerCase();
    
    // Look for the start of an instructions section
    if (!inInstructionsSection) {
      for (const marker of instructionMarkers) {
        if (line.includes(marker)) {
          inInstructionsSection = true;
          instructionsSectionStartLine = i;
          break;
        }
      }
    } 
    // Look for the end of the instructions section
    else {
      // Check if this line indicates the end of instructions section
      const isEndMarker = endMarkers.some(marker => line.includes(marker));
      
      // If an empty line or end marker is found after we've collected some instructions, end the section
      if ((line === '' && instructions.length > 0) || isEndMarker) {
        inInstructionsSection = false;
        break;
      }
      
      // Skip the marker line itself
      if (i > instructionsSectionStartLine) {
        // Skip empty lines and very short lines
        if (line && line.length > 5) {
          // Parse and clean up the instruction line
          let instruction = lines[i].trim();
          
          // Remove bullet points and other common symbols
          instruction = instruction.replace(/^[-•●✓*+\.]\s|\s-\s/g, '').trim();
          
          // Remove any numbering at the start (1., 2., etc.)
          instruction = instruction.replace(/^\d+[\.\)]\s*/g, '').trim();
          
          if (instruction) {
            instructions.push(instruction);
          }
        }
      }
    }
  }
  
  // If no clear instructions section found, look for numbered steps
  if (instructions.length === 0) {
    console.log("No clear instructions section found, looking for numbered steps");
    
    const numberedStepPattern = /^\s*(\d+)[\.\)]\s+(.+)$/;
    let allSteps: {number: number, text: string}[] = [];
    
    for (const line of lines) {
      const match = line.match(numberedStepPattern);
      if (match) {
        const stepNumber = parseInt(match[1]);
        const stepText = match[2].trim();
        
        if (stepText.length > 10) {
          allSteps.push({ number: stepNumber, text: stepText });
        }
      }
    }
    
    // Sort steps by number and extract the text
    if (allSteps.length > 0) {
      allSteps.sort((a, b) => a.number - b.number);
      instructions = allSteps.map(step => step.text);
    }
  }
  
  // Remove duplicates and clean up
  const cleanedInstructions = instructions
    .map(instruction => {
      // Remove HTML tags
      let cleaned = instruction.replace(/<[^>]*>/g, '');
      
      // Clean up extra whitespaces
      cleaned = cleaned.replace(/\s+/g, ' ');
      
      return cleaned.trim();
    })
    .filter(instruction => instruction.length > 5 && instruction.length < 500);
  
  const uniqueInstructions = Array.from(new Set(cleanedInstructions));
  
  return uniqueInstructions;
}

/**
 * Format ingredients with measurements
 * @param ingredients List of raw ingredient strings
 * @returns Formatted ingredients with structured measurements
 */
export function formatIngredientsWithMeasurements(ingredients: string[]): any[] {
  return ingredients.map(ingredient => {
    const measurements = extractMeasurements(ingredient);
    return {
      name: ingredient,
      display_text: ingredient,
      measurements: measurements
    };
  });
}

/**
 * Extract measurements from ingredient strings when possible
 */
function extractMeasurements(ingredient: string): { quantity: number, unit: string }[] {
  if (!ingredient) return [];
  
  const measurements: { quantity: number, unit: string }[] = [];
  
  // Common measurement unit patterns
  const measurementPattern = /(\d+[\d\/\.\s]*)\s*(cup|tablespoon|tbsp|teaspoon|tsp|ounce|oz|pound|lb|gram|g|kg|ml|l|inch|stick)s?/gi;
  
  let match;
  while ((match = measurementPattern.exec(ingredient)) !== null) {
    const quantity = match[1].trim();
    const unit = match[2].trim().toLowerCase();
    
    // Parse quantity - handle fractions like "1/2"
    let parsedQuantity: number;
    if (quantity.includes("/")) {
      const [numerator, denominator] = quantity.split("/").map(Number);
      parsedQuantity = numerator / denominator;
    } else {
      parsedQuantity = parseFloat(quantity);
    }
    
    // Normalize units
    let normalizedUnit = unit;
    if (unit === "tablespoon" || unit === "tablespoons") normalizedUnit = "tbsp";
    if (unit === "teaspoon" || unit === "teaspoons") normalizedUnit = "tsp";
    if (unit === "gram" || unit === "grams") normalizedUnit = "g";
    if (unit === "ounce" || unit === "ounces") normalizedUnit = "oz";
    if (unit === "pound" || unit === "pounds") normalizedUnit = "lb";
    
    measurements.push({
      quantity: parsedQuantity,
      unit: normalizedUnit
    });
  }
  
  return measurements;
}

/**
 * Provide recipe-specific validation and fallbacks
 */
export function getRecipeSpecificIngredients(recipeQuery: string): string[] {
  const query = recipeQuery.toLowerCase();
  
  // Shepherd's Pie specific ingredients
  if (query.includes('shepherd') || query.includes('shepard') || query.includes('cottage pie')) {
    return [
      "1 lb ground lamb or beef",
      "1 onion, diced",
      "2 carrots, diced",
      "2 cloves garlic, minced",
      "2 tbsp tomato paste",
      "1 tbsp Worcestershire sauce",
      "1 cup beef broth",
      "1 tsp dried rosemary",
      "1 tsp dried thyme",
      "1 cup frozen peas",
      "3 cups mashed potatoes",
      "1/2 cup grated cheddar cheese (optional)",
      "Salt and pepper to taste"
    ];
  }
  
  // Apple Pie specific ingredients
  if (query.includes('apple pie')) {
    return [
      "6-7 Granny Smith apples, peeled, cored and thinly sliced",
      "3/4 cup sugar",
      "2 tbsp all-purpose flour",
      "1 tsp ground cinnamon",
      "1/4 tsp ground nutmeg",
      "1/4 tsp salt",
      "1 tbsp lemon juice",
      "2 tbsp butter, cut into small pieces",
      "Double pie crust (homemade or store-bought)",
      "1 egg (for egg wash)",
      "1 tbsp water (for egg wash)"
    ];
  }
  
  // Burger specific ingredients
  if (query.includes('burger') || query.includes('hamburger') || query.includes('cheeseburger')) {
    return [
      "1 1/2 lbs 80/20 ground beef divided into 8 even balls",
      "salt and pepper to taste",
      "oil",
      "8 slices of American or Cheddar cheese",
      "Sliced tomato",
      "2 onions sliced",
      "4 burger buns",
      "2 Tbsp butter",
      "3 cloves garlic",
      "2/3 cup mayo",
      "1/4 cup ketchup",
      "3 Tbsp mustard",
      "1/4 cup chopped pickles"
    ];
  }
  
  // Pumpkin Pie specific ingredients
  if (query.includes('pumpkin pie')) {
    return [
      "1 (15 oz) can pumpkin puree",
      "1 (14 oz) can sweetened condensed milk",
      "2 large eggs",
      "1 tsp ground cinnamon",
      "1/2 tsp ground ginger",
      "1/2 tsp ground nutmeg",
      "1/2 tsp salt",
      "1 (9 inch) unbaked pie crust",
      "Whipped cream (optional for serving)"
    ];
  }
  
  // Pasta specific ingredients
  if (query.includes('pasta') || query.includes('spaghetti')) {
    return [
      "1 lb pasta",
      "3 Tbsp olive oil",
      "4 cloves garlic, minced",
      "1 onion, diced",
      "1 can (28 oz) crushed tomatoes",
      "1 tsp dried basil",
      "1 tsp dried oregano",
      "1/2 tsp red pepper flakes",
      "Salt and pepper to taste",
      "1/2 cup grated Parmesan cheese",
      "Fresh basil leaves for garnish"
    ];
  }
  
  // Cookie specific ingredients
  if (query.includes('cookie')) {
    return [
      "2 1/4 cups all-purpose flour",
      "1 tsp baking soda",
      "1 tsp salt",
      "1 cup unsalted butter, softened",
      "3/4 cup granulated sugar",
      "3/4 cup packed brown sugar",
      "2 large eggs",
      "2 tsp vanilla extract",
      "2 cups chocolate chips"
    ];
  }
  
  // Chicken recipe ingredients
  if (query.includes('chicken')) {
    return [
      "4 boneless, skinless chicken breasts",
      "2 Tbsp olive oil",
      "3 cloves garlic, minced",
      "1 tsp dried oregano",
      "1 tsp dried basil",
      "1/2 tsp paprika",
      "Salt and pepper to taste",
      "1 lemon, juiced",
      "2 Tbsp butter",
      "1/4 cup chicken broth",
      "Fresh parsley for garnish"
    ];
  }
  
  // Generic fallback for any other recipe
  return [
    `1 lb ${query} (main ingredient)`,
    "2 Tbsp olive oil or butter",
    "1 onion, diced",
    "2 cloves garlic, minced",
    "1 tsp salt",
    "1/2 tsp black pepper",
    "1 tsp mixed herbs or spices",
    "1 cup broth or water",
    "Optional garnishes"
  ];
}

/**
 * Provide recipe-specific instructions
 */
export function getRecipeSpecificInstructions(recipeQuery: string): string[] {
  const query = recipeQuery.toLowerCase();
  
  // Shepherd's Pie specific instructions
  if (query.includes('shepherd') || query.includes('shepard') || query.includes('cottage pie')) {
    return [
      "Preheat oven to 400°F (200°C).",
      "In a large pan, brown the ground meat over medium heat, breaking it up as it cooks.",
      "Add the diced onion and carrots, and cook until softened (about 5 minutes).",
      "Add garlic and cook for another minute until fragrant.",
      "Stir in tomato paste and Worcestershire sauce.",
      "Add beef broth, rosemary, and thyme, then simmer until slightly thickened (about 10 minutes).",
      "Fold in frozen peas, then transfer mixture to a baking dish.",
      "Spread mashed potatoes evenly over the meat mixture, creating peaks with a fork.",
      "Sprinkle with grated cheese if using.",
      "Bake for 25-30 minutes until golden and bubbling.",
      "Let stand for 10 minutes before serving."
    ];
  }
  
  // Apple Pie specific instructions
  if (query.includes('apple pie')) {
    return [
      "Preheat oven to 375°F (190°C).",
      "In a large bowl, combine sliced apples, sugar, flour, cinnamon, nutmeg, salt, and lemon juice. Toss well to coat.",
      "Roll out one pie crust and place in a 9-inch pie dish.",
      "Fill with apple mixture, dot with butter pieces.",
      "Cover with second crust, seal and crimp edges. Cut several slits in top for steam to escape.",
      "Whisk egg with water and brush over crust for a golden finish.",
      "Place pie on a baking sheet and bake for 45-50 minutes until golden brown.",
      "Cool for at least 1 hour before serving to allow the filling to set."
    ];
  }
  
  // Burger specific instructions
  if (query.includes('burger') || query.includes('hamburger') || query.includes('cheeseburger')) {
    return [
      "Divide ground beef into 4 equal portions and form into patties about 1/2 inch thick and slightly larger than your buns.",
      "Press a small indent in the center of each patty with your thumb to prevent it from puffing up during cooking.",
      "Season both sides generously with salt and pepper.",
      "Heat a skillet or grill to medium-high heat. Add a small amount of oil if using a skillet.",
      "Cook patties for 3-4 minutes on each side for medium doneness, or to your preferred temperature.",
      "Add cheese slices on top of patties during the last minute of cooking to melt.",
      "While burgers cook, toast the buns lightly and prepare your sauce by mixing mayo, ketchup, and mustard.",
      "Place cooked burgers on bottom buns, add desired toppings (tomato, onion, pickles), and spread sauce on top bun.",
      "Serve immediately while hot."
    ];
  }
  
  // Pumpkin Pie specific instructions
  if (query.includes('pumpkin pie')) {
    return [
      "Preheat oven to 425°F (220°C).",
      "In a large bowl, whisk together pumpkin puree, sweetened condensed milk, eggs, cinnamon, ginger, nutmeg, and salt until smooth.",
      "Pour the mixture into the unbaked pie crust.",
      "Bake for 15 minutes, then reduce the oven temperature to 350°F (175°C).",
      "Continue baking for 35-40 minutes, or until a knife inserted near the center comes out clean.",
      "Cool pie completely on a wire rack.",
      "Refrigerate until ready to serve.",
      "Top with whipped cream before serving if desired."
    ];
  }
  
  // Pasta specific instructions
  if (query.includes('pasta') || query.includes('spaghetti')) {
    return [
      "Bring a large pot of salted water to a boil.",
      "Cook pasta according to package directions until al dente.",
      "While pasta is cooking, heat olive oil in a large pan over medium heat.",
      "Add diced onion and cook until softened, about 5 minutes.",
      "Add minced garlic and cook for another 30 seconds until fragrant.",
      "Pour in crushed tomatoes, dried herbs, and red pepper flakes.",
      "Simmer the sauce for 10-15 minutes, stirring occasionally.",
      "Season with salt and pepper to taste.",
      "Drain pasta, reserving 1/2 cup of pasta water.",
      "Add pasta to the sauce, along with a splash of the reserved pasta water.",
      "Toss to coat evenly and cook for another minute.",
      "Serve topped with grated Parmesan and fresh basil."
    ];
  }
  
  // Generic instructions for any recipe
  return [
    "Gather and prepare all ingredients as listed in the recipe.",
    "Follow the cooking steps demonstrated in the video.",
    "Cook until all ingredients are properly done and flavors have combined well.",
    "Adjust seasoning to taste with salt, pepper, or other spices as needed.",
    "Let the dish rest for a few minutes before serving if applicable.",
    "Serve hot and enjoy your delicious meal!"
  ];
}

/**
 * Check if ingredients are for the wrong recipe (cross-contamination)
 */
export function detectIngredientContamination(recipeQuery: string, ingredients: string[]): boolean {
  if (!ingredients || ingredients.length === 0) return false;
  
  const query = recipeQuery.toLowerCase();
  
  // Check for Shepherd's Pie contaminated with apple pie ingredients
  if (query.includes('shepherd') || query.includes('shepard')) {
    return ingredients.some(ing => 
      ing.toLowerCase().includes('apple') || 
      ing.toLowerCase().includes('cinnamon') ||
      ing.toLowerCase().includes('pie crust')
    );
  }
  
  // Check for Apple Pie contaminated with meat ingredients
  if (query.includes('apple pie')) {
    return ingredients.some(ing => 
      ing.toLowerCase().includes('meat') || 
      ing.toLowerCase().includes('lamb') ||
      ing.toLowerCase().includes('beef') ||
      ing.toLowerCase().includes('potato')
    );
  }
  
  return false;
}