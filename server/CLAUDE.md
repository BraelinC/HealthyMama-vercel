# NutriMa Backend Documentation

## Overview

The NutriMa backend is a Node.js/Express server that handles authentication, meal plan generation, recipe management, and integrations with external APIs. It uses TypeScript for type safety and implements sophisticated AI-powered algorithms for meal planning.

## Architecture

### Tech Stack
- **Runtime**: Node.js with TypeScript (TSX for development)
- **Framework**: Express 4.21.2
- **Database**: Neon PostgreSQL with Drizzle ORM
- **Authentication**: JWT + bcrypt + Express sessions
- **AI Services**: OpenAI, Grok (via custom integration)
- **External APIs**: Spoonacular, USDA, YouTube, Instacart
- **Payment**: Stripe API

## Core Services

### Meal Planning Engine

#### **enhancedMealPlanGenerator.ts**
The main orchestrator for meal plan generation:
- Accepts user preferences and constraints
- Coordinates with multiple AI services
- Implements retry logic and fallbacks
- Returns structured meal plans with recipes

#### **intelligentPromptBuilderV2.ts**
Constructs optimized prompts for AI models:
- Analyzes user profile (dietary restrictions, preferences)
- Incorporates cultural preferences
- Adds cost and nutrition constraints
- Formats for specific AI model requirements

#### **culturalMealRecommendationEngine.ts**
Ensures cultural authenticity:
- Maps user input to 50+ cuisine types
- Suggests authentic dishes per cuisine
- Validates against dietary restrictions
- Provides familiar dish name alternatives

#### **smartIngredientOptimizer.ts**
Optimizes ingredient usage across recipes:
- Identifies reusable ingredients
- Suggests bulk buying opportunities
- Calculates cost savings
- Minimizes food waste

### Recipe Generation

#### **enhancedRecipeGenerationService.ts**
Handles individual recipe generation:
- Multiple AI provider support
- Structured recipe format enforcement
- Nutrition data enrichment
- Cooking time calculation

#### **recipeComplexityCalculator.ts**
Estimates recipe difficulty:
- Analyzes cooking techniques
- Counts unique ingredients
- Evaluates time requirements
- Returns difficulty score (1-5)

#### **cookingTimeCalculator.ts** / **enhancedCookingTimeCalculator.ts**
Calculates realistic cooking times:
- Accounts for parallel operations
- Includes prep time
- Considers cooking method
- Provides time breakdowns

### External API Integrations

#### **instacart.ts**
Instacart Partner API integration:
- Product search and matching
- Shopping list creation
- Availability checking
- Price estimation

#### **nutritionCalculator.ts** + **nutritionParser.ts**
USDA nutrition data integration:
- Fetches nutrition data by food item
- Calculates per-serving nutrition
- Handles unit conversions
- Caches common queries

#### **videoRecipeExtractor.ts**
YouTube recipe extraction:
- Extracts recipes from video descriptions
- Parses ingredients and instructions
- Falls back to AI transcription
- Handles multiple video formats

#### **grok.ts**
Grok AI integration:
- Alternative AI provider
- Handles specific recipe types
- Custom prompt formatting

### Data Management

#### **db.ts**
Database connection and configuration:
```typescript
// Neon PostgreSQL connection
const db = drizzle(sql, { schema });
```

#### **dbStorage.ts** / **memStorage.ts**
Storage abstraction layer:
- Database persistence for production
- Memory storage for development/testing
- Consistent interface for both

#### **mealPlanCache.ts**
Caching layer for meal plans:
- Reduces AI API calls
- Stores recent generations
- Implements LRU eviction
- Per-user isolation

### Authentication & Security

#### **auth.ts**
Core authentication logic:
- JWT token generation/validation
- Password hashing with bcrypt
- Session management
- Protected route middleware

#### **googleAuth.ts** / **replitAuth.ts**
OAuth integrations:
- Google OAuth2 flow
- Replit authentication
- Profile data mapping

#### **rateLimiter.ts**
API rate limiting:
- Per-user limits
- Endpoint-specific rules
- Prevents abuse

## API Routes (`routes.ts`)

### Authentication Endpoints
```typescript
POST   /api/auth/signup          // User registration
POST   /api/auth/login           // User login
POST   /api/auth/logout          // User logout
POST   /api/auth/refresh         // Refresh JWT token
GET    /api/auth/verify          // Verify auth status
```

### User Management
```typescript
GET    /api/user                 // Get user profile
PUT    /api/user                 // Update profile
PUT    /api/user/preferences     // Update preferences
POST   /api/user/family-members  // Add family member
```

### Meal Planning
```typescript
POST   /api/generate-meal-plan   // Generate AI meal plan
POST   /api/save-meal-plan       // Save to database
GET    /api/meal-plans           // List saved plans
GET    /api/meal-plan/:id        // Get specific plan
PUT    /api/meal-plan/:id        // Update plan
DELETE /api/meal-plan/:id        // Delete plan
```

### Recipe Management
```typescript
POST   /api/recipes/generate     // Generate recipes
GET    /api/recipes/search       // Search recipes
POST   /api/recipes/save         // Save recipe
GET    /api/recipes/saved        // Get saved recipes
POST   /api/recipes/youtube      // Extract from YouTube
```

### Shopping & Nutrition
```typescript
POST   /api/create-shopping-list // Generate Instacart list
POST   /api/nutrition/analyze    // Get nutrition data
GET    /api/ingredients/search   // Search ingredients
```

### Cultural Features
```typescript
POST   /api/cultural-meals/save  // Save cultural preferences
GET    /api/cuisines             // List available cuisines
POST   /api/cuisines/parse       // Parse cultural input
```

## Key Algorithms

### Meal Plan Generation Flow
1. **Profile Analysis**: Extract user constraints
2. **Prompt Building**: Create optimized AI prompt
3. **AI Generation**: Call OpenAI/Grok with retry
4. **Enhancement**: Apply cultural/dietary filters
5. **Optimization**: Reuse ingredients, reduce cost
6. **Validation**: Check nutrition, restrictions
7. **Formatting**: Structure for frontend display

### Ingredient Deduplication (`ingredientDeduplicator.ts`)
```typescript
// Combines similar ingredients:
// "2 cups rice" + "1 cup rice" = "3 cups rice"
// "chicken breast" + "chicken breasts" = "2 chicken breasts"
```

### Cultural Preference Parsing (`nlpCultureParser.ts`)
```typescript
// Maps user input to cuisine codes:
// "I like spicy Asian food" → ["chinese", "thai", "indian"]
// "Mediterranean diet" → ["greek", "italian", "turkish"]
```

### Cost Optimization
- Identifies frequently used ingredients
- Suggests bulk purchases
- Calculates per-serving costs
- Estimates total savings

## Error Handling

### Standard Error Format
```typescript
{
  error: string,        // User-friendly message
  code?: string,        // Error code for debugging
  details?: any         // Additional context
}
```

### Error Types
- **ValidationError**: Invalid input data
- **AuthenticationError**: Auth failures
- **ExternalAPIError**: Third-party API issues
- **RateLimitError**: Too many requests
- **DatabaseError**: DB connection/query issues

## Performance Considerations

### Caching Strategy
- Meal plans cached for 24 hours
- Recipe results cached for 7 days
- Nutrition data cached indefinitely
- User preferences cached in session

### Database Optimization
- Indexed queries on user_id, created_at
- Batch inserts for meal plan recipes
- Connection pooling with Neon
- Query result streaming for large datasets

### API Response Optimization
- Streaming responses for meal generation
- Pagination for list endpoints
- Selective field returns
- Gzip compression enabled

## Testing

### Unit Tests
- Service function testing
- Algorithm verification
- Mock external APIs

### Integration Tests
- API endpoint testing
- Database operations
- External API integration

### Test Files
- `test-*.ts` files for specific features
- Mock data in test files
- Development-only test endpoints

## Environment Configuration

Required environment variables:
```bash
# Database
DATABASE_URL=postgresql://...

# Authentication
JWT_SECRET=...
SESSION_SECRET=...

# AI Services
OPENAI_API_KEY=...
XAI_API_KEY=...          # For Grok

# External APIs
SPOONACULAR_API_KEY=...
YOUTUBE_API_KEY=...
USDA_API_KEY=...

# Payment
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...

# App Config
NODE_ENV=development|production
PORT=5000
```

## Common Development Tasks

### Adding a New API Endpoint
1. Define route in `routes.ts`
2. Add handler function
3. Update TypeScript types
4. Add validation
5. Document in API section

### Integrating a New AI Provider
1. Create service file (e.g., `newai.ts`)
2. Implement standard interface
3. Add to prompt builder
4. Add fallback logic
5. Update environment vars

### Adding a New External API
1. Create integration file
2. Add API client setup
3. Implement error handling
4. Add caching if needed
5. Document usage

## Debugging Tips

### Logging
- Development: Console logs enabled
- Production: Structured logging
- Error tracking for failures
- Performance timing logs

### Common Issues
- **AI timeout**: Increase timeout, add retry
- **DB connection**: Check connection pool
- **Memory leaks**: Review cache sizes
- **Slow queries**: Add indexes, optimize

### Development Tools
- TSX for hot reloading
- Node inspector for debugging
- Postman/Insomnia for API testing
- pgAdmin for database inspection