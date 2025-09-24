/**
 * YouTube API utility functions
 * To get recipe-related videos for embedding and transcripts
 */
import axios from 'axios';

// Default video ID if YouTube API search fails
const DEFAULT_VIDEO_ID = 'KwTxmWJDYHQ'; // General cooking tips

// API key from environment variables
const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;

// Base URLs for YouTube APIs
const YOUTUBE_API_BASE_URL = 'https://www.googleapis.com/youtube/v3';
const YOUTUBE_TRANSCRIPT_API_BASE_URL = 'https://youtubetranscript.com';

// Interface for YouTube video details
export interface YouTubeVideoDetails {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  channelTitle: string;
  publishedAt: string;
  duration?: string;
}

// Interface for transcript data
export interface TranscriptItem {
  text: string;
  start: number;
  duration: number;
}

/**
 * Search for a YouTube video by query
 * Uses the official YouTube Data API v3
 * 
 * @param query Search query (e.g. recipe title)
 * @param maxResults Maximum number of results to return
 * @returns YouTube Video ID if found
 */
export const searchYouTubeVideo = async (query: string, maxResults = 5): Promise<string> => {
  try {
    if (!query) return DEFAULT_VIDEO_ID;
    if (!YOUTUBE_API_KEY) {
      console.error('YouTube API key is missing');
      return DEFAULT_VIDEO_ID;
    }
    
    // Format the search query for recipe videos with specific keywords
    const searchQuery = `${query} recipe cooking tutorial easy how to make`;
    
    // Make API request to YouTube Data API with improved parameters
    const response = await axios.get(`${YOUTUBE_API_BASE_URL}/search`, {
      params: {
        part: 'snippet',
        q: searchQuery,
        type: 'video',
        maxResults,
        key: YOUTUBE_API_KEY,
        videoCategoryId: '26', // Category for "Howto & Style"
        relevanceLanguage: 'en',
        videoEmbeddable: 'true', // Only videos that can be embedded
        videoSyndicated: 'true', // Only videos that can be played outside YouTube
        order: 'relevance'  // Sort by relevance
      }
    });
    
    // If we have results, check multiple videos to find one that's available
    if (response.data && response.data.items && response.data.items.length > 0) {
      // Get all video IDs to verify them
      const videoIds = response.data.items.map((item: any) => item.id.videoId).join(',');
      
      // Get detailed info about these videos including statistics
      try {
        const detailsResponse = await axios.get(`${YOUTUBE_API_BASE_URL}/videos`, {
          params: {
            part: 'statistics,status,contentDetails',
            id: videoIds,
            key: YOUTUBE_API_KEY
          }
        });
        
        if (detailsResponse.data && detailsResponse.data.items && detailsResponse.data.items.length > 0) {
          // Filter for videos that are definitely public and available
          const availableVideos = detailsResponse.data.items.filter((video: any) => 
            video.status && 
            video.status.embeddable === true && 
            video.status.privacyStatus === 'public'
          );
          
          if (availableVideos.length > 0) {
            // Sort by view count (higher first) to get more popular/reliable videos
            availableVideos.sort((a: any, b: any) => {
              const viewsA = parseInt(a.statistics.viewCount || '0');
              const viewsB = parseInt(b.statistics.viewCount || '0');
              return viewsB - viewsA;
            });
            
            // Return the ID of the most popular available video
            return availableVideos[0].id;
          }
        }
      } catch (detailsError) {
        console.error('Error fetching video details:', detailsError);
        // Fall back to the first search result if details check fails
      }
      
      // If we couldn't verify or find available videos, return the first search result
      return response.data.items[0].id.videoId;
    }
    
    // Return default video if no results
    return DEFAULT_VIDEO_ID;
  } catch (error) {
    console.error('Error searching YouTube:', error);
    return DEFAULT_VIDEO_ID;
  }
};

/**
 * Get detailed information about a YouTube video
 * 
 * @param videoId YouTube video ID
 * @returns Video details object
 */
export const getYouTubeVideoDetails = async (videoId: string): Promise<YouTubeVideoDetails | null> => {
  try {
    if (!YOUTUBE_API_KEY) {
      console.error('YouTube API key is missing');
      return null;
    }
    
    // Make API request to YouTube Data API
    const response = await axios.get(`${YOUTUBE_API_BASE_URL}/videos`, {
      params: {
        part: 'snippet,contentDetails',
        id: videoId,
        key: YOUTUBE_API_KEY
      }
    });
    
    // Extract video details from response
    if (response.data && response.data.items && response.data.items.length > 0) {
      const video = response.data.items[0];
      return {
        id: video.id,
        title: video.snippet.title,
        description: video.snippet.description,
        thumbnailUrl: video.snippet.thumbnails.high.url,
        channelTitle: video.snippet.channelTitle,
        publishedAt: video.snippet.publishedAt,
        duration: video.contentDetails.duration
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching YouTube video details:', error);
    return null;
  }
};

/**
 * Get transcript/captions for a YouTube video
 * Uses YouTubeTranscript API as a fallback
 * 
 * @param videoId YouTube video ID
 * @returns Array of transcript items or null if not available
 */
export const getYouTubeTranscript = async (videoId: string): Promise<TranscriptItem[] | null> => {
  try {
    // Using YouTube Transcript API (public service)
    const response = await axios.get(`${YOUTUBE_TRANSCRIPT_API_BASE_URL}/?v=${videoId}`);
    
    if (response.data && Array.isArray(response.data)) {
      return response.data as TranscriptItem[];
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching YouTube transcript:', error);
    return null;
  }
};

/**
 * Extract potential ingredients from a video description or transcript
 * Prioritizes description parsing (which is often more structured) with transcript as fallback
 * 
 * @param transcript Transcript items array
 * @param description Video description
 * @returns Array of potential ingredients
 */
export const extractIngredientsFromVideo = async (
  transcript: TranscriptItem[] | null, 
  description: string | null
): Promise<string[]> => {
  // Common ingredient section indicators
  const ingredientsSectionIndicators = [
    'ingredients', 'you will need', 'shopping list', 'what you need', 'items needed',
    'ingredients:', 'ingredients list', 'ingredients needed', 'you need'
  ];
  
  // Common instruction/recipe section indicators that might follow ingredients
  const instructionIndicators = [
    'instructions', 'directions', 'method', 'preparation', 'steps', 'how to make',
    'instructions:', 'directions:', 'method:', 'steps:', 'procedure'
  ];
  
  // Common ingredient units for validation
  const commonUnits = [
    'cup', 'cups', 'tablespoon', 'tablespoons', 'tbsp', 'teaspoon', 'teaspoons', 'tsp',
    'gram', 'grams', 'g', 'kilogram', 'kilograms', 'kg', 'pound', 'pounds', 'lb', 'lbs',
    'ounce', 'ounces', 'oz', 'ml', 'milliliter', 'milliliters', 'liter', 'liters', 'l',
    'pinch', 'pinches', 'dash', 'dashes', 'handful', 'handfuls', 'slice', 'slices',
    'piece', 'pieces', 'clove', 'cloves', 'bunch', 'bunches', 'sprig', 'sprigs',
    'stalk', 'stalks', 'head', 'heads', 'package', 'packages', 'can', 'cans',
    'jar', 'jars', 'container', 'containers', 'bottle', 'bottles'
  ];
  
  // Common cooking ingredients for validation
  const commonIngredients = [
    'salt', 'pepper', 'oil', 'butter', 'sugar', 'flour', 'egg', 'eggs', 'milk',
    'water', 'garlic', 'onion', 'tomato', 'potato', 'chicken', 'beef', 'fish',
    'rice', 'pasta', 'cheese', 'cream', 'yogurt', 'lemon', 'lime', 'vinegar',
    'sauce', 'broth', 'stock', 'herb', 'spice', 'seasoning', 'vegetable', 'fruit',
    'bread', 'chocolate', 'vanilla', 'cinnamon', 'honey', 'syrup', 'wine', 'beer',
    'mustard', 'mayonnaise', 'ketchup', 'soy sauce', 'olive oil', 'coconut', 'curry',
    'basil', 'oregano', 'thyme', 'rosemary', 'parsley', 'cilantro', 'mint', 'ginger',
    'cumin', 'paprika', 'turmeric', 'chili', 'pepper', 'bay leaf', 'clove', 'nutmeg',
    'coriander', 'cardamom', 'cinnamon', 'allspice', 'sage', 'dill', 'tarragon'
  ];
  
  let potentialIngredients: string[] = [];
  
  // STEP 1: First try to parse the description - usually more structured
  if (description) {
    const lines = description.split('\n').map(line => line.trim());
    
    // Look for ingredients section
    let inIngredientsSection = false;
    let ingredientsSectionStartIndex = -1;
    
    // First, try to find the ingredients section header
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      
      if (ingredientsSectionIndicators.some(indicator => 
          line.includes(indicator) || line === indicator || 
          line.startsWith(indicator + ":") || line.startsWith(indicator + "s:"))) {
        inIngredientsSection = true;
        ingredientsSectionStartIndex = i;
        break;
      }
    }
    
    // If found ingredients section, extract lines until we reach an instruction section or end
    if (inIngredientsSection && ingredientsSectionStartIndex >= 0) {
      for (let i = ingredientsSectionStartIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        const lowerLine = line.toLowerCase();
        
        // Skip empty lines
        if (!line) continue;
        
        // End ingredients section if we hit instructions
        if (instructionIndicators.some(indicator => 
            lowerLine.includes(indicator) || lowerLine === indicator ||
            lowerLine.startsWith(indicator + ":") || lowerLine.startsWith(indicator + "s:"))) {
          break;
        }
        
        // Skip lines that are likely not ingredients (too short, too long, or contain common non-ingredient words)
        if (line.length < 3 || line.length > 100 || 
            /^(SUBSCRIBE|FOLLOW|LIKE|SHARE|WATCH|VIDEO|INSTAGRAM|FACEBOOK|TWITTER|TIKTOK|YOUTUBE|CHANNEL|CLICK)/i.test(line)) {
          continue;
        }
        
        // Skip lines that are likely headers/section titles
        if (/^[A-Z\s]+:?$/.test(line) && line.length < 20) {
          continue;
        }
        
        // Add line as potential ingredient
        potentialIngredients.push(line);
      }
    }
    
    // If we didn't find an explicit ingredients section, try to identify ingredients by patterns
    if (potentialIngredients.length === 0) {
      for (const line of lines) {
        // Skip empty or very short lines
        if (!line || line.length < 3) continue;
        
        // Patterns that suggest this line is an ingredient
        // 1. Lines that start with measurements/numbers
        // 2. Lines that contain common ingredient names
        // 3. Lines that contain common units of measurement
        
        const containsNumber = /\d+/.test(line);
        const containsCommonUnits = commonUnits.some(unit => 
          line.toLowerCase().includes(` ${unit} `) || 
          line.toLowerCase().endsWith(` ${unit}`) || 
          line.toLowerCase().includes(`${unit}s `) ||
          line.toLowerCase().includes(`${unit} of `)
        );
        const containsCommonIngredient = commonIngredients.some(ingredient => 
          line.toLowerCase().includes(` ${ingredient} `) || 
          line.toLowerCase().endsWith(` ${ingredient}`) || 
          line.toLowerCase().includes(`${ingredient}s `) ||
          line.toLowerCase().includes(`${ingredient},`)
        );
        
        // Example pattern: "2 cups flour" or "1/2 tablespoon salt" or "4-5 large eggs"
        if ((containsNumber && (containsCommonUnits || containsCommonIngredient)) ||
            (containsCommonIngredient && containsCommonUnits)) {
          potentialIngredients.push(line);
        }
      }
    }
  }
  
  // STEP 2: If we didn't find enough ingredients in the description, try the transcript as fallback
  if (transcript && transcript.length > 0 && potentialIngredients.length < 3) {
    const fullText = transcript.map(item => item.text).join(' ');
    
    // Look for sections that might contain ingredients
    for (const indicator of ingredientsSectionIndicators) {
      if (fullText.toLowerCase().includes(indicator)) {
        // Find the position of the indicator and extract the next 500 characters
        const index = fullText.toLowerCase().indexOf(indicator);
        const endIndex = Math.min(index + 800, fullText.length); // Capture a generous portion of text
        const relevantSection = fullText.substring(index, endIndex);
        
        // Find the end of the ingredients section
        let ingredientsEndIndex = endIndex;
        for (const endIndicator of instructionIndicators) {
          const endPos = relevantSection.toLowerCase().indexOf(endIndicator);
          if (endPos > 0 && endPos < ingredientsEndIndex - index) {
            ingredientsEndIndex = index + endPos;
          }
        }
        
        // Extract the ingredients section
        const ingredientsSection = fullText.substring(index, ingredientsEndIndex);
        
        // Split into sentences and lines
        const sentences = ingredientsSection.split(/[.!?]\s+/);
        
        for (const sentence of sentences) {
          // Skip sentences that don't look like ingredients
          if (!sentence || sentence.length < 3 || sentence.length > 100) continue;
          
          // Split sentence into possible ingredient phrases
          const phrases = sentence.split(/,|;|\band\b/).map(p => p.trim());
          
          for (const phrase of phrases) {
            // Skip phrases that are too short or don't seem like ingredients
            if (!phrase || phrase.length < 3 || phrase.length > 50) continue;
            
            // Check if the phrase contains numbers (measurements) or common ingredients
            const containsNumber = /\d+/.test(phrase);
            const containsCommonUnits = commonUnits.some(unit => 
              phrase.toLowerCase().includes(` ${unit} `) || 
              phrase.toLowerCase().endsWith(` ${unit}`) || 
              phrase.toLowerCase().includes(`${unit}s `)
            );
            const containsCommonIngredient = commonIngredients.some(ingredient => 
              phrase.toLowerCase().includes(` ${ingredient} `) || 
              phrase.toLowerCase().endsWith(` ${ingredient}`) || 
              phrase.toLowerCase().includes(`${ingredient}s `)
            );
            
            if ((containsNumber && (containsCommonUnits || containsCommonIngredient)) ||
                containsCommonIngredient) {
              potentialIngredients.push(phrase);
            }
          }
        }
      }
    }
  }
  
  // STEP 3: Clean up and deduplicate ingredients
  const cleanedIngredients = potentialIngredients
    .map(item => {
      // Remove leading numbers, bullets and other common formatting
      item = item.replace(/^[\d\s-–•*]+\.\s*/, '').trim();
      // Replace fractions with standard format
      item = item.replace(/¼/g, '1/4').replace(/½/g, '1/2').replace(/¾/g, '3/4');
      // Remove any trailing punctuation
      item = item.replace(/[.,;:]$/, '').trim();
      return item;
    })
    .filter(item => {
      // Filter out non-ingredient items
      if (!item || item.length < 3 || item.length > 100) return false;
      if (/^(SUBSCRIBE|FOLLOW|LIKE|SHARE|WATCH|VIDEO|CONTACT|MUSIC|CREDIT|COPYRIGHT)/i.test(item)) return false;
      // Items with numbers or ingredient names are more likely to be valid
      return /\d+/.test(item) || 
             commonIngredients.some(ingredient => item.toLowerCase().includes(ingredient));
    });
  
  // Use Set to deduplicate
  const uniqueIngredients = Array.from(new Set(cleanedIngredients));
  
  return uniqueIngredients;
};

/**
 * Format a YouTube embed URL from a video ID
 */
export const formatYouTubeEmbedUrl = (videoId: string): string => {
  return `https://www.youtube.com/embed/${videoId}?rel=0`;
};

/**
 * Get a YouTube thumbnail URL from a video ID
 * @param videoId YouTube video ID
 * @param quality Thumbnail quality (default, medium, high, standard, maxres)
 * @returns URL to the thumbnail image
 */
export const formatYouTubeThumbnailUrl = (videoId: string, quality: 'default' | 'medium' | 'high' | 'standard' | 'maxres' = 'high'): string => {
  return `https://i.ytimg.com/vi/${videoId}/${quality}default.jpg`;
};