/**
 * Intelligent meal plan caching system
 * Reduces API costs by caching similar requests
 */

interface CacheKey {
  numDays: number;
  mealsPerDay: number;
  cookTime: number;
  difficulty: number;
  nutritionGoal: string;
  dietaryRestrictions: string;
}

interface CachedMealPlan {
  data: any;
  timestamp: number;
  usageCount: number;
}

class MealPlanCache {
  private cache = new Map<string, CachedMealPlan>();
  private readonly CACHE_DURATION = 2 * 60 * 60 * 1000; // 2 hours - reduced to prevent meal repetition
  private readonly MAX_CACHE_SIZE = 100;

  private generateCacheKey(params: CacheKey): string {
    // Add time-based variation to prevent meal repetition
    const now = new Date();
    const timeVariation = Math.floor(now.getTime() / (60 * 60 * 1000)); // Changes every hour
    
    // Less aggressive normalization to allow more variety
    const normalized = {
      numDays: params.numDays,
      mealsPerDay: params.mealsPerDay,
      cookTime: params.cookTime, // Keep exact time, no rounding
      difficulty: params.difficulty,
      nutritionGoal: params.nutritionGoal.toLowerCase().trim(),
      dietaryRestrictions: params.dietaryRestrictions.toLowerCase().trim(),
      timeSlot: timeVariation // Add time-based variation
    };
    
    return JSON.stringify(normalized);
  }

  private isExpired(timestamp: number): boolean {
    return Date.now() - timestamp > this.CACHE_DURATION;
  }

  private evictOldest(): void {
    if (this.cache.size <= this.MAX_CACHE_SIZE) return;
    
    let oldestKey = '';
    let oldestTime = Date.now();
    
    for (const [key, value] of this.cache.entries()) {
      if (value.timestamp < oldestTime) {
        oldestTime = value.timestamp;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  get(params: CacheKey): any | null {
    const key = this.generateCacheKey(params);
    const cached = this.cache.get(key);
    
    if (!cached || this.isExpired(cached.timestamp)) {
      if (cached) this.cache.delete(key);
      return null;
    }
    
    // Update usage count
    cached.usageCount++;
    return cached.data;
  }

  set(params: CacheKey, data: any): void {
    const key = this.generateCacheKey(params);
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      usageCount: 1
    });
    
    this.evictOldest();
  }

  getStats(): { size: number; hitRate: number } {
    const totalUsage = Array.from(this.cache.values())
      .reduce((sum, item) => sum + item.usageCount, 0);
    
    const uniqueItems = this.cache.size;
    const hitRate = uniqueItems > 0 ? ((totalUsage - uniqueItems) / totalUsage) * 100 : 0;
    
    return { size: uniqueItems, hitRate };
  }
}

export const mealPlanCache = new MealPlanCache();