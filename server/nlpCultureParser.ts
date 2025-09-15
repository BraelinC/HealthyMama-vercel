import fs from 'fs';
import path from 'path';
import { loadMasterlist, validateMasterlistV2 } from './cuisineMasterlistMigration.js';

export interface CuisineData {
  staple_dishes: Array<{name: string; description: string; ingredients: string[]}>;
  common_proteins: string[];
  common_carbs: string[];
  common_vegetables: string[];
  meal_structure: {
    breakfast: string[];
    lunch: string[];
    dinner: string[];
    snacks: string[];
  };
  healthy_swaps: Array<{original: string; swap: string}>;
  flavor_profiles: string[];
  signature_seasonings: string[];
  dietary_restrictions: string[];
  cooking_methods: string[];
}

export interface CultureParserResult {
  cultureTags: string[];
  needsManualReview: boolean;
  confidence: number;
  detectedRegions?: string[];
  suggestedAliases?: string[];
  processingTime: number;
  fallbackUsed: boolean;
  cuisineData?: { [cultureName: string]: CuisineData };
}

interface CuisineDefinition {
  id?: string;
  label: string;
  aliases: string[];
  metadata?: {
    searchability?: {
      keywords?: string[];
      popularity_score?: number;
    };
    characteristics?: {
      key_ingredients?: string[];
      signature_dishes?: string[];
    };
  };
}

interface ParsedIntent {
  primary_cultures: string[];
  confidence_scores: number[];
  detected_keywords: string[];
  regional_indicators: string[];
  dietary_context?: string[];
  cuisine_data?: { [cultureName: string]: CuisineData };
}

// Enhanced configuration
const PARSER_CONFIG = {
  MAX_CULTURES: 3,
  MIN_CONFIDENCE: 0.3,
  MIN_INPUT_LENGTH: 5,
  CACHE_DURATION_MS: 30 * 60 * 1000, // 30 minutes
  USE_CLAUDE: true,
  FALLBACK_TO_PATTERN_MATCHING: true
};

// In-memory cache for parsed results and masterlist
const parseCache = new Map<string, { result: CultureParserResult; timestamp: number }>();
let cachedMasterlist: CuisineDefinition[] | null = null;

export async function nlpCultureParser(textInput: string, options: { forceRefresh?: boolean, enableCaching?: boolean } = {}): Promise<CultureParserResult> {
  const startTime = Date.now();
  const normalizedInput = normalizeInput(textInput);
  
  try {
    // Check cache first
    if (options.enableCaching !== false) {
      const cached = getCachedResult(normalizedInput);
      if (cached && !options.forceRefresh) {
        console.log(`🎯 NLP cache hit for input: "${textInput.substring(0, 50)}..."`); 
        return { ...cached, processingTime: Date.now() - startTime };
      }
    }

    console.log(`🧠 Processing cultural input: "${textInput.substring(0, 100)}..."`);
    // Load masterlist for validation and enhanced matching
    const masterlist = await loadCuisineMasterlist();
    
    let result: CultureParserResult;
    let fallbackUsed = false;

    if (PARSER_CONFIG.USE_CLAUDE) {
      result = await parseWithClaude(normalizedInput, masterlist, startTime);
    } else {
      // Fallback to pattern matching if Claude fails
      result = await parseWithPatternMatching(normalizedInput, masterlist, startTime);
      fallbackUsed = true;
    }

    // Cache the result if caching is enabled
    if (options.enableCaching !== false) {
      setCachedResult(normalizedInput, result);
    }

    console.log(`✅ NLP parsing complete: ${result.cultureTags.length} cultures detected (confidence: ${result.confidence})`);
    return { ...result, fallbackUsed };

  } catch (error) {
    console.error('🚨 Error in NLP culture parser:', error);
    
    // Try fallback pattern matching
    if (PARSER_CONFIG.FALLBACK_TO_PATTERN_MATCHING) {
      console.log('🔄 Attempting fallback pattern matching...');
      try {
        const masterlist = await loadCuisineMasterlist();
        const fallbackResult = await parseWithPatternMatching(normalizedInput, masterlist, startTime);
        return { ...fallbackResult, fallbackUsed: true };
      } catch (fallbackError) {
        console.error('💥 Fallback parsing also failed:', fallbackError);
      }
    }
    
    // Return empty result with manual review flag
    return {
      cultureTags: [],
      needsManualReview: true,
      confidence: 0,
      processingTime: Date.now() - startTime,
      fallbackUsed: true
    };
  }
}

async function parseWithClaude(input: string, masterlist: CuisineDefinition[], startTime: number): Promise<CultureParserResult> {
  const availableCuisines = masterlist.map(c => `${c.label} (${c.aliases.join(', ')})`).join('\n');
  
  const prompt = `You are an expert in cultural cuisine identification. Parse the user's input to identify their cultural culinary background.

User Input: "${input}"

Available Cuisine Categories:
${availableCuisines}

Instructions:
1. Identify up to 3 most relevant cultural cuisines from the user's input
2. Use EXACT labels from the available categories (e.g., "Italian", "Chinese", "Mexican")
3. Consider aliases and regional variations (e.g., "Sicilian" → "Italian", "Cantonese" → "Chinese")
4. Look for cultural indicators: family heritage, geographic mentions, specific dishes, cooking styles
5. Assign confidence scores (0.0-1.0) based on clarity of cultural indicators
6. If input is too vague or unrelated to food culture, return empty arrays
7. ENHANCED: For each detected culture, also extract structured cuisine data

For each detected culture, extract this structured data:
- Staple dishes (top 5-10), short description, and primary ingredients
- Most common proteins, carbs, and vegetables used in home-cooking
- Typical meal structure (what's for breakfast, lunch, dinner, snacks)
- Any notable healthy swaps or lighter/common "diet" versions locals use
- Regional flavor profiles and signature seasonings
- Important cultural dietary restrictions or traditions (if any)
- Popular cooking methods (e.g. stir-fry, stewing, baking, grilling)

Examples:
- "My grandmother from Sicily makes the best pasta" → Italian (0.9)
- "We love Korean BBQ and my mom is from Seoul" → Korean (0.95)
- "Mixed family - dad's Mexican, mom's Chinese" → Mexican (0.8), Chinese (0.8)
- "I like healthy food" → [] (too vague)

Return JSON in this exact format:
{
  "primary_cultures": ["Culture1", "Culture2"],
  "confidence_scores": [0.8, 0.7],
  "detected_keywords": ["keyword1", "keyword2"],
  "regional_indicators": ["region1", "region2"],
  "dietary_context": ["context1", "context2"],
  "cuisine_data": {
    "Culture1": {
      "staple_dishes": [{"name": "dish", "description": "brief desc", "ingredients": ["ing1", "ing2"]}],
      "common_proteins": ["protein1", "protein2"],
      "common_carbs": ["carb1", "carb2"], 
      "common_vegetables": ["veg1", "veg2"],
      "meal_structure": {
        "breakfast": ["typical breakfast foods"],
        "lunch": ["typical lunch foods"],
        "dinner": ["typical dinner foods"],
        "snacks": ["typical snacks"]
      },
      "healthy_swaps": [{"original": "food", "swap": "healthier version"}],
      "flavor_profiles": ["flavor1", "flavor2"],
      "signature_seasonings": ["seasoning1", "seasoning2"],
      "dietary_restrictions": ["restriction1", "restriction2"],
      "cooking_methods": ["method1", "method2"]
    }
  }
}`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 500,
      temperature: 0.2,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  try {
    const responseContent = data.content[0].text;
    console.log(`📝 Claude raw response: ${responseContent.substring(0, 200)}...`);
    
    // Clean and parse the JSON response
    const cleanedContent = responseContent.replace(/```json\n?|\n?```/g, '').trim();
    const parsedIntent: ParsedIntent = JSON.parse(cleanedContent);
    
    // Validate and process the response
    const cultureTags = validateAndMapCultures(parsedIntent.primary_cultures || [], masterlist);
    const avgConfidence = parsedIntent.confidence_scores?.length > 0 
      ? parsedIntent.confidence_scores.reduce((a, b) => a + b, 0) / parsedIntent.confidence_scores.length
      : 0;
    
    const needsManualReview = cultureTags.length === 0 || avgConfidence < PARSER_CONFIG.MIN_CONFIDENCE;
    
    return {
      cultureTags,
      needsManualReview,
      confidence: Math.round(avgConfidence * 100) / 100,
      detectedRegions: parsedIntent.regional_indicators,
      suggestedAliases: extractAliasesForCultures(cultureTags, masterlist),
      processingTime: Date.now() - startTime,
      fallbackUsed: false,
      cuisineData: parsedIntent.cuisine_data
    };
    
  } catch (parseError) {
    console.error('🚨 Failed to parse Claude response:', parseError);
    throw new Error(`Claude response parsing failed: ${parseError}`);
  }
}

async function parseWithPatternMatching(input: string, masterlist: CuisineDefinition[], startTime: number): Promise<CultureParserResult> {
  console.log('🔍 Using pattern matching fallback for cultural parsing');
  
  const lowercaseInput = input.toLowerCase();
  const matches: { culture: string; score: number; matchedTerms: string[] }[] = [];
  
  // Enhanced pattern matching with scoring
  masterlist.forEach(cuisine => {
    let score = 0;
    const matchedTerms: string[] = [];
    
    // Check main label
    if (lowercaseInput.includes(cuisine.label.toLowerCase())) {
      score += 10;
      matchedTerms.push(cuisine.label);
    }
    
    // Check aliases with weighted scoring
    cuisine.aliases.forEach(alias => {
      const aliasLower = alias.toLowerCase();
      if (lowercaseInput.includes(aliasLower)) {
        score += 8;
        matchedTerms.push(alias);
      }
    });
    
    // Check for partial matches and context clues
    const contextTerms = extractContextTerms(lowercaseInput, cuisine);
    score += contextTerms.length * 3;
    matchedTerms.push(...contextTerms);
    
    if (score > 0) {
      matches.push({ culture: cuisine.label, score, matchedTerms });
    }
  });
  
  // Sort by score and take top matches
  matches.sort((a, b) => b.score - a.score);
  const topMatches = matches.slice(0, PARSER_CONFIG.MAX_CULTURES);
  
  const cultureTags = topMatches.map(m => m.culture);
  const avgScore = topMatches.length > 0 
    ? topMatches.reduce((sum, m) => sum + m.score, 0) / topMatches.length
    : 0;
    
  // Normalize score to 0-1 confidence range
  const confidence = Math.min(avgScore / 15, 1.0); // Max expected score ~15
  const needsManualReview = cultureTags.length === 0 || confidence < PARSER_CONFIG.MIN_CONFIDENCE;
  
  console.log(`🎯 Pattern matching found ${cultureTags.length} cultures with confidence ${confidence}`);
  
  return {
    cultureTags,
    needsManualReview,
    confidence: Math.round(confidence * 100) / 100,
    detectedRegions: topMatches.flatMap(m => m.matchedTerms),
    suggestedAliases: extractAliasesForCultures(cultureTags, masterlist),
    processingTime: Date.now() - startTime,
    fallbackUsed: true
  };
}

// Helper functions
function normalizeInput(input: string): string {
  return input.trim().toLowerCase()
    .replace(/[^\w\s'-]/g, ' ')  // Remove special chars except apostrophes and hyphens
    .replace(/\s+/g, ' ')        // Normalize whitespace
    .substring(0, 500);          // Limit length
}

async function loadCuisineMasterlist(): Promise<CuisineDefinition[]> {
  if (cachedMasterlist) {
    return cachedMasterlist;
  }
  
  try {
    // Try to load enhanced v2 masterlist first
    const masterlistData = await loadMasterlist(true);
    
    if ('cuisines' in masterlistData) {
      // V2 format with enhanced metadata
      cachedMasterlist = masterlistData.cuisines.map(cuisine => ({
        id: cuisine.id,
        label: cuisine.label,
        aliases: cuisine.aliases,
        metadata: cuisine.metadata
      }));
      console.log(`📚 Loaded enhanced v2 masterlist: ${cachedMasterlist.length} cuisines`);
    } else {
      // Legacy format
      cachedMasterlist = masterlistData as CuisineDefinition[];
      console.log(`📚 Loaded legacy masterlist: ${cachedMasterlist.length} cuisines`);
    }
    
    return cachedMasterlist;
  } catch (error) {
    console.error('🚨 Failed to load cuisine masterlist:', error);
    // Return enhanced fallback list
    cachedMasterlist = [
      { 
        label: 'Italian', 
        aliases: ['Mediterranean Italian', 'Tuscan', 'Sicilian'],
        metadata: {
          searchability: { keywords: ['pasta', 'pizza', 'mediterranean'] },
          characteristics: { key_ingredients: ['olive oil', 'tomatoes', 'basil'] }
        }
      },
      { 
        label: 'Mexican', 
        aliases: ['Tex-Mex', 'Oaxacan', 'Yucatecan'],
        metadata: {
          searchability: { keywords: ['spicy', 'authentic', 'street food'] },
          characteristics: { key_ingredients: ['chiles', 'corn', 'cilantro'] }
        }
      },
      { 
        label: 'Chinese', 
        aliases: ['Cantonese', 'Sichuan', 'Mandarin'],
        metadata: {
          searchability: { keywords: ['stir fry', 'healthy', 'quick'] },
          characteristics: { key_ingredients: ['soy sauce', 'ginger', 'garlic'] }
        }
      },
      { 
        label: 'Indian', 
        aliases: ['North Indian', 'South Indian', 'Bengali'],
        metadata: {
          searchability: { keywords: ['curry', 'spicy', 'vegetarian'] },
          characteristics: { key_ingredients: ['cumin', 'turmeric', 'garam masala'] }
        }
      },
      { 
        label: 'Japanese', 
        aliases: ['Washoku', 'Traditional Japanese'],
        metadata: {
          searchability: { keywords: ['healthy', 'fresh', 'minimalist'] },
          characteristics: { key_ingredients: ['soy sauce', 'miso', 'rice'] }
        }
      }
    ];
    return cachedMasterlist;
  }
}

function validateAndMapCultures(cultures: string[], masterlist: CuisineDefinition[]): string[] {
  const validCultures: string[] = [];
  
  cultures.forEach(culture => {
    // Direct match
    const directMatch = masterlist.find(c => c.label.toLowerCase() === culture.toLowerCase());
    if (directMatch) {
      validCultures.push(directMatch.label);
      return;
    }
    
    // Alias match
    const aliasMatch = masterlist.find(c => 
      c.aliases.some(alias => alias.toLowerCase() === culture.toLowerCase())
    );
    if (aliasMatch) {
      validCultures.push(aliasMatch.label);
      return;
    }
    
    // Fuzzy match for typos/variations
    const fuzzyMatch = masterlist.find(c => 
      c.label.toLowerCase().includes(culture.toLowerCase()) ||
      culture.toLowerCase().includes(c.label.toLowerCase()) ||
      c.aliases.some(alias => 
        alias.toLowerCase().includes(culture.toLowerCase()) ||
        culture.toLowerCase().includes(alias.toLowerCase())
      )
    );
    if (fuzzyMatch) {
      validCultures.push(fuzzyMatch.label);
    }
  });
  
  return [...new Set(validCultures)]; // Remove duplicates
}

function extractContextTerms(input: string, cuisine: CuisineDefinition): string[] {
  const contextTerms: string[] = [];
  
  // Use enhanced metadata if available
  if (cuisine.metadata?.characteristics) {
    const { key_ingredients, signature_dishes } = cuisine.metadata.characteristics;
    
    // Check for ingredients
    key_ingredients?.forEach(ingredient => {
      if (input.toLowerCase().includes(ingredient.toLowerCase())) {
        contextTerms.push(ingredient);
      }
    });
    
    // Check for signature dishes
    signature_dishes?.forEach(dish => {
      if (input.toLowerCase().includes(dish.toLowerCase())) {
        contextTerms.push(dish);
      }
    });
  }
  
  // Use searchability keywords
  if (cuisine.metadata?.searchability?.keywords) {
    cuisine.metadata.searchability.keywords.forEach(keyword => {
      if (input.toLowerCase().includes(keyword.toLowerCase())) {
        contextTerms.push(keyword);
      }
    });
  }
  
  // Fallback to static context terms for cuisines without metadata
  const cultureContexts: { [key: string]: string[] } = {
    'Italian': ['pasta', 'pizza', 'risotto', 'gelato', 'parmesan', 'basil', 'olive oil', 'rome', 'italy', 'milan', 'nonna'],
    'Mexican': ['tacos', 'salsa', 'guacamole', 'mole', 'tortilla', 'mexico', 'oaxaca', 'puebla', 'abuela'],
    'Chinese': ['rice', 'noodles', 'wok', 'soy sauce', 'dim sum', 'china', 'beijing', 'shanghai', 'taiwan'],
    'Indian': ['curry', 'spices', 'naan', 'biryani', 'turmeric', 'india', 'mumbai', 'delhi', 'bollywood'],
    'Japanese': ['sushi', 'ramen', 'miso', 'sake', 'tempura', 'japan', 'tokyo', 'kyoto', 'washoku'],
    'Korean': ['kimchi', 'bulgogi', 'bibimbap', 'korea', 'seoul', 'korean bbq'],
    'Thai': ['pad thai', 'curry', 'coconut', 'thailand', 'bangkok', 'thai basil'],
    'Vietnamese': ['pho', 'banh mi', 'vietnam', 'saigon', 'vietnamese'],
    'Southern US': ['fried chicken', 'gumbo', 'cornbread', 'bbq', 'south', 'louisiana', 'texas'],
    'French': ['wine', 'cheese', 'baguette', 'croissant', 'france', 'paris', 'provence'],
    'Greek': ['feta', 'olives', 'yogurt', 'greece', 'athens', 'mediterranean'],
    'Ethiopian': ['injera', 'berbere', 'ethiopia', 'addis ababa', 'east africa'],
    'Lebanese': ['hummus', 'tabbouleh', 'lebanon', 'beirut', 'middle east'],
    'Peruvian': ['quinoa', 'ceviche', 'peru', 'lima', 'andes', 'south america']
  };
  
  // Apply fallback context terms if no metadata context was found
  if (contextTerms.length === 0) {
    const fallbackTerms = cultureContexts[cuisine.label] || [];
    fallbackTerms.forEach(term => {
      if (input.toLowerCase().includes(term.toLowerCase())) {
        contextTerms.push(term);
      }
    });
  }
  
  return [...new Set(contextTerms)]; // Remove duplicates
}

function extractAliasesForCultures(cultures: string[], masterlist: CuisineDefinition[]): string[] {
  const aliases: string[] = [];
  cultures.forEach(culture => {
    const def = masterlist.find(c => c.label === culture);
    if (def) {
      aliases.push(...def.aliases);
    }
  });
  return aliases;
}

function getCachedResult(input: string): CultureParserResult | null {
  const cached = parseCache.get(input);
  if (cached && Date.now() - cached.timestamp < PARSER_CONFIG.CACHE_DURATION_MS) {
    return cached.result;
  }
  return null;
}

function setCachedResult(input: string, result: CultureParserResult): void {
  parseCache.set(input, { result, timestamp: Date.now() });
  
  // Clean old cache entries periodically
  if (parseCache.size > 1000) {
    const now = Date.now();
    for (const [key, value] of parseCache.entries()) {
      if (now - value.timestamp > PARSER_CONFIG.CACHE_DURATION_MS) {
        parseCache.delete(key);
      }
    }
  }
}

// Export additional utility functions
export function getCacheSize(): number {
  return parseCache.size;
}

export function clearParseCache(): void {
  parseCache.clear();
  console.log('🧹 NLP parse cache cleared');
}

export function getParserStats(): { cacheSize: number; masterlistLoaded: boolean; cacheHitRatio: number } {
  return {
    cacheSize: parseCache.size,
    masterlistLoaded: cachedMasterlist !== null,
    cacheHitRatio: 0 // TODO: Implement hit ratio tracking
  };
}