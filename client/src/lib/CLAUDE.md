# NutriMa Library Documentation

## Overview

The `lib/` directory contains utility functions, API clients, and service modules that power the NutriMa frontend. These modules handle API communication, business logic, caching, and third-party integrations.

## Core Modules

### **api.ts**
Central API client for all backend communication:

```typescript
// Main API instance configuration
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
  withCredentials: true,
});

// Request/Response interceptors for auth
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

Key Functions:
- `generateMealPlan()` - AI meal plan generation
- `saveMealPlan()` - Persist meal plans
- `getMealPlans()` - Retrieve saved plans
- `generateRecipes()` - Individual recipe generation
- `createShoppingList()` - Instacart list creation
- `updateProfile()` - User profile management

Error Handling:
```typescript
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.error || 'An error occurred';
  }
  return 'An unexpected error occurred';
}
```

### **authUtils.ts**
Authentication utility functions:

```typescript
// Token management
export const setAuthToken = (token: string) => {
  localStorage.setItem('token', token);
};

export const getAuthToken = () => {
  return localStorage.getItem('token');
};

export const clearAuthToken = () => {
  localStorage.removeItem('token');
};

// User session
export const isAuthenticated = () => {
  const token = getAuthToken();
  return !!token && !isTokenExpired(token);
};
```

### **queryClient.ts**
React Query configuration:

```typescript
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      retry: (failureCount, error) => {
        if (error?.response?.status === 401) return false;
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
    },
  },
});
```

## Service Modules

### **grokApi.ts**
Grok AI integration for recipe generation:

```typescript
export async function generateWithGrok(params: {
  prompt: string;
  model?: string;
  temperature?: number;
}) {
  // Grok-specific API call
  // Handles streaming responses
  // Returns parsed recipes
}
```

### **instacart.ts**
Instacart shopping list integration:

```typescript
export interface ShoppingListItem {
  name: string;
  quantity: string;
  category: string;
  estimatedPrice?: number;
}

export async function createInstacartList(
  items: ShoppingListItem[]
): Promise<InstacartResponse> {
  // Format items for Instacart
  // Handle item matching
  // Return shopping list URL
}
```

### **youtubeUtils.ts**
YouTube recipe extraction utilities:

```typescript
export async function extractRecipeFromVideo(
  videoUrl: string
): Promise<ExtractedRecipe> {
  // Extract video ID
  // Fetch video data
  // Parse description for recipe
  // Use AI fallback if needed
}

export function getYouTubeThumbnail(
  videoId: string,
  quality: 'default' | 'high' = 'high'
): string {
  // Returns thumbnail URL
}
```

### **recipeScraper.ts**
Web recipe scraping utilities:

```typescript
export async function scrapeRecipe(url: string): Promise<Recipe> {
  // Detect recipe format
  // Extract structured data
  // Parse ingredients/instructions
  // Normalize to app format
}
```

## Utility Functions

### **utils.ts**
General utility functions:

```typescript
// Class name helper (uses clsx + tailwind-merge)
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Date formatting
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

// Number formatting
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}
```

### **mealPlanUtils.ts**
Meal plan manipulation utilities:

```typescript
// Aggregate ingredients across recipes
export function aggregateIngredients(
  recipes: Recipe[]
): AggregatedIngredient[] {
  // Combine same ingredients
  // Convert units
  // Sort by category
}

// Calculate total nutrition
export function calculateMealPlanNutrition(
  mealPlan: MealPlan
): NutritionSummary {
  // Sum nutrition across meals
  // Calculate daily averages
  // Check against goals
}

// Reorder meals (drag-drop support)
export function reorderMeals(
  meals: Meal[],
  sourceIndex: number,
  destIndex: number
): Meal[] {
  // Handle reordering logic
  // Maintain meal IDs
  // Update positions
}
```

### **difficultyEstimator.ts**
Recipe difficulty calculation:

```typescript
export function estimateDifficulty(recipe: Recipe): {
  score: number; // 1-5
  factors: string[];
} {
  // Analyze ingredients
  // Count techniques
  // Evaluate time
  // Check equipment needs
}
```

## Caching & Performance

### **sessionCache.ts**
Browser session storage utilities:

```typescript
export const sessionCache = {
  set: (key: string, value: any, ttl?: number) => {
    const item = {
      value,
      expires: ttl ? Date.now() + ttl : null,
    };
    sessionStorage.setItem(key, JSON.stringify(item));
  },
  
  get: (key: string) => {
    const item = sessionStorage.getItem(key);
    if (!item) return null;
    
    const parsed = JSON.parse(item);
    if (parsed.expires && Date.now() > parsed.expires) {
      sessionStorage.removeItem(key);
      return null;
    }
    
    return parsed.value;
  },
  
  clear: (pattern?: string) => {
    // Clear matching keys
  },
};
```

### **achievementService.ts**
Achievement system logic:

```typescript
export class AchievementService {
  // Track user milestones
  checkMealPlanAchievements(count: number): Achievement[] {
    // First meal plan
    // 10 meal plans
    // 30-day streak
    // etc.
  }
  
  checkRecipeAchievements(recipes: Recipe[]): Achievement[] {
    // Recipe diversity
    // Cooking complexity
    // Cultural exploration
  }
  
  unlockAchievement(userId: string, achievementId: string): void {
    // Mark as unlocked
    // Trigger notification
    // Update storage
  }
}
```

## Integration Patterns

### API Error Handling
```typescript
try {
  const result = await api.someMethod();
  return result;
} catch (error) {
  // Log error
  console.error('API Error:', error);
  
  // Show user message
  toast.error(getErrorMessage(error));
  
  // Rethrow for React Query
  throw error;
}
```

### Optimistic Updates
```typescript
const mutation = useMutation({
  mutationFn: updateMealPlan,
  onMutate: async (newData) => {
    // Cancel queries
    await queryClient.cancelQueries(['mealPlan', id]);
    
    // Save snapshot
    const previous = queryClient.getQueryData(['mealPlan', id]);
    
    // Optimistic update
    queryClient.setQueryData(['mealPlan', id], newData);
    
    return { previous };
  },
  onError: (err, newData, context) => {
    // Rollback
    queryClient.setQueryData(['mealPlan', id], context.previous);
  },
});
```

### Streaming Responses
```typescript
export async function* streamMealPlan(params: MealPlanParams) {
  const response = await fetch('/api/stream-meal-plan', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        yield JSON.parse(line.slice(6));
      }
    }
  }
}
```

## Testing

### Mocking API Calls
```typescript
// Mock API responses for testing
export const mockApi = {
  generateMealPlan: jest.fn().mockResolvedValue(mockMealPlan),
  saveMealPlan: jest.fn().mockResolvedValue({ id: '123' }),
  // ... other mocks
};
```

### Testing Utilities
```typescript
// Test data factories
export const createMockRecipe = (overrides = {}): Recipe => ({
  id: 'test-123',
  title: 'Test Recipe',
  ingredients: [],
  instructions: [],
  ...overrides,
});
```

## Common Patterns

### Retry Logic
```typescript
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 1000
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}
```

### Debouncing
```typescript
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
```