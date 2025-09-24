/**
 * Migration utility for cultural cuisine masterlist
 * Handles backward compatibility and data enrichment
 */

import fs from 'fs';
import path from 'path';

interface LegacyCuisineDefinition {
  label: string;
  aliases: string[];
}

interface EnhancedCuisineDefinition {
  id: string;
  label: string;
  aliases: string[];
  metadata?: {
    origin?: {
      primary_region: string;
      countries: string[];
      geographic_tags: string[];
    };
    characteristics?: {
      flavor_profile: string[];
      cooking_methods: string[];
      key_ingredients: string[];
      signature_dishes: string[];
    };
    dietary_info?: {
      common_restrictions: string[];
      allergen_considerations: string[];
      health_adaptations: string[];
    };
    searchability?: {
      popularity_score: number;
      difficulty_level: string;
      availability_score: number;
      keywords: string[];
    };
  };
  related_cuisines?: string[];
  regional_variations?: Array<{
    name: string;
    description: string;
    signature_dishes?: string[];
  }>;
}

interface MasterlistV2 {
  schema_version: string;
  last_updated: string;
  total_cuisines: number;
  description: string;
  cuisines: EnhancedCuisineDefinition[];
  categories?: {
    by_region: { [region: string]: string[] };
    by_difficulty: { [level: string]: string[] };
    by_dietary: { [type: string]: string[] };
  };
  search_indexes?: {
    keywords: { [keyword: string]: string[] };
    ingredients: { [ingredient: string]: string[] };
  };
}

// Enhanced metadata definitions for major cuisines
const CUISINE_ENHANCEMENTS: { [label: string]: Partial<EnhancedCuisineDefinition> } = {
  "Southern US": {
    metadata: {
      origin: {
        primary_region: "Southern United States",
        countries: ["United States"],
        geographic_tags: ["North America", "Southeast US"]
      },
      characteristics: {
        flavor_profile: ["hearty", "comfort", "rich", "smoky"],
        cooking_methods: ["frying", "slow-cooking", "smoking", "braising"],
        key_ingredients: ["cornmeal", "okra", "collard greens", "bacon"],
        signature_dishes: ["fried chicken", "gumbo", "mac and cheese", "cornbread"]
      },
      searchability: {
        popularity_score: 8.5,
        difficulty_level: "medium",
        availability_score: 9.0,
        keywords: ["comfort food", "american", "traditional", "hearty"]
      }
    },
    related_cuisines: ["Caribbean", "French", "West African"]
  },
  "Italian": {
    metadata: {
      origin: {
        primary_region: "Italy",
        countries: ["Italy"],
        geographic_tags: ["Southern Europe", "Mediterranean"]
      },
      characteristics: {
        flavor_profile: ["fresh", "aromatic", "simple", "herb-forward"],
        cooking_methods: ["sautéing", "grilling", "slow-simmering", "wood-fired"],
        key_ingredients: ["olive oil", "tomatoes", "basil", "garlic", "parmesan"],
        signature_dishes: ["pasta carbonara", "pizza margherita", "risotto", "tiramisu"]
      },
      searchability: {
        popularity_score: 9.8,
        difficulty_level: "easy-medium",
        availability_score: 9.5,
        keywords: ["pasta", "pizza", "mediterranean", "healthy", "classic"]
      }
    },
    related_cuisines: ["French", "Spanish", "Greek", "Mediterranean"]
  },
  "Mexican": {
    metadata: {
      origin: {
        primary_region: "Mexico",
        countries: ["Mexico"],
        geographic_tags: ["North America", "Latin America"]
      },
      characteristics: {
        flavor_profile: ["spicy", "complex", "earthy", "bright"],
        cooking_methods: ["grilling", "braising", "steaming", "charring"],
        key_ingredients: ["chiles", "corn", "beans", "cilantro", "lime"],
        signature_dishes: ["mole", "tacos", "tamales", "guacamole"]
      },
      searchability: {
        popularity_score: 9.5,
        difficulty_level: "medium",
        availability_score: 8.8,
        keywords: ["spicy", "authentic", "street food", "fresh"]
      }
    },
    related_cuisines: ["Spanish", "Southwestern US", "Peruvian"]
  },
  "Chinese": {
    metadata: {
      origin: {
        primary_region: "China",
        countries: ["China", "Taiwan", "Hong Kong"],
        geographic_tags: ["East Asia", "Asia-Pacific"]
      },
      characteristics: {
        flavor_profile: ["umami", "balanced", "aromatic"],
        cooking_methods: ["stir-frying", "steaming", "braising", "deep-frying"],
        key_ingredients: ["soy sauce", "ginger", "garlic", "rice", "noodles"],
        signature_dishes: ["kung pao chicken", "dim sum", "fried rice", "hot pot"]
      },
      searchability: {
        popularity_score: 9.7,
        difficulty_level: "medium",
        availability_score: 9.2,
        keywords: ["stir fry", "healthy", "quick", "traditional"]
      }
    },
    related_cuisines: ["Japanese", "Korean", "Vietnamese", "Thai"]
  },
  "Indian": {
    metadata: {
      origin: {
        primary_region: "Indian Subcontinent",
        countries: ["India", "Pakistan", "Bangladesh"],
        geographic_tags: ["South Asia", "Asia-Pacific"]
      },
      characteristics: {
        flavor_profile: ["spicy", "aromatic", "complex", "warming"],
        cooking_methods: ["slow-cooking", "tempering", "tandoor", "grinding"],
        key_ingredients: ["cumin", "turmeric", "garam masala", "ginger", "chiles"],
        signature_dishes: ["butter chicken", "biryani", "dal", "naan", "curry"]
      },
      searchability: {
        popularity_score: 9.3,
        difficulty_level: "medium-hard",
        availability_score: 8.5,
        keywords: ["curry", "spicy", "vegetarian", "aromatic"]
      }
    },
    related_cuisines: ["Pakistani", "Bangladeshi", "Sri Lankan"]
  }
};

export async function migrateMasterlistToV2(): Promise<void> {
  console.log('🔧 Starting cuisine masterlist migration to v2...');
  
  try {
    // Read the legacy masterlist
    const legacyPath = path.join(process.cwd(), 'client', 'src', 'data', 'cultural_cuisine_masterlist.json');
    const legacyData = await fs.promises.readFile(legacyPath, 'utf-8');
    const legacyCuisines: LegacyCuisineDefinition[] = JSON.parse(legacyData);
    
    console.log(`📚 Found ${legacyCuisines.length} legacy cuisine definitions`);
    
    // Create enhanced definitions
    const enhancedCuisines: EnhancedCuisineDefinition[] = legacyCuisines.map(legacy => {
      const id = legacy.label.toLowerCase().replace(/\\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const enhancement = CUISINE_ENHANCEMENTS[legacy.label] || {};
      
      return {
        id,
        label: legacy.label,
        aliases: legacy.aliases,
        ...enhancement
      };
    });
    
    // Create the new v2 structure
    const v2Masterlist: MasterlistV2 = {
      schema_version: "2.0.0",
      last_updated: new Date().toISOString().split('T')[0],
      total_cuisines: enhancedCuisines.length,
      description: "Enhanced cultural cuisine taxonomy with rich metadata for improved matching and recommendations",
      cuisines: enhancedCuisines,
      categories: generateCategories(enhancedCuisines),
      search_indexes: generateSearchIndexes(enhancedCuisines)
    };
    
    // Write the enhanced masterlist
    const enhancedPath = path.join(process.cwd(), 'client', 'src', 'data', 'cultural_cuisine_masterlist_v2.json');
    await fs.promises.writeFile(enhancedPath, JSON.stringify(v2Masterlist, null, 2), 'utf-8');
    
    // Backup original
    const backupPath = path.join(process.cwd(), 'client', 'src', 'data', 'cultural_cuisine_masterlist_backup.json');
    await fs.promises.writeFile(backupPath, legacyData, 'utf-8');
    
    console.log(`✅ Migration complete:`);
    console.log(`  - Enhanced: ${enhancedPath}`);
    console.log(`  - Backup: ${backupPath}`);
    console.log(`  - Enhanced ${enhancedCuisines.length} cuisines with metadata`);
    
  } catch (error) {
    console.error('🚨 Migration failed:', error);
    throw error;
  }
}

function generateCategories(cuisines: EnhancedCuisineDefinition[]): MasterlistV2['categories'] {
  const categories = {
    by_region: {} as { [region: string]: string[] },
    by_difficulty: {} as { [level: string]: string[] },
    by_dietary: {} as { [type: string]: string[] }
  };
  
  cuisines.forEach(cuisine => {
    // Regional categorization
    const region = cuisine.metadata?.origin?.geographic_tags?.[0];
    if (region) {
      if (!categories.by_region[region]) categories.by_region[region] = [];
      categories.by_region[region].push(cuisine.label);
    }
    
    // Difficulty categorization
    const difficulty = cuisine.metadata?.searchability?.difficulty_level;
    if (difficulty) {
      if (!categories.by_difficulty[difficulty]) categories.by_difficulty[difficulty] = [];
      categories.by_difficulty[difficulty].push(cuisine.label);
    }
    
    // Dietary categorization (basic implementation)
    if (cuisine.label === 'Indian' || cuisine.label === 'Italian') {
      if (!categories.by_dietary.vegetarian_friendly) categories.by_dietary.vegetarian_friendly = [];
      categories.by_dietary.vegetarian_friendly.push(cuisine.label);
    }
  });
  
  return categories;
}

function generateSearchIndexes(cuisines: EnhancedCuisineDefinition[]): MasterlistV2['search_indexes'] {
  const indexes = {
    keywords: {} as { [keyword: string]: string[] },
    ingredients: {} as { [ingredient: string]: string[] }
  };
  
  cuisines.forEach(cuisine => {
    // Index keywords
    cuisine.metadata?.searchability?.keywords?.forEach(keyword => {
      if (!indexes.keywords[keyword]) indexes.keywords[keyword] = [];
      indexes.keywords[keyword].push(cuisine.label);
    });
    
    // Index ingredients
    cuisine.metadata?.characteristics?.key_ingredients?.forEach(ingredient => {
      if (!indexes.ingredients[ingredient]) indexes.ingredients[ingredient] = [];
      indexes.ingredients[ingredient].push(cuisine.label);
    });
  });
  
  return indexes;
}

// Utility function to load the appropriate masterlist version
export async function loadMasterlist(preferV2: boolean = true): Promise<LegacyCuisineDefinition[] | MasterlistV2> {
  const basePath = path.join(process.cwd(), 'client', 'src', 'data');
  
  if (preferV2) {
    try {
      const v2Path = path.join(basePath, 'cultural_cuisine_masterlist_v2.json');
      const v2Data = await fs.promises.readFile(v2Path, 'utf-8');
      return JSON.parse(v2Data) as MasterlistV2;
    } catch (error) {
      console.log('📄 V2 masterlist not found, falling back to legacy format');
    }
  }
  
  // Fallback to legacy format
  const legacyPath = path.join(basePath, 'cultural_cuisine_masterlist.json');
  const legacyData = await fs.promises.readFile(legacyPath, 'utf-8');
  return JSON.parse(legacyData) as LegacyCuisineDefinition[];
}

// Schema validation function
export function validateMasterlistV2(data: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!data.schema_version) errors.push('Missing schema_version');
  if (!data.cuisines || !Array.isArray(data.cuisines)) errors.push('Missing or invalid cuisines array');
  
  data.cuisines?.forEach((cuisine: any, index: number) => {
    if (!cuisine.id) errors.push(`Cuisine ${index}: missing id`);
    if (!cuisine.label) errors.push(`Cuisine ${index}: missing label`);
    if (!cuisine.aliases || !Array.isArray(cuisine.aliases)) {
      errors.push(`Cuisine ${index}: missing or invalid aliases`);
    }
  });
  
  return { isValid: errors.length === 0, errors };
}