
# NutriMa Frontend Documentation

## Overview

The NutriMa frontend is a React 18.3.1 application built with TypeScript, using Vite as the build tool. It provides an intuitive interface for AI-powered meal planning, recipe generation, and shopping list creation.

## Architecture

### Tech Stack
- **Framework**: React 18.3.1 with TypeScript
- **Build Tool**: Vite 5.4.14
- **Routing**: Wouter 3.3.5 (lightweight alternative to React Router)
- **State Management**: TanStack React Query 5.60.5 for server state
- **UI Components**: Radix UI primitives with custom styling
- **Styling**: Tailwind CSS 3.4.17 with custom animations
- **Forms**: React Hook Form 7.55.0 with Zod validation
- **Icons**: Lucide React + React Icons

## Directory Structure

```
client/src/
├── components/           # Reusable UI components
│   ├── ui/              # Base UI components (Radix UI + Tailwind)
│   └── [feature].tsx    # Feature-specific components
├── pages/               # Route pages
├── hooks/               # Custom React hooks  
├── lib/                 # Utilities and API clients
├── data/                # Static data files
└── utils/               # Helper functions
```

## Key Components

### Core UI Components (`components/`)
- **AIPoweredMealPlanGenerator.tsx**: Main meal plan generation interface
- **StreamingMealPlanGenerator.tsx**: Real-time streaming meal plan updates
- **RecipeCard.tsx**: Recipe display with nutrition info
- **RecipeDisplay.tsx**: Detailed recipe view with ingredients/instructions
- **CulturalCuisineDropdown.tsx**: Multi-select cuisine preferences
- **WeightBasedProfile.tsx**: Profile management for weight-based planning

### Page Components (`pages/`)
- **Home.tsx**: Landing page with hero, features, testimonials
- **MealPlanner.tsx**: Main meal planning interface
- **EditableMealPlanner.tsx**: Drag-and-drop meal plan editor
- **Profile.tsx**: User profile and preferences management
- **MyRecipes.tsx**: Saved recipes management
- **Search.tsx**: Recipe search and discovery

### Authentication Components
- **AuthForm.tsx**: Login/signup forms with validation
- **Header.tsx**: Navigation with auth state management

## State Management

### React Query Setup (`lib/queryClient.ts`)
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
});
```

### Key Hooks

#### Authentication (`hooks/useAuth.ts`)
- Manages user authentication state
- Handles login/logout flows
- Provides user profile data
- Token refresh logic

#### Cultural Cache (`hooks/useCulturalCache.ts`)
- Caches cultural preference lookups
- Reduces API calls for cuisine data

#### Profile System (`hooks/useProfileSystem.ts`)
- Manages profile type (individual/family)
- Handles profile switching

## API Integration (`lib/api.ts`)

### Core API Functions
```typescript
// Meal Planning
generateMealPlan(params): Promise<MealPlan>
saveMealPlan(plan): Promise<SavedMealPlan>
getMealPlans(): Promise<MealPlan[]>

// Recipes
generateRecipes(params): Promise<Recipe[]>
searchRecipes(query): Promise<Recipe[]>
saveRecipe(recipe): Promise<SavedRecipe>

// Shopping
createShoppingList(mealPlan): Promise<ShoppingList>

// User Management
updateProfile(profile): Promise<User>
updatePreferences(prefs): Promise<Preferences>
```

### Error Handling
- Consistent error format with user-friendly messages
- Toast notifications for errors/success
- Fallback UI for loading states

## UI Component Library (`components/ui/`)

All UI components follow a consistent pattern:
- Built on Radix UI primitives
- Styled with Tailwind CSS + CVA (class-variance-authority)
- Accessible by default
- Support dark/light themes

### Common Components
- **Button**: Primary, secondary, outline, ghost variants
- **Card**: Container with header/content/footer slots
- **Dialog/Sheet**: Modal and drawer patterns
- **Form**: Integrated with React Hook Form
- **Select/Dropdown**: Accessible select menus
- **Toast**: Notification system

## Routing Structure

```typescript
// Main routes (in App.tsx)
<Route path="/" component={Home} />
<Route path="/meal-planner" component={MealPlanner} />
<Route path="/meal-plan/:id" component={EditableMealPlanner} />
<Route path="/profile" component={Profile} />
<Route path="/my-recipes" component={MyRecipes} />
<Route path="/search" component={Search} />
<Route path="/checkout" component={Checkout} />
```

## Key Features Implementation

### Meal Plan Generation
1. User selects date range and preferences
2. `AIPoweredMealPlanGenerator` builds request
3. Streaming response handled by `StreamingMealPlanGenerator`
4. Results displayed in grid with `RecipeCard` components
5. User can edit/save plan

### Cultural Integration
- 50+ cuisines in `cultural_cuisine_masterlist.json`
- Smart parsing of user input to cuisine codes
- Validation against dietary restrictions
- Authentic dish name mapping

### Shopping List Creation
1. Aggregates ingredients from meal plan
2. Deduplicates and combines quantities
3. Sends to Instacart API
4. Returns optimized shopping list

## Performance Optimizations

### Code Splitting
- Route-based splitting with React.lazy
- Component lazy loading for heavy features

### Caching Strategy
- React Query for server state caching
- Session storage for temporary data
- Local storage for user preferences

### Image Optimization
- Lazy loading for recipe images
- Responsive image sizing
- Placeholder shimmer effects

## Development Patterns

### Component Structure
```typescript
// Standard component pattern
export function ComponentName({ prop1, prop2 }: Props) {
  // Hooks
  const { data, isLoading } = useQuery(...);
  
  // Event handlers
  const handleClick = () => {};
  
  // Render
  if (isLoading) return <Skeleton />;
  
  return (
    <div className="...">
      {/* Component content */}
    </div>
  );
}
```

### Form Handling
- React Hook Form for all forms
- Zod schemas for validation
- Error display with form state

### API Error Handling
```typescript
try {
  const result = await api.someMethod();
  // Handle success
} catch (error) {
  toast.error(getErrorMessage(error));
}
```

## Testing Approach

### Component Testing
- Test user interactions
- Mock API responses
- Verify error states
- Check accessibility

### Integration Testing
- Full user flows
- API integration
- State management

## Common Tasks

### Adding a New Page
1. Create component in `pages/`
2. Add route in `App.tsx`
3. Add navigation in `Header.tsx`
4. Create API functions if needed

### Adding a New Component
1. Create in appropriate directory
2. Add TypeScript types
3. Style with Tailwind classes
4. Export from index if needed

### Modifying API Integration
1. Update types in `shared/schema.ts`
2. Modify API functions in `lib/api.ts`
3. Update React Query hooks
4. Handle errors appropriately

## Debugging Tips

### Development Tools
- React DevTools for component inspection
- Network tab for API debugging
- Console for error tracking
- React Query DevTools for cache inspection

### Common Issues
- **CORS errors**: Check API endpoint configuration
- **Auth failures**: Verify JWT token handling
- **Styling issues**: Check Tailwind class conflicts
- **State bugs**: Use React Query DevTools

## Environment Variables

Required in `.env`:
```
VITE_API_URL=http://localhost:5000
```

Production builds use environment-specific configs.