import { queryClient } from "./queryClient";

// Session cache key for temporarily auto-saved plans
export const SESSION_CACHE_KEY = ['/api/meal-plans/session-cache'];
export const SAVED_CACHE_KEY = ['/api/meal-plans/saved'];

// Interface for session cached meal plans
export interface SessionCachedPlan {
  id: string; // Temporary ID for session cache
  name: string;
  description: string;
  mealPlan: any;
  isAutoSaved: true;
  isSessionCache: true;
  createdAt: string;
  updatedAt: string;
}

// Get current session cache data
export function getSessionCache(): SessionCachedPlan[] {
  const cached = queryClient.getQueryData(SESSION_CACHE_KEY);
  return cached as SessionCachedPlan[] || [];
}

// Add a plan to session cache
export function addToSessionCache(plan: Omit<SessionCachedPlan, 'id' | 'isAutoSaved' | 'isSessionCache' | 'createdAt' | 'updatedAt'>): SessionCachedPlan {
  const sessionPlan: SessionCachedPlan = {
    ...plan,
    id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Unique session ID
    isAutoSaved: true,
    isSessionCache: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const currentCache = getSessionCache();
  const updatedCache = [sessionPlan, ...currentCache]; // Add to beginning

  // Keep only last 10 session items to prevent memory bloat
  const trimmedCache = updatedCache.slice(0, 10);

  queryClient.setQueryData(SESSION_CACHE_KEY, trimmedCache);
  
  console.log('📦 Session Cache: Added plan:', sessionPlan.name);
  console.log('📦 Session Cache: Total items:', trimmedCache.length);
  
  return sessionPlan;
}

// Remove a plan from session cache
export function removeFromSessionCache(sessionId: string): void {
  const currentCache = getSessionCache();
  const updatedCache = currentCache.filter(plan => plan.id !== sessionId);
  
  queryClient.setQueryData(SESSION_CACHE_KEY, updatedCache);
  console.log('🗑️ Session Cache: Removed plan:', sessionId);
}

// Clear all session cache
export function clearSessionCache(): void {
  queryClient.setQueryData(SESSION_CACHE_KEY, []);
  console.log('🧹 Session Cache: Cleared all items');
}

// Promote a session plan to permanent saved plan
export async function promoteSessionPlan(sessionId: string): Promise<boolean> {
  const sessionCache = getSessionCache();
  const planToPromote = sessionCache.find(plan => plan.id === sessionId);
  
  if (!planToPromote) {
    console.error('❌ Session Cache: Plan not found for promotion:', sessionId);
    return false;
  }

  try {
    console.log('🚀 Session Cache: Promoting plan to permanent:', planToPromote.name);
    
    // Save to database as permanent plan
    const token = localStorage.getItem('auth_token');
    const response = await fetch('/api/meal-plans', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        name: planToPromote.name,
        description: planToPromote.description,
        meal_plan: planToPromote.mealPlan,
        is_auto_saved: false, // Mark as manually saved
        is_session_cache: false // Mark as permanent
      })
    });

    if (!response.ok) {
      throw new Error('Failed to promote session plan');
    }

    const savedPlan = await response.json();
    console.log('✅ Session Cache: Plan promoted successfully:', savedPlan);

    // Remove from session cache
    removeFromSessionCache(sessionId);
    
    // Invalidate saved plans cache to refresh UI
    queryClient.invalidateQueries({ queryKey: SAVED_CACHE_KEY });
    
    return true;
  } catch (error) {
    console.error('❌ Session Cache: Failed to promote plan:', error);
    return false;
  }
}

// Initialize session cache (call on app startup)
export function initializeSessionCache(): void {
  // Set up empty cache if it doesn't exist
  if (!queryClient.getQueryData(SESSION_CACHE_KEY)) {
    queryClient.setQueryData(SESSION_CACHE_KEY, []);
    console.log('🔧 Session Cache: Initialized empty cache');
  }
}