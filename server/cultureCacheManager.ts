interface CulturalCuisineData {
  meals: Array<{
    name: string;
    description: string;
    cooking_techniques: string[];
    full_ingredients: string[];
    healthy_ingredients: string[];
    healthy_modifications: string[];
  }>;
  summary: {
    common_healthy_ingredients: string[];
    common_cooking_techniques: string[];
  };
  cached_at: Date;
  last_accessed: Date;
  access_count: number;
  data_version: string;
  source_quality_score?: number;
}

// Database imports for global cache
import { db } from './db';
import { culturalCuisineCache } from '@shared/schema';
import { eq } from 'drizzle-orm';

interface CultureDishCache {
  [userId: string]: {
    [cultureTag: string]: CulturalCuisineData;
  };
}

interface CacheMetrics {
  hits: number;
  misses: number;
  errors: number;
  last_cleanup: Date;
  total_entries: number;
  memory_usage_bytes: number;
}

interface BatchFetchResult {
  success: { [culture: string]: CulturalCuisineData };
  failed: string[];
  errors: { [culture: string]: string };
}

// In-memory cache for cultural cuisine data
const culture_dish_cache: CultureDishCache = {};

// Cache metrics for monitoring and optimization
const cache_metrics: CacheMetrics = {
  hits: 0,
  misses: 0, 
  errors: 0,
  last_cleanup: new Date(),
  total_entries: 0,
  memory_usage_bytes: 0
};

// Configuration constants
const CACHE_CONFIG = {
  DEFAULT_TTL_HOURS: 24,
  MAX_CACHE_SIZE_MB: 50,
  CLEANUP_INTERVAL_HOURS: 6,
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
  BATCH_SIZE: 5,
  DATA_VERSION: '1.2.0'
};

// Rate limiting for API calls
const api_call_timestamps: number[] = [];
const MAX_CALLS_PER_MINUTE = 10;

// Global cache statistics and management functions
export async function getGlobalCacheStats() {
  try {
    const result = await db
      .select({
        total_cuisines: 'count(*)',
        total_access_count: 'sum(access_count)',
        avg_quality_score: 'avg(quality_score)',
        oldest_entry: 'min(created_at)',
        newest_entry: 'max(created_at)'
      })
      .from(culturalCuisineCache);
    
    return {
      ...result[0],
      memory_cache_metrics: cache_metrics
    };
  } catch (error) {
    console.error('❌ Error getting cache stats:', error);
    return null;
  }
}

export async function clearGlobalCache() {
  try {
    await db.delete(culturalCuisineCache);
    console.log('🗑️ Cleared global cultural cuisine cache');
    return true;
  } catch (error) {
    console.error('❌ Error clearing global cache:', error);
    return false;
  }
}

export async function getCulturalCuisineData(userId: string | number, cultureTag: string, options: { forceRefresh?: boolean } = {}): Promise<CulturalCuisineData | null> {
  const normalizedCuisine = cultureTag.toLowerCase().trim();
  
  try {
    // Check global database cache first (unless forced refresh)
    if (!options.forceRefresh) {
      console.log(`🔍 Looking for cached data for: "${normalizedCuisine}"`);
      
      const cachedEntries = await db
        .select()
        .from(culturalCuisineCache)
        .where(eq(culturalCuisineCache.cuisine_name, normalizedCuisine))
        .limit(1);
      
      console.log(`🔍 Database query returned ${cachedEntries.length} results`);
      
      const cachedEntry = cachedEntries[0];
      if (cachedEntry) {
        const ageHours = (Date.now() - new Date(cachedEntry.created_at).getTime()) / (1000 * 60 * 60);
        
        if (ageHours < CACHE_CONFIG.DEFAULT_TTL_HOURS) {
          console.log(`✅ Global cache hit for ${normalizedCuisine}, age: ${ageHours.toFixed(1)}h`);
          
          // Update access tracking
          await db
            .update(culturalCuisineCache)
            .set({ 
              access_count: cachedEntry.access_count + 1,
              last_accessed: new Date()
            })
            .where(eq(culturalCuisineCache.id, cachedEntry.id));
          
          cache_metrics.hits++;
          
          // Convert database format to expected format
          const cachedResult: CulturalCuisineData = {
            meals: cachedEntry.meals_data as any,
            summary: cachedEntry.summary_data as any,
            cached_at: new Date(cachedEntry.created_at),
            last_accessed: new Date(),
            access_count: cachedEntry.access_count + 1,
            data_version: cachedEntry.data_version,
            source_quality_score: cachedEntry.quality_score || 0
          };
          
          // Log the cache hit for visibility
          try {
            const { logPerplexitySearch } = await import('./perplexitySearchLogger');
            await logPerplexitySearch(
              `Cultural cuisine research: ${normalizedCuisine} (cached)`,
              cachedResult,
              'cultural-cuisine',
              true, // cached
              userId,
              0 // no execution time for cache hit
            );
          } catch (logError) {
            console.error('Failed to log cached search:', logError);
          }
          
          return cachedResult;
        } else {
          console.log(`⏰ Global cache expired for ${normalizedCuisine}, age: ${ageHours.toFixed(1)}h`);
          // Remove expired entries
          await db
            .delete(culturalCuisineCache)
            .where(eq(culturalCuisineCache.id, cachedEntry.id));
        }
      }
    }
    
    console.log(`🔍 Global cache miss for ${normalizedCuisine}, fetching fresh data`);
    console.log(`🔍 Cache miss details - forceRefresh: ${options.forceRefresh}, normalized: "${normalizedCuisine}"`);
    cache_metrics.misses++;
    
    // Fetch fresh data with retry logic
    const freshData = await fetchCulturalDataFromPerplexityWithRetry(cultureTag);
    
    if (freshData) {
      // Store in global database cache using upsert (ON CONFLICT DO UPDATE)
      try {
        await db
          .insert(culturalCuisineCache)
          .values({
            cuisine_name: normalizedCuisine,
            meals_data: freshData.meals as any,
            summary_data: freshData.summary as any,
            data_version: freshData.data_version,
            quality_score: freshData.source_quality_score || 0,
            access_count: 1
          })
          .onConflictDoUpdate({
            target: culturalCuisineCache.cuisine_name,
            set: {
              meals_data: freshData.meals as any,
              summary_data: freshData.summary as any,
              data_version: freshData.data_version,
              quality_score: freshData.source_quality_score || 0,
              updated_at: new Date(),
              access_count: 1
            }
          });
        
        console.log(`✅ Successfully cached fresh data globally for ${normalizedCuisine}`);
        updateCacheMetrics();
        return freshData;
      } catch (error) {
        console.error(`❌ Error caching data for ${normalizedCuisine}:`, error);
        return freshData; // Still return the data even if caching fails
      }
    } else {
      cache_metrics.errors++;
      console.log(`❌ Failed to fetch data for ${normalizedCuisine}`);
    }
    
    return freshData;
    
  } catch (error) {
    cache_metrics.errors++;
    console.error(`❌ Error in getCulturalCuisineData for ${normalizedCuisine}:`, error);
    return null;
  }
}

// Helper functions for global database caching system
function storeCacheEntry(userId: number, cultureTag: string, data: CulturalCuisineData): void {
  // This function is now deprecated - database storage is handled in getCulturalCuisineData
  console.log('⚠️  storeCacheEntry is deprecated - using global database cache');
}

function invalidateCacheEntry(userId: string | number, cultureTag: string): void {
  if (culture_dish_cache[userId]?.[cultureTag]) {
    delete culture_dish_cache[userId][cultureTag];
    
    // Clean up empty user objects
    if (Object.keys(culture_dish_cache[userId]).length === 0) {
      delete culture_dish_cache[userId];
    }
    
    updateCacheMetrics();
  }
}

function updateCacheMetrics(): void {
  cache_metrics.total_entries = Object.values(culture_dish_cache)
    .reduce((sum, userCache) => sum + Object.keys(userCache).length, 0);
  
  cache_metrics.memory_usage_bytes = JSON.stringify(culture_dish_cache).length;
}

function isRateLimited(): boolean {
  const now = Date.now();
  const oneMinuteAgo = now - 60000;
  
  // Remove timestamps older than 1 minute
  const recentCalls = api_call_timestamps.filter(timestamp => timestamp > oneMinuteAgo);
  api_call_timestamps.length = 0;
  api_call_timestamps.push(...recentCalls);
  
  return recentCalls.length >= MAX_CALLS_PER_MINUTE;
}

async function fetchCulturalDataFromPerplexityWithRetry(cultureTag: string): Promise<CulturalCuisineData | null> {
  for (let attempt = 1; attempt <= CACHE_CONFIG.MAX_RETRIES; attempt++) {
    try {
      // Check rate limiting
      if (isRateLimited()) {
        console.log(`Rate limited, waiting before retry attempt ${attempt}`);
        await new Promise(resolve => setTimeout(resolve, CACHE_CONFIG.RETRY_DELAY_MS * attempt));
        continue;
      }
      
      const result = await fetchCulturalDataFromPerplexity(cultureTag);
      if (result) {
        console.log(`✅ Successfully fetched ${cultureTag} data on attempt ${attempt}`);
        return result;
      }
      
    } catch (error) {
      console.error(`❌ Attempt ${attempt} failed for ${cultureTag}:`, error);
      
      if (attempt < CACHE_CONFIG.MAX_RETRIES) {
        const delay = CACHE_CONFIG.RETRY_DELAY_MS * Math.pow(2, attempt - 1); // Exponential backoff
        console.log(`⏳ Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  console.error(`💥 All ${CACHE_CONFIG.MAX_RETRIES} attempts failed for ${cultureTag}`);
  return null;
}

async function fetchCulturalDataFromPerplexity(cultureTag: string): Promise<CulturalCuisineData | null> {
  const startTime = Date.now();
  try {
    console.log(`🔍 Fetching cultural data for: ${cultureTag}`);
    
    // Record API call timestamp for rate limiting
    api_call_timestamps.push(Date.now());
    
    const prompt = `Give me a JSON list of the 10 most culturally authentic and popular meals from ${cultureTag} cuisine. For each meal, include:

A brief description of the dish and its cultural significance or popularity.
The most common cooking techniques used.
The top healthy ingredients naturally present in the dish.
Healthy alternatives or modifications (ingredient swaps, cooking method tweaks, or ways to make the dish healthier while keeping it authentic).

Focus on dishes that are beloved and widely eaten in the culture, not just the healthiest. The goal is to keep the meal recognizable and authentic, but with a healthier twist. Do not include nutrient info or macro estimates.

At the end, summarize the most common healthy ingredients and cooking techniques found across all 10 dishes.

Please respond with a JSON object in this exact format:
{
  "culture": "${cultureTag}",
  "meals": [
    {
      "name": "Authentic Dish Name",
      "description": "Brief description and cultural significance",
      "cooking_techniques": ["technique 1", "technique 2"],
      "healthy_ingredients": ["naturally healthy ingredients in this dish"],
      "healthy_modifications": ["authentic healthy swaps", "cooking tweaks that preserve authenticity"]
    }
  ],
  "summary": {
    "common_healthy_ingredients": ["most frequent healthy ingredients across all dishes"],
    "common_cooking_techniques": ["most frequent cooking methods across all dishes"]
  }
}`;

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: 'You are a cultural cuisine expert with deep knowledge of traditional healthy foods from around the world. Provide accurate, authentic information about cultural cuisines in valid JSON format only. Always provide exactly 10 meals per cuisine as requested.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 3000,
        temperature: 0.2,
        top_p: 0.9,
        return_images: false,
        return_related_questions: false,
        search_recency_filter: 'month',
        stream: false
      })
    });

    if (!response.ok) {
      console.error(`🚨 Perplexity API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    const responseContent = data.choices[0].message.content;
    
    console.log(`📝 Raw Perplexity response for ${cultureTag}:`, responseContent.substring(0, 200) + '...');
    
    try {
      // Clean the response - remove any markdown formatting
      const cleanedContent = responseContent.replace(/```json\n?|\n?```/g, '').trim();
      const parsedData = JSON.parse(cleanedContent);
      
      // Enhanced data validation - TEMPORARILY DISABLED while testing new structure
      // const validationResult = validateCulturalCuisineData(parsedData, cultureTag);
      // if (!validationResult.isValid) {
      //   throw new Error(`Data validation failed: ${validationResult.errors.join(', ')}`);
      // }

      // Calculate quality score based on data completeness
      const qualityScore = calculateDataQualityScore(parsedData);

      const cultureData: CulturalCuisineData = {
        ...parsedData,
        cached_at: new Date(),
        last_accessed: new Date(),
        access_count: 0,
        data_version: CACHE_CONFIG.DATA_VERSION,
        source_quality_score: qualityScore
      };
      
      console.log(`✅ Successfully fetched data for ${cultureTag}:`, {
        meals: cultureData.meals.length,
        common_ingredients: cultureData.summary?.common_healthy_ingredients?.length || 0,
        common_techniques: cultureData.summary?.common_cooking_techniques?.length || 0,
        quality_score: qualityScore
      });
      
      // Log the Perplexity search for cache viewing
      try {
        const { logPerplexitySearch } = await import('./perplexitySearchLogger');
        const executionTime = Date.now() - startTime;
        await logPerplexitySearch(
          `Cultural cuisine research: ${cultureTag}`,
          cultureData,
          'cultural-cuisine',
          false, // not cached since we just fetched it
          0, // temporary userId
          executionTime
        );
      } catch (logError) {
        console.error('Failed to log Perplexity search:', logError);
      }
      
      return cultureData;
    } catch (parseError) {
      console.error(`🚨 Error parsing Perplexity response for ${cultureTag}:`, parseError);
      console.error('Raw response:', responseContent);
      return null;
    }
  } catch (error) {
    console.error(`🚨 Error fetching from Perplexity for ${cultureTag}:`, error);
    return null;
  }
}

// Enhanced validation functions
function validateCulturalCuisineData(data: any, cultureTag: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Basic structure validation
  if (!data || typeof data !== 'object') {
    errors.push('Invalid data structure - not an object');
    return { isValid: false, errors };
  }
  
  // Validate meals array
  if (!data.meals || !Array.isArray(data.meals)) {
    errors.push('Missing or invalid meals array');
  } else {
    if (data.meals.length === 0) {
      errors.push('Meals array is empty');
    } else {
      // Validate each meal
      data.meals.forEach((meal: any, index: number) => {
        if (!meal.name || typeof meal.name !== 'string') {
          errors.push(`Meal ${index + 1}: missing or invalid name`);
        }
        if (!meal.description || typeof meal.description !== 'string') {
          errors.push(`Meal ${index + 1}: missing or invalid description`);
        }
        if (!meal.macros || typeof meal.macros !== 'object') {
          errors.push(`Meal ${index + 1}: missing or invalid macros`);
        } else {
          const requiredMacros = ['calories', 'protein_g', 'carbs_g', 'fat_g'];
          requiredMacros.forEach(macro => {
            if (typeof meal.macros[macro] !== 'number' || meal.macros[macro] < 0) {
              errors.push(`Meal ${index + 1}: invalid ${macro} value`);
            }
          });
        }
        if (meal.healthy_mods && !Array.isArray(meal.healthy_mods)) {
          errors.push(`Meal ${index + 1}: healthy_mods must be an array`);
        }
      });
    }
  }
  
  // Validate other required fields
  const requiredArrayFields = ['styles', 'key_ingredients', 'cooking_techniques', 'health_benefits'];
  requiredArrayFields.forEach(field => {
    if (!data[field] || !Array.isArray(data[field])) {
      errors.push(`Missing or invalid ${field} array`);
    }
  });
  
  // Validate culture match
  if (data.culture && data.culture.toLowerCase() !== cultureTag.toLowerCase()) {
    errors.push(`Culture mismatch: expected ${cultureTag}, got ${data.culture}`);
  }
  
  return { isValid: errors.length === 0, errors };
}

function calculateDataQualityScore(data: any): number {
  let score = 0;
  let maxScore = 100;
  
  // Meals quality (40 points)
  if (data.meals && Array.isArray(data.meals)) {
    score += Math.min(data.meals.length * 8, 40); // Max 40 points for 5+ meals
    
    // Bonus for meal detail completeness
    const detailBonus = data.meals.reduce((bonus: number, meal: any) => {
      let mealScore = 0;
      if (meal.description && meal.description.length > 20) mealScore += 2;
      if (meal.healthy_mods && meal.healthy_mods.length > 0) mealScore += 2;
      if (meal.macros && Object.keys(meal.macros).length >= 4) mealScore += 2;
      return bonus + Math.min(mealScore, 6);
    }, 0);
    score += Math.min(detailBonus, 20);
  }
  
  // Array completeness (40 points - 10 each)
  const arrayFields = ['styles', 'key_ingredients', 'cooking_techniques', 'health_benefits'];
  arrayFields.forEach(field => {
    if (data[field] && Array.isArray(data[field]) && data[field].length > 0) {
      score += Math.min(data[field].length * 2, 10);
    }
  });
  
  return Math.round(Math.min(score, maxScore));
}

// Enhanced batch processing
export async function batchFetchCulturalCuisines(userId: number, cultures: string[]): Promise<BatchFetchResult> {
  const result: BatchFetchResult = {
    success: {},
    failed: [],
    errors: {}
  };
  
  console.log(`🔄 Batch fetching ${cultures.length} cultures for user ${userId}`);
  
  // Process in batches to respect rate limits
  const batches = [];
  for (let i = 0; i < cultures.length; i += CACHE_CONFIG.BATCH_SIZE) {
    batches.push(cultures.slice(i, i + CACHE_CONFIG.BATCH_SIZE));
  }
  
  for (const batch of batches) {
    const batchPromises = batch.map(async (culture) => {
      try {
        const data = await getCulturalCuisineData(userId, culture);
        if (data) {
          result.success[culture] = data;
          console.log(`✅ Batch success: ${culture}`);
        } else {
          result.failed.push(culture);
          result.errors[culture] = 'Failed to fetch data';
          console.log(`❌ Batch failed: ${culture}`);
        }
      } catch (error) {
        result.failed.push(culture);
        result.errors[culture] = error instanceof Error ? error.message : 'Unknown error';
        console.error(`💥 Batch error for ${culture}:`, error);
      }
    });
    
    await Promise.all(batchPromises);
    
    // Add delay between batches to respect rate limits
    if (batch !== batches[batches.length - 1]) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log(`📊 Batch complete: ${Object.keys(result.success).length} success, ${result.failed.length} failed`);
  return result;
}

// Cache maintenance functions
export function performCacheCleanup(): void {
  const now = new Date().getTime();
  let removedCount = 0;
  
  Object.keys(culture_dish_cache).forEach(userId => {
    const userCache = culture_dish_cache[userId];
    
    Object.keys(userCache).forEach(cultureTag => {
      const data = userCache[cultureTag];
      const age = now - data.cached_at.getTime();
      const maxAge = CACHE_CONFIG.DEFAULT_TTL_HOURS * 60 * 60 * 1000;
      
      // Remove expired entries
      if (age > maxAge) {
        delete userCache[cultureTag];
        removedCount++;
      }
    });
    
    // Remove empty user caches
    if (Object.keys(userCache).length === 0) {
      delete culture_dish_cache[userId];
    }
  });
  
  cache_metrics.last_cleanup = new Date();
  updateCacheMetrics();
  
  console.log(`🧹 Cache cleanup complete: removed ${removedCount} expired entries`);
}

export function getCachedCuisines(userId: string | number): string[] {
  return Object.keys(culture_dish_cache[userId] || {});
}

export async function getCachedCulturalCuisine(userId: string | number, culturalBackground: string[], options: { useBatch?: boolean, forceRefresh?: boolean } = {}): Promise<{ [key: string]: CulturalCuisineData } | null> {
  console.log(`🔍 Loading cultural cuisine data for user ${userId}, cultures: ${culturalBackground.join(', ')}`);
  
  if (!culturalBackground || culturalBackground.length === 0) {
    console.log('No cultural background provided');
    return null;
  }

  // Use batch processing for multiple cultures if enabled
  if (options.useBatch && culturalBackground.length > 1) {
    console.log(`🔄 Using batch processing for ${culturalBackground.length} cultures`);
    const batchResult = await batchFetchCulturalCuisines(userId, culturalBackground);
    
    if (Object.keys(batchResult.success).length > 0) {
      return batchResult.success;
    } else {
      console.log('❌ Batch processing failed for all cultures');
      return null;
    }
  }

  // Sequential processing (original behavior)
  const culturalCuisineData: { [key: string]: CulturalCuisineData } = {};
  
  for (const culture of culturalBackground) {
    console.log(`Loading data for culture: ${culture}`);
    const cultureData = await getCulturalCuisineData(userId, culture, options);
    if (cultureData) {
      culturalCuisineData[culture] = cultureData;
      console.log(`✅ Successfully loaded ${culture} cuisine data`);
    } else {
      console.log(`❌ Failed to load ${culture} cuisine data`);
    }
  }
  
  const loadedCultures = Object.keys(culturalCuisineData);
  console.log(`📊 Cultural cuisine data loaded for: ${loadedCultures.join(', ')}`);
  
  return loadedCultures.length > 0 ? culturalCuisineData : null;
}

// Clear user cache when cultural preferences change
export function clearUserCache(userId: string | number): boolean {
  if (culture_dish_cache[userId]) {
    delete culture_dish_cache[userId];
    updateCacheMetrics();
    console.log(`🗑️ Cleared cultural cache for user ${userId}`);
    return true;
  }
  return false;
}

// Clear ALL cache data (for fixing old research data)
export function clearAllCache(): void {
  Object.keys(culture_dish_cache).forEach(userId => {
    delete culture_dish_cache[userId];
  });
  
  // Reset metrics
  cache_metrics.hits = 0;
  cache_metrics.misses = 0;
  cache_metrics.errors = 0;
  cache_metrics.last_cleanup = new Date();
  cache_metrics.total_entries = 0;
  cache_metrics.memory_usage_bytes = 0;
  
  console.log(`🗑️ CLEARED ALL CULTURAL CACHE DATA - Starting fresh!`);
}

// Force refresh cultural data for specific user and cultures
export async function refreshUserCulturalData(userId: number, cultures: string[]): Promise<void> {
  console.log(`🔄 Force refreshing cultural data for user ${userId}, cultures: ${cultures.join(', ')}`);
  
  // Clear existing cache for these cultures
  if (culture_dish_cache[userId]) {
    cultures.forEach(culture => {
      if (culture_dish_cache[userId][culture]) {
        delete culture_dish_cache[userId][culture];
      }
    });
  }
  
  // Fetch fresh data
  await getCachedCulturalCuisine(userId, cultures, { forceRefresh: true });
}

export function getCacheStats(): { 
  totalUsers: number; 
  totalCuisines: number; 
  cacheSize: string;
  hitRate: number;
  metrics: CacheMetrics;
  topCultures: Array<{ culture: string; accessCount: number }>;
  memoryUsageMB: number;
} {
  updateCacheMetrics();
  
  const totalUsers = Object.keys(culture_dish_cache).length;
  const totalCuisines = Object.values(culture_dish_cache).reduce((sum, userCache) => 
    sum + Object.keys(userCache).length, 0
  );
  
  // Calculate hit rate
  const totalRequests = cache_metrics.hits + cache_metrics.misses;
  const hitRate = totalRequests > 0 ? (cache_metrics.hits / totalRequests) * 100 : 0;
  
  // Find most accessed cultures
  const cultureAccessCounts: { [culture: string]: number } = {};
  Object.values(culture_dish_cache).forEach(userCache => {
    Object.entries(userCache).forEach(([culture, data]: [string, any]) => {
      cultureAccessCounts[culture] = (cultureAccessCounts[culture] || 0) + (data.access_count || 0);
    });
  });
  
  const topCultures = Object.entries(cultureAccessCounts)
    .map(([culture, accessCount]) => ({ culture, accessCount }))
    .sort((a, b) => b.accessCount - a.accessCount)
    .slice(0, 10);
  
  const memoryUsageMB = cache_metrics.memory_usage_bytes / (1024 * 1024);
  
  return {
    totalUsers,
    totalCuisines,
    cacheSize: `${Math.round(cache_metrics.memory_usage_bytes / 1024)} KB`,
    hitRate: Math.round(hitRate * 100) / 100,
    metrics: { ...cache_metrics },
    topCultures,
    memoryUsageMB: Math.round(memoryUsageMB * 100) / 100
  };
}

// Additional utility functions for monitoring
export function startCacheMaintenanceScheduler(): void {
  const maintenanceInterval = CACHE_CONFIG.CLEANUP_INTERVAL_HOURS * 60 * 60 * 1000;
  
  setInterval(() => {
    console.log('🔧 Starting scheduled cache maintenance...');
    performCacheCleanup();
    
    const stats = getCacheStats();
    console.log('📊 Cache stats after cleanup:', {
      users: stats.totalUsers,
      cuisines: stats.totalCuisines,
      hitRate: `${stats.hitRate}%`,
      memoryUsage: `${stats.memoryUsageMB}MB`
    });
    
    // Alert if memory usage is high
    if (stats.memoryUsageMB > CACHE_CONFIG.MAX_CACHE_SIZE_MB) {
      console.warn(`⚠️ High memory usage: ${stats.memoryUsageMB}MB (limit: ${CACHE_CONFIG.MAX_CACHE_SIZE_MB}MB)`);
    }
  }, maintenanceInterval);
  
  console.log(`✅ Cache maintenance scheduler started (interval: ${CACHE_CONFIG.CLEANUP_INTERVAL_HOURS}h)`);
}