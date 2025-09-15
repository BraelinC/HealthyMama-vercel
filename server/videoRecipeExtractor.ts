import fetch from 'node-fetch';
import { groqValidator } from './groqValidator';
import { parseIngredientsWithGPT } from './gptIngredientParser';
import { deduplicateIngredients, cleanIngredientList } from "./ingredientDeduplicator";

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_API_KEY_BACKUP = process.env.YOUTUBE_API_KEY_BACKUP;
const YOUTUBE_API_BASE_URL = 'https://www.googleapis.com/youtube/v3';

// Types
interface YouTubeVideoInfo {
  id: string;
  title: string;
  description: string;
  channelTitle: string;
  thumbnailUrl?: string;
  comments?: string[];
}

interface Ingredient {
  name: string;
  display_text: string;
  measurements: {
    quantity: number;
    unit: string;
  }[];
}

/**
 * Spoonacular recipe data structure
 */
interface SpoonacularRecipe {
  id: number;
  title: string;
  readyInMinutes: number;
  servings: number;
  image: string;
  summary?: string;
}

/**
 * Query Spoonacular API to get recipe with cooking time enforcement
 */
async function getSpoonacularRecipe(query: string, filters?: {
  cuisine?: string;
  diet?: string;
  cookingTime?: string;
  availableIngredients?: string;
  excludeIngredients?: string;
}): Promise<SpoonacularRecipe | null> {
  try {
    if (!process.env.SPOONACULAR_API_KEY) {
      console.log("Spoonacular API key not configured, skipping");
      return null;
    }

    console.log(`Querying Spoonacular for: "${query}" with filters`);
    
    // Build Spoonacular API parameters
    const params = new URLSearchParams({
      apiKey: process.env.SPOONACULAR_API_KEY,
      query: query,
      number: '3',
      addRecipeInformation: 'true',
      sort: 'popularity'
    });

    // Add cooking time constraint
    if (filters?.cookingTime && filters.cookingTime !== 'Any Time') {
      const timeInMinutes = parseTimeFilter(filters.cookingTime);
      if (timeInMinutes > 0) {
        params.append('maxReadyTime', timeInMinutes.toString());
      }
    }

    // Add cuisine filter
    if (filters?.cuisine && filters.cuisine !== 'Any Cuisine') {
      params.append('cuisine', filters.cuisine.toLowerCase());
    }

    // Add diet filter
    if (filters?.diet && filters.diet !== 'None') {
      params.append('diet', filters.diet.toLowerCase());
    }

    // Add available ingredients
    if (filters?.availableIngredients) {
      const ingredients = filters.availableIngredients.split(',').map(i => i.trim()).join(',');
      params.append('includeIngredients', ingredients);
    }

    // Add excluded ingredients
    if (filters?.excludeIngredients) {
      const excludeIngredients = filters.excludeIngredients.split(',').map(i => i.trim()).join(',');
      params.append('excludeIngredients', excludeIngredients);
    }

    const spoonacularUrl = `https://api.spoonacular.com/recipes/complexSearch?${params.toString()}`;
    console.log(`Spoonacular API call: ${spoonacularUrl.replace(process.env.SPOONACULAR_API_KEY, '[API_KEY]')}`);
    
    const response = await fetch(spoonacularUrl);
    const data = await response.json() as any;

    if (!data.results || data.results.length === 0) {
      console.log("No recipes found in Spoonacular");
      return null;
    }

    // Select the recipe that best matches the query
    let bestMatch = data.results[0];
    let bestScore = 0;

    for (const recipe of data.results) {
      let score = 0;
      const titleLower = recipe.title.toLowerCase();
      const queryLower = query.toLowerCase();
      
      // Exact match gets highest score
      if (titleLower.includes(queryLower)) {
        score += 10;
      }
      
      // Partial word matches
      const queryWords = queryLower.split(' ');
      for (const word of queryWords) {
        if (titleLower.includes(word)) {
          score += 2;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = recipe;
      }
    }

    console.log(`Selected Spoonacular recipe: "${bestMatch.title}" (${bestMatch.readyInMinutes} min)`);
    return bestMatch;

  } catch (error) {
    console.error("Error fetching from Spoonacular:", error);
    return null;
  }
}

/**
 * Parse time filter string to minutes
 */
function parseTimeFilter(timeFilter: string): number {
  const timeMap: Record<string, number> = {
    'Under 15 min': 15,
    'Under 30 min': 30,
    'Under 1 hour': 60,
    '1+ hours': 999
  };
  
  return timeMap[timeFilter] || 0;
}

/**
 * Find the best YouTube video for a recipe query with advanced filter support
 */
export async function findBestRecipeVideo(query: string, filters?: {
  cuisine?: string;
  diet?: string;
  cookingTime?: string;
  availableIngredients?: string;
  excludeIngredients?: string;
}, spoonacularTime?: number): Promise<YouTubeVideoInfo | null> {
  try {
    if (!YOUTUBE_API_KEY && !YOUTUBE_API_KEY_BACKUP) {
      console.error("No YouTube API keys found in environment variables");
      return null;
    }
    
    // Simplified, effective query generation
    let searchQuery = query;
    
    // Clean the query and add essential keywords
    if (!searchQuery.toLowerCase().includes('recipe')) {
      searchQuery += ' recipe';
    }
    
    // Add cuisine if specified and meaningful
    if (filters?.cuisine && filters.cuisine !== 'Any Cuisine' && filters.cuisine !== 'None') {
      searchQuery += ` ${filters.cuisine}`;
    }
    
    // Add diet if specified and meaningful  
    if (filters?.diet && filters.diet !== 'None' && filters.diet !== 'Any Diet') {
      searchQuery += ` ${filters.diet}`;
    }
    
    // Add simple time indicator for quick recipes
    if (filters?.cookingTime === 'Under 15 min' || filters?.cookingTime === 'Under 30 min') {
      searchQuery += ' quick';
    }
    
    console.log(`Enhanced search query: "${searchQuery}"`);
    
    // Try primary API key first, then backup if quota exceeded
    let currentApiKey = YOUTUBE_API_KEY;
    let searchUrl = `${YOUTUBE_API_BASE_URL}/search?part=snippet&q=${encodeURIComponent(searchQuery)}&maxResults=3&type=video&key=${currentApiKey}`;
    
    let searchResponse = await fetch(searchUrl);
    let searchData = await searchResponse.json() as any;
    
    // If primary key has quota issues, try backup key
    if (searchResponse.status === 403 && searchData.error?.errors?.[0]?.reason === 'quotaExceeded' && YOUTUBE_API_KEY_BACKUP) {
      console.log("Primary YouTube API key quota exceeded, switching to backup key");
      currentApiKey = YOUTUBE_API_KEY_BACKUP;
      searchUrl = `${YOUTUBE_API_BASE_URL}/search?part=snippet&q=${encodeURIComponent(searchQuery)}&maxResults=3&type=video&key=${currentApiKey}`;
      searchResponse = await fetch(searchUrl);
      searchData = await searchResponse.json() as any;
    }
    
    console.log("YouTube API Response Status:", searchResponse.status);
    console.log("YouTube API Response:", JSON.stringify(searchData, null, 2));
    
    if (!searchData.items || searchData.items.length === 0) {
      console.warn("No videos explicitly matching query terms, using most popular video");
      // Fall back to a simpler search if no results found
      const simpleSearchUrl = `${YOUTUBE_API_BASE_URL}/search?part=snippet&q=${encodeURIComponent(query)}&maxResults=1&type=video&key=${currentApiKey}`;
      const simpleSearchResponse = await fetch(simpleSearchUrl);
      const simpleSearchData = await simpleSearchResponse.json() as any;
      
      if (!simpleSearchData.items || simpleSearchData.items.length === 0) {
        return null;
      }
      
      const videoId = simpleSearchData.items[0].id.videoId;
      const videoTitle = simpleSearchData.items[0].snippet.title;
      const channelTitle = simpleSearchData.items[0].snippet.channelTitle;
      const thumbnailUrl = simpleSearchData.items[0].snippet.thumbnails.high?.url;
      
      // Get more detailed video information
      const videoUrl = `${YOUTUBE_API_BASE_URL}/videos?part=snippet,statistics&id=${videoId}&key=${YOUTUBE_API_KEY}`;
      const videoResponse = await fetch(videoUrl);
      const videoData = await videoResponse.json() as any;
      
      if (!videoData.items || videoData.items.length === 0) {
        return null;
      }
      
      const description = videoData.items[0].snippet.description;
      
      return {
        id: videoId,
        title: videoTitle,
        description,
        channelTitle,
        thumbnailUrl
      };
    }
    
    // Process the top 5 results
    let bestVideo = null;
    let maxScore = -1;
    
    for (const item of searchData.items) {
      const videoId = item.id.videoId;
      
      // Get more detailed video information including view count and duration
      const videoUrl = `${YOUTUBE_API_BASE_URL}/videos?part=snippet,statistics,contentDetails&id=${videoId}&key=${YOUTUBE_API_KEY}`;
      const videoResponse = await fetch(videoUrl);
      const videoData = await videoResponse.json() as any;
      
      if (!videoData.items || videoData.items.length === 0) {
        continue;
      }
      
      const viewCount = parseInt(videoData.items[0].statistics.viewCount) || 0;
      const description = videoData.items[0].snippet.description;
      const title = videoData.items[0].snippet.title;
      const channelTitle = videoData.items[0].snippet.channelTitle;
      const thumbnailUrl = item.snippet.thumbnails.high?.url;
      const duration = videoData.items[0].contentDetails?.duration || '';
      
      // Filter out YouTube Shorts only (very short videos with minimal content)
      const durationMinutes = parseDuration(duration);
      console.log(`Video "${title}" duration: ${duration} -> ${durationMinutes} minutes, description length: ${description?.length || 0}`);
      if (durationMinutes < 0.5) {
        console.log(`Skipping short video: ${title}`);
        continue; // Skip videos under 30 seconds (likely shorts)
      }
      
      // Calculate enhanced score with filter-aware prioritization
      let score = viewCount * 0.001; // Much lower weight for view count
      
      // Major bonus points for videos with "recipe" or "how to" in the title (this should be enough to select them)
      if (title.toLowerCase().includes("recipe") || 
          title.toLowerCase().includes("how to")) {
        score += 10000000; // Increased bonus
      }
      
      // Bonus points for videos with ingredient lists in the description
      if (description.toLowerCase().includes("ingredient") || 
          description.toLowerCase().includes("you will need")) {
        score += 5000000;
      }
      
      // Basic bonus for any cooking-related video
      score += 1000000; // Base score to ensure videos get selected
      
      // Filter-specific scoring bonuses
      if (filters) {
        // Cuisine filter bonus
        if (filters.cuisine && filters.cuisine !== 'Any Cuisine' && 
            (title.toLowerCase().includes(filters.cuisine.toLowerCase()) || 
             description.toLowerCase().includes(filters.cuisine.toLowerCase()))) {
          score += 500000;
        }
        
        // Diet filter bonus
        if (filters.diet && filters.diet !== 'None' && 
            (title.toLowerCase().includes(filters.diet.toLowerCase()) || 
             description.toLowerCase().includes(filters.diet.toLowerCase()))) {
          score += 500000;
        }
        
        // Time constraint bonus (prioritize Spoonacular time if available)
        if (spoonacularTime && spoonacularTime > 0) {
          const durationMinutes = parseDuration(duration);
          // Bonus for videos close to Spoonacular cooking time
          if (Math.abs(durationMinutes - spoonacularTime) <= 5) {
            score += 300000; // High bonus for matching Spoonacular time
          } else if (durationMinutes <= spoonacularTime + 10) {
            score += 150000; // Medium bonus for being reasonably close
          }
        } else if (filters.cookingTime && filters.cookingTime !== 'Any Time') {
          const durationMinutes = parseDuration(duration);
          const timeBonus = getTimeBonus(durationMinutes, filters.cookingTime);
          score += timeBonus;
        }
        
        // Available ingredients bonus
        if (filters.availableIngredients) {
          const availableList = filters.availableIngredients.split(',').map(i => i.trim().toLowerCase());
          const matchCount = availableList.filter(ingredient => 
            description.toLowerCase().includes(ingredient) || title.toLowerCase().includes(ingredient)
          ).length;
          score += matchCount * 300000;
        }
        
        // Penalty for excluded ingredients
        if (filters.excludeIngredients) {
          const excludeList = filters.excludeIngredients.split(',').map(i => i.trim().toLowerCase());
          const penaltyCount = excludeList.filter(ingredient => 
            description.toLowerCase().includes(ingredient) || title.toLowerCase().includes(ingredient)
          ).length;
          score -= penaltyCount * 500000;
        }
      }
      
      if (score > maxScore) {
        maxScore = score;
        bestVideo = {
          id: videoId,
          title,
          description,
          channelTitle,
          thumbnailUrl
        };
      }
    }
    
    // If we have any videos, just pick the first one with "recipe" in the title
    // The YouTube search is already good at finding relevant content
    if (!bestVideo && searchData.items && searchData.items.length > 0) {
      console.log("No video met scoring criteria, selecting first available video");
      for (const item of searchData.items) {
        const videoId = item.id.videoId;
        const title = item.snippet.title;
        const channelTitle = item.snippet.channelTitle;
        const thumbnailUrl = item.snippet.thumbnails.high?.url;
        
        bestVideo = {
          id: videoId,
          title,
          description: item.snippet.description || "",
          channelTitle,
          thumbnailUrl
        };
        console.log(`Fallback selected: "${title}" by ${channelTitle}`);
        break;
      }
    }

    if (bestVideo) {
      console.log(`Selected video: "${bestVideo.title}" by ${bestVideo.channelTitle}`);
    } else {
      console.log(`No suitable video found after filtering ${searchData.items.length} results`);
    }
    
    return bestVideo;
  } catch (error) {
    console.error("Error finding recipe video:", error);
    return null;
  }
}

/**
 * Parse YouTube duration format (PT15M33S) to minutes
 */
function parseDuration(duration: string): number {
  if (!duration) return 0;
  
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  
  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  const seconds = parseInt(match[3] || '0');
  
  return hours * 60 + minutes + seconds / 60;
}

/**
 * Calculate time bonus based on video duration vs cooking time filter
 */
function getTimeBonus(durationMinutes: number, cookingTimeFilter: string): number {
  const timeRanges: Record<string, { min: number, max: number }> = {
    'Under 15 min': { min: 0, max: 15 },
    'Under 30 min': { min: 0, max: 30 },
    'Under 1 hour': { min: 0, max: 60 },
    '1+ hours': { min: 60, max: 999 }
  };
  
  const range = timeRanges[cookingTimeFilter];
  if (!range) return 0;
  
  if (durationMinutes >= range.min && durationMinutes <= range.max) {
    return 300000; // Bonus for matching time constraint
  }
  
  return 0;
}

/**
 * Get comments for a YouTube video
 */
async function getVideoComments(videoId: string): Promise<string[]> {
  try {
    if (!YOUTUBE_API_KEY) {
      return [];
    }
    
    const commentsUrl = `${YOUTUBE_API_BASE_URL}/commentThreads?part=snippet&videoId=${videoId}&maxResults=100&key=${YOUTUBE_API_KEY}`;
    const response = await fetch(commentsUrl);
    const data = await response.json() as any;
    
    if (!data.items) {
      return [];
    }
    
    let pinnedComments: string[] = [];
    let regularComments: string[] = [];
    
    for (const item of data.items) {
      const comment = item.snippet.topLevelComment.snippet.textDisplay;
      // Check if this is a pinned comment (often contains recipe details)
      if (item.snippet.canReply === false || item.snippet.isPinnedByCreator) {
        pinnedComments.push(comment);
      } else {
        regularComments.push(comment);
      }
    }
    
    console.log(`Found ${pinnedComments.length} pinned comments and ${regularComments.length} regular comments`);
    
    // Prioritize pinned comments as they often contain the recipe
    return [...pinnedComments, ...regularComments];
  } catch (error) {
    console.error("Error getting video comments:", error);
    return [];
  }
}

/**
 * Generate ingredients from video title using Grok AI
 */
async function generateIngredientsFromTitle(videoTitle: string): Promise<string[]> {
  try {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "grok-2-1212",
        messages: [{
          role: "system",
          content: "You are a culinary expert. Generate realistic ingredient lists for recipes based on video titles. Include proper measurements and quantities for typical serving sizes."
        }, {
          role: "user",
          content: `Generate a complete ingredient list for this recipe: "${videoTitle}". 

Include:
- Proper measurements (cups, tablespoons, teaspoons, ounces, pounds, etc.)
- Realistic quantities for 4-6 servings
- Common ingredients that would be used in this dish
- Seasonings and basic cooking ingredients

Return as JSON: {"ingredients": ["2 lbs ground beef", "1 large onion, diced", "2 cups beef broth", etc.]}`
        }],
        response_format: { type: "json_object" },
        max_tokens: 800
      })
    });

    if (!response.ok) {
      console.log('Grok ingredient generation failed');
      return [];
    }

    const result = await response.json();
    const content = result.choices[0]?.message?.content;
    
    if (content) {
      const parsed = JSON.parse(content);
      if (parsed.ingredients && Array.isArray(parsed.ingredients)) {
        return parsed.ingredients;
      }
    }
    
    return [];
  } catch (error) {
    console.error('Grok ingredient generation error:', error);
    return [];
  }
}

/**
 * Extract ingredients using LLaVA-Chef style AI analysis
 */
async function extractIngredientsWithLLaVA(text: string): Promise<string[]> {
  if (!text) return [];
  
  try {
    // Use Grok API to analyze the text like LLaVA-Chef would
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "grok-2-1212",
        messages: [{
          role: "system",
          content: "You are LLaVA-Chef, an AI specialized in extracting recipe ingredients from text. Extract ingredients with proper measurements and formatting."
        }, {
          role: "user",
          content: `Analyze this YouTube video description and extract ONLY the ingredients with their measurements. Format each ingredient properly with quantity and unit when available.

Text to analyze:
${text}

Return as JSON: {"ingredients": ["1 cup flour", "2 large eggs", "1/2 tsp salt", etc.]}`
        }],
        response_format: { type: "json_object" },
        max_tokens: 800
      })
    });

    if (!response.ok) {
      console.log('LLaVA analysis failed, using simple extraction');
      return [];
    }

    const result = await response.json();
    const content = result.choices[0]?.message?.content;
    
    if (content) {
      const parsed = JSON.parse(content);
      if (parsed.ingredients && Array.isArray(parsed.ingredients)) {
        console.log(`LLaVA-Chef extracted ${parsed.ingredients.length} ingredients`);
        return parsed.ingredients;
      }
    }
    
    return [];
  } catch (error) {
    console.error('LLaVA-Chef extraction error:', error);
    return [];
  }
}

/**
 * Fallback extraction method if AI fails
 */
function fallbackExtraction(text: string): string[] {
  console.log("Using fallback ingredient extraction");
  
  // If no clear section was found or there were too few ingredients,
  // try to extract ingredients based on common patterns
  const allLines = text.split(/\n|\r|•|\*|\d+[\.)]|\s{2,}/)
    .filter(line => line.trim() !== '')
    .map(line => line.trim());
  
  // Look for lines that look like ingredients
  // Create a function to check if a line looks like an ingredient
  function isLikelyIngredient(line: string): boolean {
    // Common measures and food words to check for
    const measurementPattern = /\b(\d+\s*\d*\/\d+|\d+(?:[\.,]\d+)?|one|two|three|four|five|half|quarter)\s*(cup|tbsp|tsp|tablespoon|teaspoon|oz|ounce|pound|lb|g|gram|kg|ml|liter|l)s?\b/i;
    const foodPattern = /\b(salt|pepper|sugar|flour|oil|butter|garlic|onion|chicken|beef|pork|rice|pasta|cheese|egg|milk|cream|water|broth|stock|vegetable|tomato|potato|carrot|herb|spice|beef|chicken|pork|fish|shrimp|tofu)\b/i;
    
    // Various patterns that suggest a line is an ingredient
    const hasMeasurement = measurementPattern.test(line);
    const hasQuantity = /\b\d+\s*\b/.test(line);
    const hasFoodWord = foodPattern.test(line);
    const isReasonableLength = line.length > 3 && line.length < 150; // Ingredients are usually shorter lines
    const hasNoLinks = !line.includes('http') && !line.includes('www.');
    const hasNoSocialMedia = !line.toLowerCase().includes('subscribe') && 
                             !line.toLowerCase().includes('follow') && 
                             !line.toLowerCase().includes('youtube') && 
                             !line.toLowerCase().includes('instagram');
    
    return isReasonableLength && 
           hasNoLinks && 
           hasNoSocialMedia && 
           (hasMeasurement || (hasQuantity && hasFoodWord));
  }
  
  const possibleIngredients = allLines.filter(isLikelyIngredient);
  
  if (possibleIngredients.length >= 3) {
    return possibleIngredients;
  }
  
  // As a last resort, look for lines with common food words
  const foodWords = [
    'chicken', 'beef', 'pork', 'fish', 'shrimp', 'tofu', 'rice', 'pasta',
    'salt', 'pepper', 'oil', 'butter', 'garlic', 'onion', 'tomato', 'potato',
    'carrot', 'cheese', 'egg', 'milk', 'cream', 'flour', 'sugar', 'water',
    'sauce', 'bread', 'lemon', 'lime', 'cilantro', 'parsley', 'basil',
    'thyme', 'oregano', 'cumin', 'cinnamon', 'chocolate', 'vanilla',
    'vegetable', 'fruit', 'meat', 'seafood', 'spice', 'herb'
  ];
  
  // Function to check if line contains food-related words
  function hasFoodWords(line: string): boolean {
    const lowerLine = line.toLowerCase();
    
    // Basic validation
    if (line.length > 150 || line.length < 4) return false;
    if (line.includes('http') || line.includes('www.')) return false;
    if (lowerLine.includes('subscribe') || 
        lowerLine.includes('follow') || 
        lowerLine.includes('youtube') || 
        lowerLine.includes('instagram')) return false;
    
    // Check each food word
    for (const foodWord of foodWords) {
      if (lowerLine.includes(foodWord.toLowerCase())) {
        return true;
      }
    }
    
    return false;
  }
  
  const foodWordLines = allLines.filter(hasFoodWords);
  
  // Return food word lines if we have enough, otherwise return empty array
  return foodWordLines.length >= 3 ? foodWordLines : [];
}

/**
 * Extract instructions using LLaVA-Chef with video transcript
 */
async function extractInstructionsWithLLaVA(transcript: string, description: string): Promise<string[]> {
  if (!transcript && !description) return [];
  
  try {
    // Combine transcript and description, prioritizing transcript
    let textToAnalyze = transcript || description || '';
    
    // Chunk transcript if it's too long (LLaVA works best with shorter chunks)
    const maxChunkLength = 4000; // Optimal chunk size for AI analysis
    const chunks: string[] = [];
    
    // Always use exactly 2 parallel instances for fastest processing
    if (textToAnalyze.length <= 800) {
      // For short text, duplicate for 2 instances with slight variations
      chunks.push(textToAnalyze);
      chunks.push(textToAnalyze); // Run same text through 2 instances for speed
    } else {
      // Split into exactly 2 chunks with overlap for comprehensive coverage
      const midPoint = Math.floor(textToAnalyze.length / 2);
      const overlap = 200; // Prevent missing instructions at boundaries
      
      chunks.push(textToAnalyze.slice(0, midPoint + overlap));
      chunks.push(textToAnalyze.slice(midPoint - overlap));
    }
    
    let allInstructions: string[] = [];
    
    // Process chunks in parallel for faster extraction
    const chunkPromises = chunks.map(async (chunk, index) => {
      try {
        const response = await fetch('https://api.x.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: "grok-2-1212",
            messages: [{
              role: "system",
              content: "You are LLaVA-Chef, an AI specialized in extracting cooking instructions from video transcripts. Extract clear, actionable cooking steps in chronological order."
            }, {
              role: "user",
              content: `Extract cooking instructions from this ${transcript ? 'video transcript' : 'description'} chunk ${index + 1}/${chunks.length}. Format as clear numbered steps. Focus ONLY on actionable cooking steps, ignore introductions, sponsorships, or unrelated content.

${chunk}

Return as JSON: {"instructions": ["Step description 1", "Step description 2", etc.]}`
            }],
            response_format: { type: "json_object" },
            max_tokens: 1000
          })
        });

        if (response.ok) {
          const result = await response.json();
          const content = result.choices[0]?.message?.content;
          
          if (content) {
            const parsed = JSON.parse(content);
            if (parsed.instructions && Array.isArray(parsed.instructions)) {
              return { index, instructions: parsed.instructions };
            }
          }
        }
        return { index, instructions: [] };
      } catch (error) {
        console.error(`Error processing chunk ${index}:`, error);
        return { index, instructions: [] };
      }
    });

    // Wait for all parallel processing to complete
    const chunkResults = await Promise.all(chunkPromises);
    
    // Combine results in order and flatten
    chunkResults
      .sort((a, b) => a.index - b.index) // Maintain chronological order
      .forEach(result => {
        allInstructions.push(...result.instructions);
      });
    
    // Remove duplicates and clean up instructions
    const uniqueInstructions = Array.from(new Set(allInstructions))
      .filter(instruction => instruction.length > 10) // Remove very short instructions
      .slice(0, 15); // Limit to 15 steps maximum
    
    console.log(`LLaVA-Chef extracted ${uniqueInstructions.length} instructions from ${transcript ? 'transcript' : 'description'}`);
    return uniqueInstructions;
    
  } catch (error) {
    console.error('LLaVA-Chef instruction extraction error:', error);
    return fallbackInstructionExtraction(description);
  }
}

/**
 * Fallback instruction extraction if AI fails
 */
function fallbackInstructionExtraction(text: string): string[] {
  const instructionSectionMarkers = [
    'Instructions:', 'INSTRUCTIONS', 'Directions:', 'Method:', 
    'Steps:', 'Preparation:', 'PREPARATION', 'How to Make:',
    'Directions', 'Method', 'Steps', 'Preparation', 'Process:',
    'Cooking method:', 'How to prepare:', 'Cooking instructions:',
    'Instructions', 'DIRECTIONS', 'METHOD', 'STEPS',
    'Préparation:', 'Instrucciones:', 'Anleitung:', 'Istruzioni:',
    '做法:', '步骤:', 'Инструкции:'
  ];
  
  // Try to find a section that starts with an instruction marker
  let instructionSection = '';
  
  // First try to find a dedicated instruction section
  for (const marker of instructionSectionMarkers) {
    if (text.includes(marker)) {
      const parts = text.split(marker);
      if (parts.length > 1) {
        instructionSection = parts[1];
        
        // Try to stop at known end markers
        const endMarkers = [
          'Notes:', 'NOTES:', 'Tips:', 'TIPS:', 'Serving suggestion',
          'Nutrition', 'Subscribe', 'Follow', 'Like', 'Comment',
          'NUTRITION', 'Equipment:', 'EQUIPMENT', 'Thank you', 'Thanks for watching'
        ];
        
        for (const endMarker of endMarkers) {
          if (instructionSection.includes(endMarker)) {
            instructionSection = instructionSection.split(endMarker)[0];
          }
        }
        
        break;
      }
    }
  }
  
  // If we didn't find a clear instruction section, let's try a different approach:
  // Looking for paragraphs that come after ingredients
  if (!instructionSection) {
    const ingredientMarkers = [
      'Ingredients:', 'INGREDIENTS', 'INGREDIENTS:', 'Ingredients',
      'You will need:', 'What you need:', 'Shopping list:'
    ];
    
    for (const marker of ingredientMarkers) {
      if (text.includes(marker)) {
        // Find the text after the ingredients, which might contain instructions
        const parts = text.split(marker);
        if (parts.length > 1) {
          // Find the next section after ingredients, which is often instructions
          const afterIngredients = parts[1];
          
          // Look for an empty line which often separates ingredients from instructions
          const emptyLineSeparator = /\n\s*\n/;
          const sectionParts = afterIngredients.split(emptyLineSeparator);
          
          if (sectionParts.length > 1) {
            // Skip the first part (which is the ingredients list) and use the next part
            instructionSection = sectionParts[1];
          }
        }
      }
    }
  }
  
  // Steps array to build up all possible instructions
  let extractedSteps: string[] = [];
  
  // First, extract any steps found in the instruction section if we found one
  if (instructionSection) {
    console.log("Found potential instruction section");
    
    // Approach 1: Look for numbered steps
    const instructionLines = instructionSection.split(/\n|\r/).map(line => line.trim()).filter(line => line.length > 0);
    const numberedLines = instructionLines.filter(line => /^\s*(\d+[\.)]\s*|step\s*\d+[\s:]*|[a-z][\.)]\s*)/i.test(line));
    
    // Extract the content after the numbering
    const numberedSteps = numberedLines.map(line => 
      line.replace(/^\s*(\d+[\.)]\s*|step\s*\d+[\s:]*|[a-z][\.)]\s*)/i, '').trim()
    ).filter(step => step.length > 0);
    
    if (numberedSteps.length >= 2) {  // Need at least 2 steps to be valid
      console.log(`Found ${numberedSteps.length} numbered steps in the instruction section`);
      extractedSteps = numberedSteps;
    } else {
      // Approach 2: If no numbered steps, look for paragraph-based instructions
      console.log("Looking for paragraph-based instructions");
      
      // Split by double newlines to get paragraphs
      const paragraphs = instructionSection.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 15);
      
      // Now check each paragraph for cooking verbs to confirm it's an instruction
      const cookingParagraphs = paragraphs.filter(paragraph => {
        const lower = paragraph.toLowerCase();
        // Skip URLs and social media mentions
        if (lower.includes('http') || lower.includes('www.')) return false;
        if (lower.includes('subscribe') || lower.includes('follow')) return false;
        if (lower.includes('youtube') || lower.includes('instagram')) return false;
        
        // Check for cooking-related terms
        return (
          lower.includes('add') || lower.includes('mix') || lower.includes('stir') ||
          lower.includes('cook') || lower.includes('heat') || lower.includes('bake') ||
          lower.includes('pour') || lower.includes('place') || lower.includes('remove') ||
          lower.includes('set') || lower.includes('let') || lower.includes('prepare')
        );
      });
      
      if (cookingParagraphs.length >= 2) {
        console.log(`Found ${cookingParagraphs.length} instruction paragraphs`);
        extractedSteps = cookingParagraphs;
      }
    }
    
    // Approach 3: If approaches 1 and 2 failed, split the section into lines
    if (extractedSteps.length === 0) {
      console.log("Looking for general instruction lines");
      const generalInstructionLines = instructionSection
        .split(/\n|\r/)
        .map(line => line.trim())
        .filter(line => line.length > 15 && line.length < 500 && !line.includes('http'))
        .filter(line => !line.toLowerCase().includes('subscribe') && !line.toLowerCase().includes('follow'));
      
      if (generalInstructionLines.length >= 3) {
        console.log(`Found ${generalInstructionLines.length} instruction lines`);
        extractedSteps = generalInstructionLines;
      }
    }
  }
  
  // If we still don't have instructions, try the cooking verb approach on the entire text
  if (extractedSteps.length === 0) {
    console.log("Looking for cooking verb instruction lines in entire text");
    const allTextLines = text.split(/\n|\r/).map(line => line.trim()).filter(line => line.length > 0);
    
    // Common cooking verbs that indicate a line is likely an instruction
    const cookingVerbs = [
      'mix', 'stir', 'beat', 'whisk', 'fold', 'pour', 'add', 'combine', 'blend',
      'chop', 'dice', 'slice', 'cut', 'mince', 'grate', 'peel', 'crush', 'grind',
      'bake', 'fry', 'sauté', 'roast', 'broil', 'grill', 'boil', 'simmer', 'steam',
      'cook', 'heat', 'warm', 'chill', 'freeze', 'thaw', 'marinate', 'season',
      'serve', 'garnish', 'sprinkle', 'drizzle', 'spread', 'layer', 'arrange',
      'prepare', 'preheat', 'turn', 'flip', 'rotate', 'lower', 'raise',
      'increase', 'decrease', 'maintain', 'check', 'test', 'cover', 'uncover',
      // Additional cooking terms
      'place', 'set', 'let', 'remove', 'transfer', 'cool', 'top', 'fill', 'drain',
      'strain', 'wash', 'rinse', 'break', 'separate', 'divide', 'form', 'shape',
      'store', 'refrigerate', 'rest', 'knead', 'roll', 'stir-fry', 'melt', 'brown'
    ];
    
    // Define cooking instruction checker
    const isLikelyCookingInstruction = (line: string): boolean => {
      const lower = line.toLowerCase();
      const trimmed = line.trim();
      
      // Skip short lines, URLs, and social media mentions
      if (trimmed.length < 15 || trimmed.length > 200) return false;
      if (lower.includes('http') || lower.includes('www.')) return false;
      if (lower.includes('subscribe') || lower.includes('follow')) return false;
      if (lower.includes('youtube') || lower.includes('instagram')) return false;
      
      // Enhanced pattern detection:
      // 1. Lines that end with periods are more likely instructions
      const hasEndingPeriod = /\.\s*$/.test(trimmed);
      
      // 2. Lines that start with imperative verbs are likely instructions
      const startsWithImperative = /^(Add|Stir|Mix|Pour|Place|Heat|Cook|Bake|Remove|Let|Set|Combine)/i.test(trimmed);
      
      // 3. High confidence if line has cooking time
      const hasCookingTime = /(\d+)\s+(minute|min|hour|hr|second|sec)s?/i.test(trimmed);
      
      // Lines with these signals get a boost
      if (hasEndingPeriod && (startsWithImperative || hasCookingTime)) {
        return true;
      }
      
      // Check if the line contains cooking verbs suggesting it's an instruction
      for (const verb of cookingVerbs) {
        const verbPattern = new RegExp(`\\b${verb}\\b`, 'i');
        if (verbPattern.test(lower)) {
          return true;
        }
      }
      
      return false;
    };
    
    const possibleInstructions = allTextLines.filter(isLikelyCookingInstruction);
    
    if (possibleInstructions.length >= 3) {
      console.log(`Found ${possibleInstructions.length} possible instruction lines in full text`);
      extractedSteps = possibleInstructions.map((step: string) => 
        step.replace(/^\d+[.)]?\s*/, '')  // Remove any existing step numbers
      );
    }
  }
  
  // Look in description and comments for long paragraphs that might be cooking steps
  if (extractedSteps.length === 0) {
    console.log("Looking for lengthy paragraphs that might be instructions");
    
    // Find paragraphs that are substantial in length (likely instructions)
    const paragraphs = text.split(/\n\s*\n/).map(p => p.trim());
    const longParagraphs = paragraphs.filter(p => p.length > 60 && p.length < 500);
    
    // Filter out social media and video promotion paragraphs
    const potentialInstructionParagraphs = longParagraphs.filter(p => {
      const lower = p.toLowerCase();
      return !lower.includes('subscribe') && 
             !lower.includes('follow') && 
             !lower.includes('channel') &&
             !lower.includes('comment') &&
             !lower.includes('like this video');
    });
    
    if (potentialInstructionParagraphs.length >= 2) {
      console.log(`Found ${potentialInstructionParagraphs.length} potential instruction paragraphs`);
      extractedSteps = potentialInstructionParagraphs;
    }
  }
  
  // If we have more than 20 steps, it might be too granular - try to merge some
  if (extractedSteps.length > 20) {
    console.log("Too many steps detected, attempting to consolidate");
    // Combine very short steps that might be fragments
    const consolidatedSteps: string[] = [];
    let currentStep = "";
    
    for (const step of extractedSteps) {
      if (step.length < 30 && currentStep.length < 100) {
        currentStep += " " + step;
      } else {
        if (currentStep) {
          consolidatedSteps.push(currentStep.trim());
        }
        currentStep = step;
      }
    }
    
    if (currentStep) {
      consolidatedSteps.push(currentStep.trim());
    }
    
    extractedSteps = consolidatedSteps;
  }
  
  console.log(`Final instruction count: ${extractedSteps.length}`);
  return extractedSteps;
}

/**
 * Format ingredient string with measurements
 */
function extractMeasurements(ingredient: string): { quantity: number, unit: string }[] {
  // Enhanced regex to capture fractions and regular numbers
  const measurementRegex = /(\d+\/\d+|\d+\s+\d+\/\d+|\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|half|quarter)\s*(cup|tbsp|tsp|tablespoon|teaspoon|oz|ounce|pound|lb|g|gram|ml|l|liter|clove|slice|can|jar|package|container)s?/gi;
  
  const measurements: { quantity: number, unit: string }[] = [];
  let match;
  
  while ((match = measurementRegex.exec(ingredient)) !== null) {
    let quantityStr = match[1].toLowerCase();
    let numericQuantity: number;
    
    // Convert text numbers to numeric
    const wordToNumber: Record<string, number> = {
      'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
      'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
      'half': 0.5, 'quarter': 0.25
    };
    
    if (wordToNumber[quantityStr] !== undefined) {
      numericQuantity = wordToNumber[quantityStr];
    } else if (quantityStr.includes('/')) {
      // Handle fractions like "1/2", "1/4", "1 1/2"
      if (quantityStr.includes(' ')) {
        // Mixed number like "1 1/2"
        const parts = quantityStr.split(' ');
        const whole = parseFloat(parts[0]);
        const fractionParts = parts[1].split('/');
        const fraction = parseFloat(fractionParts[0]) / parseFloat(fractionParts[1]);
        numericQuantity = whole + fraction;
      } else {
        // Simple fraction like "1/2"
        const fractionParts = quantityStr.split('/');
        numericQuantity = parseFloat(fractionParts[0]) / parseFloat(fractionParts[1]);
      }
    } else {
      numericQuantity = parseFloat(quantityStr);
    }
    
    let unit = match[2].toLowerCase();
    
    // Normalize units
    const unitMap: Record<string, string> = {
      'tablespoon': 'tbsp', 'teaspoon': 'tsp',
      'ounce': 'oz', 'pound': 'lb',
      'gram': 'g', 'liter': 'l',
      'clove': 'cloves', 'slice': 'slices'
    };
    
    const normalizedUnit = unitMap[unit] || unit;
    
    measurements.push({
      quantity: numericQuantity,
      unit: normalizedUnit
    });
  }
  
  // If no measurements found but ingredient contains "large" or similar size descriptors
  if (measurements.length === 0) {
    // Check for items like "4 large eggs", "2 medium onions"
    const simpleQuantityMatch = ingredient.match(/^(\d+)\s+(large|medium|small)?\s*(.+)/i);
    if (simpleQuantityMatch) {
      measurements.push({
        quantity: parseFloat(simpleQuantityMatch[1]),
        unit: 'pieces'
      });
    }
  }
  
  return measurements;
}

/**
 * Create a complete recipe from a YouTube video 
 */
export async function getRecipeFromYouTube(query: string, filters?: {
  cuisine?: string;
  diet?: string;
  cookingTime?: string;
  availableIngredients?: string;
  excludeIngredients?: string;
}): Promise<any | null> {
  try {
    console.log(`🎬 [YOUTUBE] Starting generalized recipe workflow for: "${query}"`);
    console.log(`🔍 [YOUTUBE] Filters:`, filters);
    
    // Step 1: Query Spoonacular API to enforce cooking time and get authentic recipe data
    let spoonacularRecipe: SpoonacularRecipe | null = null;
    let cookingTimeMinutes = 30; // Default fallback
    
    try {
      spoonacularRecipe = await getSpoonacularRecipe(query, filters);
      if (spoonacularRecipe) {
        cookingTimeMinutes = spoonacularRecipe.readyInMinutes;
        console.log(`Spoonacular recipe found: "${spoonacularRecipe.title}" (${cookingTimeMinutes} min)`);
      } else {
        console.log("No Spoonacular recipe found, proceeding with YouTube-only workflow");
      }
    } catch (error) {
      console.warn("Spoonacular API failed, falling back to YouTube-only workflow:", error);
    }
    
    // Step 2: Find the best YouTube video with enhanced filter-aware search
    const videoInfo = await findBestRecipeVideo(query, filters, cookingTimeMinutes);
    
    if (!videoInfo) {
      console.error("Failed to find a suitable recipe video");
      return null;
    }
    
    console.log(`✅ [YOUTUBE] Found video: ${videoInfo.title} by ${videoInfo.channelTitle}`);
    console.log(`🔗 [YOUTUBE] Video URL: https://www.youtube.com/watch?v=${videoInfo.id}`);
    
    // Step 2: Get transcript using Whisper if needed
    let transcript = '';
    try {
      // Import Whisper transcriber
      // TEMPORARILY DISABLED - Whisper functionality commented out
      // const { whisperTranscriber } = await import('./whisperTranscriber');
      
      console.log('🎙️ [YOUTUBE] Checking for transcript...');
      const videoUrl = `https://www.youtube.com/watch?v=${videoInfo.id}`;
      
      // Try to get transcript (will use Whisper V3 Turbo if no native transcript exists)
      // TEMPORARILY DISABLED - Whisper functionality commented out
      console.log('❌ [YOUTUBE] Whisper transcription disabled');
      transcript = videoInfo.description || ''; // Use description as fallback only
      
      /*
      transcript = await whisperTranscriber.getTranscriptWithFallback(
        videoUrl,
        videoInfo.description // Use description as potential existing transcript
      );
      */
      
      if (transcript && transcript.length > 50) {
        console.log(`✅ [YOUTUBE] Got transcript (${transcript.length} chars)`);
        console.log(`📝 [YOUTUBE] Transcript preview: ${transcript.substring(0, 150)}...`);
      } else {
        console.log('⚠️ [YOUTUBE] No transcript available');
      }
    } catch (error) {
      console.error('❌ [YOUTUBE] Error getting transcript:', error);
      transcript = '';
    }
    
    // Step 3: Get video comments (might contain recipe details)
    console.log('💬 [YOUTUBE] Fetching video comments...');
    videoInfo.comments = await getVideoComments(videoInfo.id);
    
    // Step 4: Extract ingredients with simplified pipeline (initial -> transcript-only fallback)
    let ingredients: string[] = [];
    
    console.log('🥗 [YOUTUBE] Extracting ingredients...');
    
    // First try description and transcript for ingredients using LLaVA-Chef
    const textForIngredients = transcript || videoInfo.description;
    const descriptionIngredients = await extractIngredientsWithLLaVA(textForIngredients);
    if (descriptionIngredients.length > 0) {
      console.log(`Found ${descriptionIngredients.length} ingredients in video description`);
      // Clean up ingredients to fix duplicate measurements (but preserve mixed fractions like "1 1/2")
      ingredients = descriptionIngredients.map(ingredient => 
        ingredient
          // Fix actual duplicate measurement patterns but preserve mixed fractions
          .replace(/(\d+(?:\.\d+)?)\s*(cup|cups|tsp|tbsp|tablespoon|teaspoon|tablespoons|teaspoons)\s+\1\s*\2s?/gi, '$1 $2')
          .replace(/(\d+(?:\.\d+)?)\s*(oz|ounce|ounces|pound|pounds|lb|lbs|g|gram|grams|ml|l|liter|liters)\s+\1\s*\2s?/gi, '$1 $2')
          // Remove duplicated words (but not mixed fractions)
          .replace(/(\b\w+)\s+\1\b/g, '$1')
          .replace(/\s+/g, ' ')
          .trim()
      ).filter(ingredient => ingredient.length > 0);
    } 
    // If not in description, ONLY try PINNED comments (never random comments)
    else if (videoInfo.comments && videoInfo.comments.length > 0) {
      // ONLY check pinned or creator comments
      const pinnedComments = videoInfo.comments.filter(comment => 
        comment.toLowerCase().includes('pinned') ||
        comment.toLowerCase().includes('creator') ||
        comment.toLowerCase().includes('highlighted'));
      
      if (pinnedComments.length > 0) {
        console.log(`Checking ${pinnedComments.length} pinned comments for ingredients`);
        
        for (const comment of pinnedComments) {
          const commentIngredients = await extractIngredientsWithLLaVA(comment);
          if (commentIngredients.length > 2) {  // Must have at least 3 ingredients to be valid
            console.log(`Found ${commentIngredients.length} ingredients in pinned comment`);
            ingredients = commentIngredients;
            break;  // Stop after finding ingredients in a pinned comment
          }
        }
      }
    }
    
    // Replace with minimal measured list using dedicated helper
    try {
      const { ensureMeasuredIngredients } = await import('./ingredientSimple');
      ingredients = await ensureMeasuredIngredients({
        transcript: transcript || '',
        description: videoInfo.description || '',
        initial: ingredients,
        title: videoInfo.title,
      });
    } catch (e) {
      console.error('[ING SIMPLE] pipeline failed:', e);
    }

    // Apply advanced deduplication and cleaning to all extracted ingredients
    if (ingredients.length > 0) {
      console.log(`Before deduplication: ${ingredients.length} ingredients`);
      
      // First pass: remove exact duplicates (case-insensitive)
      const seen = new Set();
      ingredients = ingredients.filter(ingredient => {
        const normalized = ingredient.toLowerCase().trim();
        if (seen.has(normalized)) {
          return false;
        }
        seen.add(normalized);
        return true;
      });
      
      // Second pass: advanced similarity-based deduplication
      ingredients = cleanIngredientList(ingredients);
      console.log(`After deduplication: ${ingredients.length} ingredients`);
    }
    
    // Step 5: Extract instructions using LLaVA-Chef with parallel processing
    let instructions: string[] = [];
    
    console.log('📝 [YOUTUBE] Extracting instructions...');
    
    try {
      // Use LLaVA-Chef to extract instructions (with transcript if available)
      const textForInstructions = transcript || videoInfo.description;
      console.log(`🔍 [YOUTUBE] Using ${transcript ? 'transcript' : 'description'} for instruction extraction`);
      
      const aiInstructions = await extractInstructionsWithLLaVA(textForInstructions, videoInfo.description);
      if (aiInstructions.length > 0) {
        console.log(`LLaVA-Chef extracted ${aiInstructions.length} instruction steps`);
        instructions = aiInstructions;
      } else {
        console.log('LLaVA-Chef could not extract instructions, trying fallback');
        instructions = fallbackInstructionExtraction(videoInfo.description);
      }
    } catch (error) {
      console.error('Error with LLaVA-Chef instruction extraction:', error);
      instructions = fallbackInstructionExtraction(videoInfo.description);
    }
    
    // Ingredient pipeline simplified above; no further upgrades here

    // Step 7: Validate instructions; if missing or invalid, generate with GPT-OSS-120B
    const areValid = await groqValidator.validateInstructions(instructions);
    if (instructions.length === 0 || !areValid) {
      console.log("⚠️ [YOUTUBE] No instructions extracted, attempting GPT-OSS-120B generation...");
      console.log(`📊 [YOUTUBE] Available text sources:`);
      console.log(`  - Transcript: ${transcript ? `${transcript.length} chars` : 'NOT AVAILABLE'}`);
      console.log(`  - Description: ${videoInfo.description ? `${videoInfo.description.length} chars` : 'NOT AVAILABLE'}`);
      
      // Try to generate instructions using GPT-OSS-120B
      try {
        const { groqInstructionGenerator } = await import('./groqInstructionGenerator');
        
        // Use transcript if available, otherwise use description
        const textToUse = transcript || videoInfo.description || '';
        
        if (textToUse.length > 50) {
          console.log(`🤖 [YOUTUBE] Using ${transcript ? 'TRANSCRIPT' : 'DESCRIPTION'} for GPT-OSS-120B generation`);
          console.log(`📝 [YOUTUBE] Text preview: "${textToUse.substring(0, 200)}..."`);
          
          instructions = await groqInstructionGenerator.generateInstructionsFromTranscript(
            textToUse,
            videoInfo.title,
            ingredients
          );
          
          if (instructions.length > 0) {
            console.log(`✅ [YOUTUBE] GPT-OSS-120B successfully generated ${instructions.length} instructions`);
            instructions.forEach((inst, idx) => {
              console.log(`  ${idx + 1}. ${inst.substring(0, 80)}...`);
            });
          } else {
            console.log(`❌ [YOUTUBE] GPT-OSS-120B failed to generate instructions`);
          }
        } else {
          console.log(`❌ [YOUTUBE] Insufficient text for instruction generation (only ${textToUse.length} chars)`);
        }
      } catch (genError) {
        console.error('❌ [YOUTUBE] Error generating instructions with GPT-OSS-120B:', genError);
      }
      
      // If still no instructions, leave empty for validation to handle
      if (instructions.length === 0) {
        console.log("⚠️ [YOUTUBE] No instructions generated, will be handled by validation pipeline");
        instructions = [];
      }
    } else {
      console.log(`✅ [YOUTUBE] Successfully extracted ${instructions.length} instructions`);
    }
    
    // Return the complete recipe data with proper video fields
    return {
      title: videoInfo.title,
      description: videoInfo.description,
      ingredients: ingredients.map(ingredient => {
        // Extract just the ingredient name without measurements for the 'name' field
        const cleanName = ingredient
          .replace(/^\d+\/\d+|\d+\s+\d+\/\d+|\d+(?:\.\d+)?/g, '')
          .replace(/\b(cup|tbsp|tsp|tablespoon|teaspoon|oz|ounce|pound|lb|g|gram|ml|l|liter|clove|slice|can|jar|package|container)s?\b/gi, '')
          .replace(/^\s*(of|large|medium|small)\s+/i, '')
          .trim();
        
        return {
          name: cleanName || ingredient,
          display_text: ingredient,
          measurements: extractMeasurements(ingredient)
        };
      }),
      instructions: instructions,
      videoUrl: `https://www.youtube.com/watch?v=${videoInfo.id}`,
      thumbnailUrl: videoInfo.thumbnailUrl,
      channelTitle: videoInfo.channelTitle,
      video_id: videoInfo.id,
      video_title: videoInfo.title,
      video_channel: videoInfo.channelTitle,
      source_url: `https://www.youtube.com/watch?v=${videoInfo.id}`,
      source_name: videoInfo.channelTitle,
      transcript: transcript || ''  // Store transcript for later use if needed
    };
    
    // Format ingredients with consistent measurement formatting
    const formattedIngredients: Ingredient[] = ingredients.map(ingredient => {
      // Clean ingredient and extract measurement info
      let cleanedIngredient = ingredient
        // Fix actual duplicate measurement patterns but preserve mixed fractions like "1 1/2"
        .replace(/(\d+(?:\.\d+)?)\s*(cup|cups|tsp|tbsp|tablespoon|teaspoon|tablespoons|teaspoons)\s+\1\s*\2s?/gi, '$1 $2')
        .replace(/(\d+(?:\.\d+)?)\s*(oz|ounce|ounces|pound|pounds|lb|lbs|g|gram|grams|ml|l|liter|liters)\s+\1\s*\2s?/gi, '$1 $2')
        // Remove duplicated words (but not mixed fractions)
        .replace(/(\b\w+)\s+\1\b/g, '$1')
        .replace(/\s+/g, ' ')
        .trim();

      // Enhanced measurement extraction
      const measurementRegex = /^([\d\s\./]+)\s*(cup|cups|tbsp|tsp|tablespoon|teaspoons|teaspoon|tablespoons|oz|ounce|ounces|pound|pounds|lb|lbs|g|gram|grams|kg|ml|liter|liters|l|pinch|pinches|dash|dashes|clove|cloves|can|cans|jar|jars)\s+(.+)$/i;
      const match = cleanedIngredient.match(measurementRegex);
      
      if (match) {
        const quantity = match[1].trim();
        const unit = match[2].trim();
        const itemName = match[3].trim();
        
        return {
          name: itemName,
          display_text: itemName,
          measurements: [{ 
            quantity: parseFloat(quantity.replace(/\s+/g, '')) || 1, 
            unit: unit 
          }]
        };
      } else {
        // No measurement found - return as-is with default quantity
        return {
          name: cleanedIngredient,
          display_text: cleanedIngredient,
          measurements: [{ quantity: 1, unit: "item" }]
        };
      }
    });
    
    // Create the final recipe with Spoonacular data integration
    const recipeTitle = spoonacularRecipe ? spoonacularRecipe.title : 
                       (query.charAt(0).toUpperCase() + query.slice(1));
    
    let description = `A delicious recipe for ${query}`;
    if (videoInfo) {
      description += ` based on the video "${videoInfo.title}" by ${videoInfo.channelTitle}`;
    }
    if (spoonacularRecipe) {
      description += ` with verified cooking time of ${cookingTimeMinutes} minutes`;
    }
    description += '.';
    
    // Handle cases where no video matches filters but Spoonacular recipe exists
    if (!videoInfo && spoonacularRecipe) {
      description += ' No video found matching your filters and time, but here\'s a recipe.';
    }
    
    // Debug: Check videoInfo before creating recipe
    console.log("VideoInfo status before creating recipe:", {
      exists: !!videoInfo,
      id: videoInfo?.id,
      title: videoInfo?.title,
      channel: videoInfo?.channelTitle
    });

    const recipe = {
      title: recipeTitle,
      description: description,
      image_url: (spoonacularRecipe?.image) || (videoInfo?.thumbnailUrl) || 'https://via.placeholder.com/350x200?text=Recipe+Image',
      time_minutes: cookingTimeMinutes, // Use Spoonacular time or fallback
      cuisine: filters?.cuisine || 'Any Cuisine',
      diet: filters?.diet || 'None',
      ingredients: formattedIngredients,
      instructions: instructions,
      source_url: videoInfo ? `https://www.youtube.com/watch?v=${videoInfo.id}` : undefined,
      source_name: videoInfo?.channelTitle,
      video_id: videoInfo?.id,
      video_title: videoInfo?.title,
      video_channel: videoInfo?.channelTitle,
      spoonacular_id: spoonacularRecipe?.id,
      spoonacular_title: spoonacularRecipe?.title
    };
    
    console.log(`Final recipe created with ${recipe.ingredients.length} ingredients and ${recipe.instructions.length} instructions`);
    console.log(`Video data in final recipe:`, {
      video_id: recipe.video_id,
      video_title: recipe.video_title,
      video_channel: recipe.video_channel
    });
    
    return recipe;
  } catch (error) {
    console.error("Error creating recipe:", error);
    return null;
  }
}