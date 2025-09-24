// Safe optional import: only initialize mem0 if available
let MemoryImpl: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  MemoryImpl = require('mem0ai/oss').Memory;
} catch {
  MemoryImpl = null;
}
import OpenAI from 'openai';
import { buildProfileMemorySummary, collectPreferenceCategories, computeProfileSignature, type UltraThinkProfileData } from './profileUtils';

export class UltraThinkMemoryEngine {
  private memoryEngine: Memory;
  private conversationModel: OpenAI;

  constructor() {
    // Gemini 2.0 Flash for memory operations (2M context window, fast processing)
    this.memoryEngine = MemoryImpl
      ? new MemoryImpl({
      llm: {
        provider: "gemini",
        config: {
          model: "gemini-2.0-flash-001",
          temperature: 0.2, // Low temperature for consistent memory extraction
          max_tokens: 2000,
          top_p: 1.0
        }
      },
      vectorStore: {
        provider: "chroma",
        config: {}
      },
      embedder: {
        provider: "openai",
        config: {
          model: "text-embedding-3-large"
        }
      }
    })
      : {
          add: async (_messages: any, _opts: any) => ({ id: 'noop', stored: false }),
          search: async (_query: string, _opts: any) => [],
          getAll: async (_opts: any) => [],
          delete: async (_id: string) => undefined,
        } as any;

    // GPT-4o-mini for conversation responses (proven recipe expertise)
    this.conversationModel = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  // Store comprehensive user profile data
  async storeUserProfile(userId: string, profile: UltraThinkProfileData) {
    const summary = buildProfileMemorySummary(profile);
    const preferenceCategories = collectPreferenceCategories(profile);
    const signature = computeProfileSignature(profile);

    const messages = [{
      role: "user" as const,
      content: `User Profile Update:
${summary}

Preference Categories:
- Dietary: ${preferenceCategories.dietary.join(', ') || 'none'}
- Flavor Preferences: ${preferenceCategories.preferences.join(', ') || 'none'}
- Cultural Background: ${preferenceCategories.cultural.join(', ') || 'none'}
- Goals: ${preferenceCategories.goals.join(', ') || 'none'}`
    }];

    return await this.memoryEngine.add(messages, {
      userId,
      metadata: {
        type: "user_profile",
        updated: Date.now(),
        importance: 10,
        profileType: profile.profileType,
        familySize: profile.familySize,
        primaryGoal: profile.primaryGoal,
        summary,
        preferenceCategories,
        profileSignature: signature,
      }
    });
  }

  // Store recipe interactions with detailed feedback
  async storeRecipeInteraction(userId: string, recipe: any, feedback: any) {
    const messages = [{
      role: "user" as const,
      content: `Recipe Experience:
        Recipe: ${recipe.title}
        Cuisine: ${recipe.cuisine || 'unknown'}
        Cooking Time: ${recipe.prepTime || 'unknown'}
        Difficulty: ${recipe.difficulty || 'unknown'}

        My Experience:
        - Rating: ${feedback.rating}/5 stars
        - Liked: ${feedback.liked ? 'Yes' : 'No'}
        - Made it successfully: ${feedback.madeSuccessfully ? 'Yes' : 'No'}
        - Would make again: ${feedback.wouldMakeAgain ? 'Yes' : 'No'}
        - Personal notes: ${feedback.notes || 'none'}
        - Modifications I made: ${feedback.modifications || 'none'}
        - Issues encountered: ${feedback.issues || 'none'}

        Ingredients that worked well: ${feedback.likedIngredients?.join(', ') || 'none'}
        Ingredients I didn't like: ${feedback.dislikedIngredients?.join(', ') || 'none'}`
    }];

    return await this.memoryEngine.add(messages, {
      userId,
      metadata: {
        type: "recipe_feedback",
        recipeId: recipe.id,
        cuisine: recipe.cuisine,
        rating: feedback.rating,
        liked: feedback.liked,
        importance: feedback.rating || 5, // Rating becomes importance score
        timestamp: Date.now()
      }
    });
  }

  // Store cookbook recipes with comprehensive vectorization
  async storeCookbookRecipe(creatorId: string, recipe: any) {
    const messages = [{
      role: "system" as const,
      content: `Cookbook Recipe Entry:

        RECIPE DETAILS:
        Title: ${recipe.title}
        Creator ID: ${creatorId}
        Cuisine Type: ${recipe.cuisine || 'international'}
        Prep Time: ${recipe.prepTime || 'not specified'}
        Cook Time: ${recipe.cookTime || 'not specified'}
        Total Time: ${recipe.totalTime || 'not specified'}
        Difficulty Level: ${recipe.difficulty || 'medium'}
        Servings: ${recipe.servings || 'not specified'}

        INGREDIENTS:
        ${recipe.ingredients?.join('\n- ') || 'No ingredients listed'}

        INSTRUCTIONS:
        ${recipe.instructions || 'No instructions provided'}

        DIETARY INFORMATION:
        Dietary Tags: ${recipe.dietaryTags?.join(', ') || 'none specified'}
        Allergens: ${recipe.allergens?.join(', ') || 'none specified'}
        Calories per serving: ${recipe.calories || 'not specified'}

        ADDITIONAL INFO:
        Equipment needed: ${recipe.equipment?.join(', ') || 'basic kitchen tools'}
        Tips: ${recipe.tips || 'none'}
        Variations: ${recipe.variations || 'none'}
        Storage instructions: ${recipe.storage || 'none'}

        IMAGE: ${recipe.imageUrl ? 'Available' : 'Not available'}`
    }];

    return await this.memoryEngine.add(messages, {
      userId: `creator_${creatorId}`,
      metadata: {
        type: "cookbook_recipe",
        creatorId,
        cuisine: recipe.cuisine,
        prepTime: recipe.prepTime,
        difficulty: recipe.difficulty,
        imageUrl: recipe.imageUrl,
        dietaryTags: recipe.dietaryTags,
        importance: 8, // High importance for recipe content
        recipeId: recipe.id,
        timestamp: Date.now()
      }
    });
  }

  // Store cultural preferences and learning
  async storeCulturalPreference(userId: string, culturalData: any) {
    const messages = [{
      role: "user" as const,
      content: `Cultural Cuisine Preferences:

        Preferred Cuisines: ${culturalData.preferredCuisines?.join(', ') || 'none'}
        Disliked Cuisines: ${culturalData.dislikedCuisines?.join(', ') || 'none'}
        Spice Tolerance: ${culturalData.spiceTolerance || 'unknown'}
        Cooking Style Preference: ${culturalData.cookingStyle || 'unknown'}
        Traditional Dishes I Love: ${culturalData.favoriteDishes?.join(', ') || 'none'}
        Ingredients I Always Use: ${culturalData.stapleIngredients?.join(', ') || 'none'}
        Cultural Background: ${culturalData.background || 'not specified'}
        Regional Preferences: ${culturalData.regions?.join(', ') || 'none'}`
    }];

    return await this.memoryEngine.add(messages, {
      userId,
      metadata: {
        type: "cultural_preferences",
        cuisines: culturalData.preferredCuisines,
        spiceTolerance: culturalData.spiceTolerance,
        importance: 7,
        timestamp: Date.now()
      }
    });
  }

  // Intelligent conversation processing with memory context
  async processConversation(userId: string, message: string, communityId?: number) {
    try {
      // 1. Search relevant memories with Gemini's semantic understanding
      const relevantMemories = await this.memoryEngine.search(message, {
        userId,
        limit: 15 // Get more context for better responses
      });

      // 2. Build enhanced context from memories
      const systemPrompt = this.buildEnhancedSystemPrompt(relevantMemories, message);

      // 3. Generate response with GPT-4o-mini (proven for recipes)
      const response = await this.conversationModel.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message }
        ],
        temperature: 0.7, // Higher temperature for creative recipe generation
        max_tokens: 1500
      });

      const assistantResponse = response.choices[0]?.message?.content || "";

      // 4. Store this interaction for continuous learning
      await this.memoryEngine.add([
        { role: "user", content: message },
        { role: "assistant", content: assistantResponse }
      ], {
        userId,
        metadata: {
          type: "chat_interaction",
          communityId,
          timestamp: Date.now(),
          importance: 6, // Medium importance for general chat
          responseLength: assistantResponse.length
        }
      });

      return {
        response: assistantResponse,
        memoryContext: relevantMemories,
        model: "gpt-4o-mini",
        contextUsed: Array.isArray(relevantMemories) ? relevantMemories.length : 0
      };
    } catch (error) {
      console.error('UltraThink conversation error:', error);
      throw new Error(`UltraThink processing failed: ${error.message}`);
    }
  }

  // Find recipes with intelligent substitutions based on user context
  async findRecipeWithSubstitutions(userId: string, query: string, creatorId?: string) {
    try {
      // Search for recipes with context-aware filtering
      const searchQuery = creatorId ?
        `${query} creator:${creatorId}` :
        `${query} recipe cookbook`;

      const recipeMemories = await this.memoryEngine.search(searchQuery, {
        userId: creatorId ? `creator_${creatorId}` : undefined,
        filters: { type: "cookbook_recipe" },
        limit: 8 // Get more recipe options
      });

      // Get comprehensive user dietary and preference context
      const userContext = await this.memoryEngine.search(
        "dietary restrictions preferences allergies goals cultural cuisine feedback",
        {
          userId,
          limit: 20 // Get extensive user context
        }
      );

      // Generate intelligent modifications using GPT-4o-mini
      const modificationPrompt = `You are UltraThink, an AI chef assistant with perfect memory. Based on the user's comprehensive dietary context and the found recipes, provide intelligent recipe modifications and suggestions.

USER CONTEXT & PREFERENCES:
${userContext.map(m => `- ${m.content}`).join('\n')}

FOUND RECIPES:
${recipeMemories.map((m, idx) => `Recipe ${idx + 1}: ${m.content}`).join('\n\n')}

USER QUERY: "${query}"

INSTRUCTIONS:
1. If recipes are found, suggest specific modifications that respect the user's dietary restrictions and preferences
2. Explain WHY each modification is recommended based on the user's history
3. Provide alternative ingredients that maintain the dish's authenticity
4. Suggest cooking method adjustments based on the user's skill level and preferences
5. If no perfect match exists, suggest similar recipes that better fit the user's needs

Format your response to be helpful, personal, and actionable.`;

      const suggestions = await this.conversationModel.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: modificationPrompt }],
        temperature: 0.7,
        max_tokens: 1000
      });

      const modificationText = suggestions.choices[0]?.message?.content || "";

      // Store this search for learning user recipe discovery patterns
      await this.memoryEngine.add([{
        role: "user",
        content: `Searched for: "${query}" ${creatorId ? `from creator ${creatorId}` : ''}`
      }], {
        userId,
        metadata: {
          type: "recipe_search",
          query,
          creatorId,
          resultsFound: recipeMemories.length,
          timestamp: Date.now(),
          importance: 5
        }
      });

      return {
        originalRecipes: recipeMemories,
        userContext,
        modifications: modificationText,
        reasoning: "AI-generated modifications based on comprehensive user memory and preferences",
        searchQuery: query,
        totalMatches: Array.isArray(recipeMemories) ? recipeMemories.length : 0
      };
    } catch (error) {
      console.error('Recipe search error:', error);
      throw new Error(`Recipe search failed: ${error.message}`);
    }
  }

  // Get user memory summary for debugging/insights
  async getUserMemorySummary(userId: string) {
    try {
      const allMemories = await this.memoryEngine.getAll({ userId });

      const memoryTypes = allMemories.reduce((acc: any, memory: any) => {
        const type = memory.metadata?.type || 'unknown';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {});

      return {
        totalMemories: allMemories.length,
        memoryTypes,
        lastUpdated: Math.max(...allMemories.map((m: any) => m.metadata?.timestamp || 0)),
        memories: allMemories.slice(0, 10) // Return recent 10 for preview
      };
    } catch (error) {
      console.error('Memory summary error:', error);
      return { totalMemories: 0, memoryTypes: {}, error: error.message };
    }
  }

  // Build enhanced system prompt with memory context
  private buildEnhancedSystemPrompt(memories: any, currentQuery: string): string {
    let memoryContext = '';
    if (Array.isArray(memories)) {
      memoryContext = memories.map(m => `Memory: ${m.content || m.text || m}`).join('\n');
    } else if (memories?.memories && Array.isArray(memories.memories)) {
      memoryContext = memories.memories.map((m: any) => `Memory: ${m.content || m.text || m}`).join('\n');
    } else {
      memoryContext = 'No previous memories found for this user.';
    }

    return `You are UltraThink, the most intelligent cooking assistant with perfect memory of user preferences, dietary restrictions, and cooking history. You understand cultural cuisines, dietary needs, and personal taste preferences at a deep level.

COMPREHENSIVE MEMORY CONTEXT:
${memoryContext || 'No previous memories found for this user.'}

YOUR CAPABILITIES:
- Perfect recall of user's dietary restrictions and allergies (NEVER suggest foods they can't eat)
- Deep understanding of cultural cuisines and authentic cooking methods
- Personalized recipe recommendations based on user's cooking history and feedback
- Intelligent ingredient substitutions that maintain flavor profiles
- Awareness of user's cooking skill level and available time
- Knowledge of family preferences and meal planning needs

INSTRUCTIONS:
- Use the memory context to provide highly personalized responses
- ALWAYS respect dietary restrictions and allergies mentioned in memories
- Reference past successful recipes or modifications when relevant
- Suggest creative variations based on user's cultural preferences
- Be conversational, helpful, and demonstrate your memory of their preferences
- If asked about recipes, provide detailed, actionable instructions
- Learn from every interaction to improve future recommendations

CURRENT USER QUERY: "${currentQuery}"

Provide a helpful, personalized response that demonstrates your deep understanding of this user's cooking preferences and needs.`;
  }

  // Clear user memories (for privacy/reset)
  async clearUserMemories(userId: string) {
    try {
      const allMemories = await this.memoryEngine.getAll({ userId });

      for (const memory of allMemories) {
        await this.memoryEngine.delete(memory.id);
      }

      return { cleared: allMemories.length };
    } catch (error) {
      console.error('Clear memories error:', error);
      throw new Error(`Failed to clear memories: ${error.message}`);
    }
  }
}

export const ultraThinkEngine = new UltraThinkMemoryEngine();