# NutriMa Components Documentation

## Overview

This directory contains all React components for the NutriMa application. Components are organized by feature area and follow consistent patterns for props, state management, and styling.

## Component Categories

### Meal Planning Components

#### **AIPoweredMealPlanGenerator.tsx**
Main interface for generating meal plans:
- Date range selection with calendar
- Preference configuration (goals, restrictions)
- Streaming response handling
- Error recovery UI

#### **StreamingMealPlanGenerator.tsx**
Handles real-time meal plan generation:
- Server-sent events (SSE) integration
- Progressive UI updates
- Partial result rendering
- Cancellation support

#### **WeightBasedProfile.tsx**
Profile configuration for weight-loss meal planning:
- Weight goal inputs
- Calorie deficit calculations
- Macro distribution settings
- Progress tracking setup

### Recipe Components

#### **RecipeCard.tsx**
Compact recipe display card:
- Recipe image with fallback
- Title, time, difficulty badges
- Nutrition highlights
- Quick actions (save, share, view)

Props:
```typescript
interface RecipeCardProps {
  recipe: Recipe;
  onSave?: () => void;
  onView?: () => void;
  isEditable?: boolean;
}
```

#### **RecipeDisplay.tsx**
Full recipe view with details:
- Ingredients list with quantities
- Step-by-step instructions
- Nutrition facts table
- Serving size adjustment
- Print-friendly layout

#### **RecipeGenerator.tsx**
Individual recipe generation interface:
- Quick filters (cuisine, diet, time)
- AI parameter tuning
- Result preview
- Batch generation support

### Cultural Integration

#### **CulturalCuisineDropdown.tsx**
Multi-select cuisine preference picker:
- 50+ cuisine options
- Search/filter functionality
- Visual cuisine badges
- Dietary conflict warnings

#### **CulturalFreeTextInput.tsx**
Natural language cultural preference input:
- AI-powered parsing
- Suggestion tooltips
- Example prompts
- Validation feedback

#### **SmartCulturalPreferenceEditor.tsx**
Advanced cultural preference management:
- Cuisine ranking
- Dish preferences
- Ingredient exclusions
- Regional variations

### UI Feedback Components

#### **AchievementNotification.tsx**
Gamification achievement popups:
- Achievement badges
- Progress animations
- Sound effects (optional)
- Auto-dismiss timing

#### **AchievementsContainer.tsx**
Achievement system management:
- Milestone tracking
- Badge collection display
- Progress visualization
- Reward unlocking

#### **ProfileSystemIndicator.tsx**
Shows current profile mode:
- Individual vs Family mode
- Member count badge
- Quick switch button
- Sync status

### Utility Components

#### **CookingTimeCalculator.tsx**
Estimates total cooking time:
- Parallel operation detection
- Skill level adjustment
- Equipment considerations
- Time breakdown display

#### **DifficultyRater.tsx**
Visual difficulty rating:
- 1-5 star system
- Tooltip explanations
- Color coding
- Accessibility labels

#### **DynamicMealRanking.tsx**
Meal preference ranking interface:
- Drag-and-drop reordering
- Quick rating buttons
- Preference learning
- History tracking

### Layout Components

#### **Header.tsx**
Main navigation header:
- Responsive menu
- Auth state display
- Profile dropdown
- Theme toggle

#### **Footer.tsx**
Site footer with links:
- Navigation links
- Social media
- Legal pages
- Newsletter signup

#### **LandingPage.tsx**
Homepage sections:
- Hero with CTA
- Feature showcase
- Testimonials
- Pricing cards

### Debug Components (Dev Only)

#### **AuthDebugger.tsx**
Authentication state inspector:
- Token display
- Session info
- Force refresh
- State manipulation

#### **MealPlanDebugger.tsx**
Meal plan data viewer:
- Raw JSON display
- State inspection
- Cache status
- API response logs

#### **QuickAuthDebug.tsx**
Minimal auth status widget:
- Login state
- User ID
- Quick login/logout

## Component Patterns

### Standard Component Structure
```typescript
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

interface ComponentProps {
  // Props definition
}

export function Component({ prop1, prop2 }: ComponentProps) {
  // State
  const [state, setState] = useState();
  
  // Queries/Mutations
  const { data, isLoading } = useQuery({
    queryKey: ['key'],
    queryFn: fetchData,
  });
  
  // Effects
  useEffect(() => {
    // Side effects
  }, []);
  
  // Handlers
  const handleAction = () => {
    // Handle user action
  };
  
  // Early returns
  if (isLoading) return <LoadingSkeleton />;
  if (!data) return <EmptyState />;
  
  // Main render
  return (
    <div className={cn("base-classes", conditionalClass)}>
      {/* Component JSX */}
    </div>
  );
}
```

### Props Conventions
- Use TypeScript interfaces for all props
- Provide sensible defaults
- Document complex props
- Use composition over configuration

### State Management
- Local state for UI-only concerns
- React Query for server state
- Context for cross-component state
- URL state for shareable views

### Error Handling
- Try-catch in event handlers
- Error boundaries for components
- Fallback UI for errors
- User-friendly error messages

### Performance
- Memo expensive computations
- Lazy load heavy components
- Virtualize long lists
- Optimize re-renders

## Styling Guidelines

### Tailwind Classes
- Use semantic color variables
- Consistent spacing scale
- Responsive modifiers
- Dark mode support

### Component Styling
```typescript
// Base classes in arrays for readability
const baseClasses = [
  "rounded-lg",
  "border",
  "p-4",
  "transition-colors"
];

// Conditional classes
const variantClasses = {
  primary: "bg-primary text-primary-foreground",
  secondary: "bg-secondary text-secondary-foreground"
};

// Combine with cn()
className={cn(baseClasses, variantClasses[variant])}
```

### Animation
- Use Framer Motion for complex animations
- CSS transitions for simple effects
- Respect prefers-reduced-motion
- Keep animations subtle

## Testing Approach

### Unit Tests
- Test component logic
- Mock external dependencies
- Verify prop handling
- Check accessibility

### Integration Tests
- Test component interactions
- Verify API integration
- Check error scenarios
- Validate forms

### Visual Tests
- Screenshot comparisons
- Responsive layouts
- Theme variations
- Loading states

## Common Tasks

### Creating a New Component
1. Create file in appropriate category
2. Define TypeScript interface
3. Implement component logic
4. Add proper error handling
5. Export from index if needed
6. Document in this file

### Modifying Existing Component
1. Check for breaking changes
2. Update TypeScript types
3. Test edge cases
4. Update documentation
5. Verify dependent components

### Adding New Feature
1. Identify affected components
2. Plan state management
3. Design error handling
4. Implement incrementally
5. Add appropriate tests