/**
 * Familiar Dish Name Mapping System
 * 
 * Maps generated meal titles to recognizable, cuisine-correct English names
 * Focuses on familiar naming without internationalization/translation
 * Ensures dishes are mapped to well-known names by cuisine type
 */

export interface DishMapping {
  originalPattern: string | RegExp;
  familiarName: string;
  cuisine: string;
  category: string;
  aliases: string[];
}

export interface CuisineMapping {
  cuisine: string;
  commonDishes: DishMapping[];
  defaultModifiers: string[];
  cookingMethods: string[];
}

// Comprehensive mapping of common dishes to familiar English names
export const FAMILIAR_DISH_MAPPINGS: CuisineMapping[] = [
  {
    cuisine: 'Italian',
    defaultModifiers: ['Classic', 'Homestyle', 'Traditional'],
    cookingMethods: ['Baked', 'Pan-fried', 'Grilled'],
    commonDishes: [
      {
        originalPattern: /spaghetti.*carbonara/i,
        familiarName: 'Spaghetti Carbonara',
        cuisine: 'Italian',
        category: 'pasta',
        aliases: ['carbonara pasta', 'creamy bacon pasta']
      },
      {
        originalPattern: /lasagna|lasagne/i,
        familiarName: 'Lasagna',
        cuisine: 'Italian',
        category: 'pasta',
        aliases: ['layered pasta', 'baked pasta']
      },
      {
        originalPattern: /chicken.*parmigiana|chicken.*parmesan/i,
        familiarName: 'Chicken Parmesan',
        cuisine: 'Italian',
        category: 'entree',
        aliases: ['chicken parmigiana', 'breaded chicken']
      },
      {
        originalPattern: /fettuccine.*alfredo/i,
        familiarName: 'Fettuccine Alfredo',
        cuisine: 'Italian',
        category: 'pasta',
        aliases: ['creamy pasta', 'alfredo pasta']
      },
      {
        originalPattern: /margherita.*pizza/i,
        familiarName: 'Margherita Pizza',
        cuisine: 'Italian',
        category: 'pizza',
        aliases: ['cheese pizza', 'tomato basil pizza']
      },
      {
        originalPattern: /risotto/i,
        familiarName: 'Risotto',
        cuisine: 'Italian',
        category: 'rice',
        aliases: ['creamy rice', 'italian rice']
      }
    ]
  },
  
  {
    cuisine: 'Chinese',
    defaultModifiers: ['Authentic', 'Traditional', 'Classic'],
    cookingMethods: ['Stir-fried', 'Steamed', 'Braised'],
    commonDishes: [
      {
        originalPattern: /beef.*stir.?fry|stir.?fry.*beef/i,
        familiarName: 'Beef Stir Fry',
        cuisine: 'Chinese',
        category: 'entree',
        aliases: ['beef and vegetables', 'wok beef']
      },
      {
        originalPattern: /fried.*rice/i,
        familiarName: 'Fried Rice',
        cuisine: 'Chinese',
        category: 'rice',
        aliases: ['chinese fried rice', 'wok rice']
      },
      {
        originalPattern: /sweet.*sour.*pork|sweet.*sour.*chicken/i,
        familiarName: 'Sweet and Sour Pork',
        cuisine: 'Chinese',
        category: 'entree',
        aliases: ['sweet sour pork', 'glazed pork']
      },
      {
        originalPattern: /kung.*pao.*chicken/i,
        familiarName: 'Kung Pao Chicken',
        cuisine: 'Chinese',
        category: 'entree',
        aliases: ['spicy peanut chicken', 'sichuan chicken']
      },
      {
        originalPattern: /lo.*mein/i,
        familiarName: 'Lo Mein',
        cuisine: 'Chinese',
        category: 'noodles',
        aliases: ['soft noodles', 'chinese noodles']
      },
      {
        originalPattern: /dumplings|potstickers/i,
        familiarName: 'Dumplings',
        cuisine: 'Chinese',
        category: 'appetizer',
        aliases: ['potstickers', 'steamed dumplings']
      }
    ]
  },
  
  {
    cuisine: 'Mexican',
    defaultModifiers: ['Authentic', 'Traditional', 'Classic'],
    cookingMethods: ['Grilled', 'Slow-cooked', 'Pan-fried'],
    commonDishes: [
      {
        originalPattern: /beef.*tacos|chicken.*tacos|fish.*tacos/i,
        familiarName: 'Tacos',
        cuisine: 'Mexican',
        category: 'entree',
        aliases: ['soft tacos', 'street tacos']
      },
      {
        originalPattern: /quesadilla/i,
        familiarName: 'Quesadilla',
        cuisine: 'Mexican',
        category: 'entree',
        aliases: ['cheese tortilla', 'grilled tortilla']
      },
      {
        originalPattern: /enchiladas/i,
        familiarName: 'Enchiladas',
        cuisine: 'Mexican',
        category: 'entree',
        aliases: ['rolled tortillas', 'sauced tortillas']
      },
      {
        originalPattern: /burrito/i,
        familiarName: 'Burrito',
        cuisine: 'Mexican',
        category: 'entree',
        aliases: ['wrapped tortilla', 'stuffed tortilla']
      },
      {
        originalPattern: /guacamole/i,
        familiarName: 'Guacamole',
        cuisine: 'Mexican',
        category: 'appetizer',
        aliases: ['avocado dip', 'mexican avocado']
      },
      {
        originalPattern: /carnitas/i,
        familiarName: 'Carnitas',
        cuisine: 'Mexican',
        category: 'entree',
        aliases: ['slow-cooked pork', 'shredded pork']
      }
    ]
  },
  
  {
    cuisine: 'Indian',
    defaultModifiers: ['Authentic', 'Traditional', 'Spiced'],
    cookingMethods: ['Curried', 'Tandoori', 'Slow-cooked'],
    commonDishes: [
      {
        originalPattern: /chicken.*tikka.*masala/i,
        familiarName: 'Chicken Tikka Masala',
        cuisine: 'Indian',
        category: 'curry',
        aliases: ['creamy chicken curry', 'tomato chicken curry']
      },
      {
        originalPattern: /butter.*chicken/i,
        familiarName: 'Butter Chicken',
        cuisine: 'Indian',
        category: 'curry',
        aliases: ['murgh makhani', 'creamy chicken']
      },
      {
        originalPattern: /biryani/i,
        familiarName: 'Biryani',
        cuisine: 'Indian',
        category: 'rice',
        aliases: ['spiced rice', 'layered rice']
      },
      {
        originalPattern: /naan/i,
        familiarName: 'Naan Bread',
        cuisine: 'Indian',
        category: 'bread',
        aliases: ['indian bread', 'flatbread']
      },
      {
        originalPattern: /dal|lentil.*curry/i,
        familiarName: 'Dal',
        cuisine: 'Indian',
        category: 'curry',
        aliases: ['lentil curry', 'spiced lentils']
      },
      {
        originalPattern: /samosa/i,
        familiarName: 'Samosa',
        cuisine: 'Indian',
        category: 'appetizer',
        aliases: ['fried pastry', 'stuffed pastry']
      }
    ]
  },
  
  {
    cuisine: 'Thai',
    defaultModifiers: ['Authentic', 'Traditional', 'Fresh'],
    cookingMethods: ['Stir-fried', 'Steamed', 'Grilled'],
    commonDishes: [
      {
        originalPattern: /pad.*thai/i,
        familiarName: 'Pad Thai',
        cuisine: 'Thai',
        category: 'noodles',
        aliases: ['thai noodles', 'stir-fried noodles']
      },
      {
        originalPattern: /green.*curry|red.*curry|yellow.*curry/i,
        familiarName: 'Thai Curry',
        cuisine: 'Thai',
        category: 'curry',
        aliases: ['coconut curry', 'thai coconut curry']
      },
      {
        originalPattern: /tom.*yum/i,
        familiarName: 'Tom Yum Soup',
        cuisine: 'Thai',
        category: 'soup',
        aliases: ['spicy thai soup', 'lemongrass soup']
      },
      {
        originalPattern: /massaman.*curry/i,
        familiarName: 'Massaman Curry',
        cuisine: 'Thai',
        category: 'curry',
        aliases: ['mild thai curry', 'peanut curry']
      },
      {
        originalPattern: /som.*tam/i,
        familiarName: 'Som Tam',
        cuisine: 'Thai',
        category: 'salad',
        aliases: ['papaya salad', 'green papaya salad']
      }
    ]
  },
  
  {
    cuisine: 'Japanese',
    defaultModifiers: ['Authentic', 'Traditional', 'Fresh'],
    cookingMethods: ['Grilled', 'Steamed', 'Raw'],
    commonDishes: [
      {
        originalPattern: /sushi/i,
        familiarName: 'Sushi',
        cuisine: 'Japanese',
        category: 'appetizer',
        aliases: ['raw fish', 'rice rolls']
      },
      {
        originalPattern: /ramen/i,
        familiarName: 'Ramen',
        cuisine: 'Japanese',
        category: 'soup',
        aliases: ['japanese noodle soup', 'noodle bowl']
      },
      {
        originalPattern: /tempura/i,
        familiarName: 'Tempura',
        cuisine: 'Japanese',
        category: 'appetizer',
        aliases: ['battered vegetables', 'fried vegetables']
      },
      {
        originalPattern: /teriyaki.*chicken|chicken.*teriyaki/i,
        familiarName: 'Chicken Teriyaki',
        cuisine: 'Japanese',
        category: 'entree',
        aliases: ['glazed chicken', 'sweet soy chicken']
      },
      {
        originalPattern: /miso.*soup/i,
        familiarName: 'Miso Soup',
        cuisine: 'Japanese',
        category: 'soup',
        aliases: ['soybean soup', 'japanese soup']
      }
    ]
  },
  
  {
    cuisine: 'American',
    defaultModifiers: ['Classic', 'Traditional', 'Homestyle'],
    cookingMethods: ['Grilled', 'Fried', 'Baked'],
    commonDishes: [
      {
        originalPattern: /burger|hamburger/i,
        familiarName: 'Hamburger',
        cuisine: 'American',
        category: 'entree',
        aliases: ['burger', 'beef patty']
      },
      {
        originalPattern: /mac.*cheese|macaroni.*cheese/i,
        familiarName: 'Mac and Cheese',
        cuisine: 'American',
        category: 'entree',
        aliases: ['macaroni and cheese', 'cheese pasta']
      },
      {
        originalPattern: /fried.*chicken/i,
        familiarName: 'Fried Chicken',
        cuisine: 'American',
        category: 'entree',
        aliases: ['crispy chicken', 'southern chicken']
      },
      {
        originalPattern: /bbq.*ribs|barbecue.*ribs/i,
        familiarName: 'BBQ Ribs',
        cuisine: 'American',
        category: 'entree',
        aliases: ['barbecue ribs', 'smoked ribs']
      },
      {
        originalPattern: /caesar.*salad/i,
        familiarName: 'Caesar Salad',
        cuisine: 'American',
        category: 'salad',
        aliases: ['romaine salad', 'parmesan salad']
      }
    ]
  }
];

// Generic dish patterns for unrecognized cuisines
export const GENERIC_DISH_PATTERNS: DishMapping[] = [
  {
    originalPattern: /stir.?fry/i,
    familiarName: 'Stir Fry',
    cuisine: 'International',
    category: 'entree',
    aliases: ['wok dish', 'stir-fried vegetables']
  },
  {
    originalPattern: /curry/i,
    familiarName: 'Curry',
    cuisine: 'International',
    category: 'curry',
    aliases: ['spiced stew', 'curried dish']
  },
  {
    originalPattern: /soup/i,
    familiarName: 'Soup',
    cuisine: 'International',
    category: 'soup',
    aliases: ['broth', 'stew']
  },
  {
    originalPattern: /salad/i,
    familiarName: 'Salad',
    cuisine: 'International',
    category: 'salad',
    aliases: ['mixed greens', 'fresh vegetables']
  },
  {
    originalPattern: /pasta/i,
    familiarName: 'Pasta',
    cuisine: 'International',
    category: 'pasta',
    aliases: ['noodles', 'spaghetti']
  }
];

/**
 * Map a generated dish name to a familiar, recognizable English name
 */
export function mapToFamiliarDishName(
  originalTitle: string,
  detectedCuisine?: string,
  ingredients?: string[]
): {
  familiarName: string;
  cuisine: string;
  confidence: number;
  mapping?: DishMapping;
} {
  
  if (!originalTitle) {
    return {
      familiarName: 'Unknown Dish',
      cuisine: 'International',
      confidence: 0.1
    };
  }

  // First try cuisine-specific mappings
  if (detectedCuisine) {
    const cuisineMapping = FAMILIAR_DISH_MAPPINGS.find(
      c => c.cuisine.toLowerCase() === detectedCuisine.toLowerCase()
    );
    
    if (cuisineMapping) {
      for (const dish of cuisineMapping.commonDishes) {
        if (matchesDishPattern(originalTitle, dish.originalPattern)) {
          return {
            familiarName: dish.familiarName,
            cuisine: dish.cuisine,
            confidence: 0.9,
            mapping: dish
          };
        }
      }
    }
  }
  
  // Try all cuisine mappings if no specific cuisine provided
  for (const cuisineMapping of FAMILIAR_DISH_MAPPINGS) {
    for (const dish of cuisineMapping.commonDishes) {
      if (matchesDishPattern(originalTitle, dish.originalPattern)) {
        return {
          familiarName: dish.familiarName,
          cuisine: dish.cuisine,
          confidence: 0.8,
          mapping: dish
        };
      }
    }
  }
  
  // Try generic patterns
  for (const pattern of GENERIC_DISH_PATTERNS) {
    if (matchesDishPattern(originalTitle, pattern.originalPattern)) {
      const enhancedName = enhanceGenericName(originalTitle, pattern, ingredients);
      return {
        familiarName: enhancedName,
        cuisine: pattern.cuisine,
        confidence: 0.6,
        mapping: pattern
      };
    }
  }
  
  // Fallback: clean up the original title
  const cleanedTitle = cleanUpDishTitle(originalTitle);
  const detectedCuisineFromTitle = detectCuisineFromTitle(originalTitle);
  
  return {
    familiarName: cleanedTitle,
    cuisine: detectedCuisineFromTitle || 'International',
    confidence: 0.4
  };
}

/**
 * Get all familiar names for a specific cuisine
 */
export function getFamiliarDishesByCuisine(cuisine: string): DishMapping[] {
  const cuisineMapping = FAMILIAR_DISH_MAPPINGS.find(
    c => c.cuisine.toLowerCase() === cuisine.toLowerCase()
  );
  
  return cuisineMapping ? cuisineMapping.commonDishes : [];
}

/**
 * Search for dishes by name or ingredients
 */
export function searchFamiliarDishes(query: string): DishMapping[] {
  const results: DishMapping[] = [];
  const normalizedQuery = query.toLowerCase();
  
  for (const cuisineMapping of FAMILIAR_DISH_MAPPINGS) {
    for (const dish of cuisineMapping.commonDishes) {
      // Check dish name
      if (dish.familiarName.toLowerCase().includes(normalizedQuery)) {
        results.push(dish);
        continue;
      }
      
      // Check aliases
      if (dish.aliases.some(alias => alias.toLowerCase().includes(normalizedQuery))) {
        results.push(dish);
        continue;
      }
      
      // Check pattern match
      if (matchesDishPattern(query, dish.originalPattern)) {
        results.push(dish);
      }
    }
  }
  
  return results;
}

/**
 * Helper functions
 */

function matchesDishPattern(title: string, pattern: string | RegExp): boolean {
  if (pattern instanceof RegExp) {
    return pattern.test(title);
  }
  return title.toLowerCase().includes(pattern.toLowerCase());
}

function enhanceGenericName(
  originalTitle: string,
  pattern: DishMapping,
  ingredients?: string[]
): string {
  let enhanced = pattern.familiarName;
  
  // Try to add main protein or vegetable
  if (ingredients && ingredients.length > 0) {
    const mainIngredient = findMainIngredient(ingredients);
    if (mainIngredient) {
      enhanced = `${mainIngredient} ${enhanced}`;
    }
  } else {
    // Extract from title
    const extractedIngredient = extractMainIngredientFromTitle(originalTitle);
    if (extractedIngredient) {
      enhanced = `${extractedIngredient} ${enhanced}`;
    }
  }
  
  return enhanced;
}

function findMainIngredient(ingredients: string[]): string | null {
  const proteins = ['chicken', 'beef', 'pork', 'fish', 'salmon', 'shrimp', 'tofu', 'turkey'];
  const vegetables = ['broccoli', 'mushroom', 'pepper', 'onion', 'carrot', 'spinach'];
  
  // Prioritize proteins
  for (const ingredient of ingredients) {
    const ingredientStr = typeof ingredient === 'string' ? ingredient : ingredient.name || '';
    for (const protein of proteins) {
      if (ingredientStr.toLowerCase().includes(protein)) {
        return protein.charAt(0).toUpperCase() + protein.slice(1);
      }
    }
  }
  
  // Then vegetables
  for (const ingredient of ingredients) {
    const ingredientStr = typeof ingredient === 'string' ? ingredient : ingredient.name || '';
    for (const vegetable of vegetables) {
      if (ingredientStr.toLowerCase().includes(vegetable)) {
        return vegetable.charAt(0).toUpperCase() + vegetable.slice(1);
      }
    }
  }
  
  return null;
}

function extractMainIngredientFromTitle(title: string): string | null {
  const words = title.toLowerCase().split(/\s+/);
  const proteins = ['chicken', 'beef', 'pork', 'fish', 'salmon', 'shrimp', 'tofu', 'turkey'];
  const vegetables = ['broccoli', 'mushroom', 'pepper', 'onion', 'carrot', 'spinach'];
  
  for (const word of words) {
    for (const protein of proteins) {
      if (word.includes(protein)) {
        return protein.charAt(0).toUpperCase() + protein.slice(1);
      }
    }
  }
  
  for (const word of words) {
    for (const vegetable of vegetables) {
      if (word.includes(vegetable)) {
        return vegetable.charAt(0).toUpperCase() + vegetable.slice(1);
      }
    }
  }
  
  return null;
}

function cleanUpDishTitle(title: string): string {
  // Remove common AI-generated prefixes
  let cleaned = title.replace(/^(AI\s+|Generated\s+|Recipe\s+for\s+)/i, '');
  
  // Capitalize properly
  cleaned = cleaned.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
  
  // Remove extra whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
}

function detectCuisineFromTitle(title: string): string | null {
  const cuisineKeywords: Record<string, string[]> = {
    'Italian': ['italian', 'pasta', 'pizza', 'risotto', 'parmesan', 'marinara'],
    'Chinese': ['chinese', 'stir-fry', 'wok', 'soy sauce', 'rice', 'noodles'],
    'Mexican': ['mexican', 'tacos', 'salsa', 'guacamole', 'beans', 'tortilla'],
    'Indian': ['indian', 'curry', 'spices', 'turmeric', 'cumin', 'garam'],
    'Thai': ['thai', 'coconut', 'lemongrass', 'basil', 'lime', 'chili'],
    'Japanese': ['japanese', 'sushi', 'soy', 'miso', 'wasabi', 'sake'],
    'American': ['american', 'bbq', 'grill', 'fries', 'burger', 'ranch']
  };
  
  const normalizedTitle = title.toLowerCase();
  
  for (const [cuisine, keywords] of Object.entries(cuisineKeywords)) {
    if (keywords.some(keyword => normalizedTitle.includes(keyword))) {
      return cuisine;
    }
  }
  
  return null;
}

/**
 * Get cuisine-specific cooking methods and modifiers
 */
export function getCuisineEnhancements(cuisine: string): {
  modifiers: string[];
  cookingMethods: string[];
} {
  const cuisineMapping = FAMILIAR_DISH_MAPPINGS.find(
    c => c.cuisine.toLowerCase() === cuisine.toLowerCase()
  );
  
  return {
    modifiers: cuisineMapping?.defaultModifiers || ['Traditional'],
    cookingMethods: cuisineMapping?.cookingMethods || ['Cooked']
  };
}

/**
 * Validate if a dish name fits the cuisine
 */
export function validateDishCuisineMatch(dishName: string, expectedCuisine: string): {
  isMatch: boolean;
  confidence: number;
  suggestedCorrection?: string;
} {
  const mapping = mapToFamiliarDishName(dishName, expectedCuisine);
  
  const isMatch = mapping.cuisine.toLowerCase() === expectedCuisine.toLowerCase();
  
  if (!isMatch && mapping.confidence > 0.7) {
    // Suggest a correction
    const correctCuisineDishes = getFamiliarDishesByCuisine(expectedCuisine);
    const suggested = correctCuisineDishes[0]?.familiarName;
    
    return {
      isMatch: false,
      confidence: mapping.confidence,
      suggestedCorrection: suggested
    };
  }
  
  return {
    isMatch,
    confidence: mapping.confidence
  };
}