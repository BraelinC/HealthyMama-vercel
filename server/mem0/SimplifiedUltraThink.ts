import OpenAI from 'openai';

// Simplified UltraThink implementation without mem0.ai dependencies
// This provides basic intelligent memory functionality until we resolve mem0.ai peer deps

interface MemoryItem {
  id: string;
  userId: string;
  type: 'profile' | 'recipe_feedback' | 'cultural' | 'chat';
  content: string;
  metadata: any;
  timestamp: number;
  importance: number;
}

export class SimplifiedUltraThink {
  private conversationModel: OpenAI;
  private memoryStore: Map<string, MemoryItem[]> = new Map();
  private profileSignatureByUser: Map<string, string> = new Map();

  constructor() {
    this.conversationModel = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  // Store user profile information
  async storeUserProfile(userId: string, profile: any) {
    const memories = this.memoryStore.get(userId) || [];

    // Build signature to prevent duplicate identical profile memories
    const dietary = Array.isArray(profile?.dietaryRestrictions) ? [...profile.dietaryRestrictions] : [];
    const goals = Array.isArray(profile?.goals) ? [...profile.goals] : [];
    const prefs = Array.isArray(profile?.preferences) ? [...profile.preferences] : [];
    const signature = JSON.stringify({
      name: String(profile?.profileName || 'User Profile'),
      type: String(profile?.profileType || 'individual'),
      primaryGoal: String(profile?.primaryGoal || ''),
      familySize: Number(profile?.familySize || 1),
      dietary: dietary.map((v: string) => v.toLowerCase()).sort(),
      goals: goals.map((v: string) => v.toLowerCase()).sort(),
      preferences: prefs.map((v: string) => v.toLowerCase()).sort(),
      cultural: Array.isArray(profile?.culturalBackground) ? profile.culturalBackground.map((v: string) => v.toLowerCase()).sort() : [],
    });

    const previous = this.profileSignatureByUser.get(userId);
    if (previous === signature) {
      this.memoryStore.set(userId, memories);
      return { success: true, skipped: true, reason: 'Profile unchanged' };
    }
    this.profileSignatureByUser.set(userId, signature);

    const profileMemory: MemoryItem = {
      id: `profile_${Date.now()}`,
      userId,
      type: 'profile',
      content: `User Profile: ${profile.profileName}
        Dietary Restrictions: ${profile.dietaryRestrictions?.join(', ') || 'none'}
        Goals: ${profile.goals?.join(', ') || 'none'}
        Family Size: ${profile.familySize || 1}
        Cultural Background: ${profile.culturalBackground?.join(', ') || 'none'}`,
      metadata: profile,
      timestamp: Date.now(),
      importance: 10
    };

    memories.push(profileMemory);
    this.memoryStore.set(userId, memories);

    console.log('[SIMPLIFIED ULTRATHINK] Stored profile for user:', userId);
    return { success: true, memoryId: profileMemory.id };
  }

  // Store recipe feedback
  async storeRecipeInteraction(userId: string, recipe: any, feedback: any) {
    const memories = this.memoryStore.get(userId) || [];

    const feedbackMemory: MemoryItem = {
      id: `feedback_${Date.now()}`,
      userId,
      type: 'recipe_feedback',
      content: `Recipe Feedback: ${recipe.title}
        Rating: ${feedback.rating}/5
        Liked: ${feedback.liked ? 'Yes' : 'No'}
        Notes: ${feedback.notes || 'none'}
        Modifications: ${feedback.modifications || 'none'}`,
      metadata: { recipe, feedback },
      timestamp: Date.now(),
      importance: feedback.rating || 5
    };

    memories.push(feedbackMemory);
    this.memoryStore.set(userId, memories);

    console.log('[SIMPLIFIED ULTRATHINK] Stored recipe feedback for user:', userId);
    return { success: true, memoryId: feedbackMemory.id };
  }

  // Store cultural preferences
  async storeCulturalPreference(userId: string, culturalData: any) {
    const memories = this.memoryStore.get(userId) || [];

    const culturalMemory: MemoryItem = {
      id: `cultural_${Date.now()}`,
      userId,
      type: 'cultural',
      content: `Cultural Preferences:
        Preferred Cuisines: ${culturalData.preferredCuisines?.join(', ') || 'none'}
        Background: ${culturalData.background || 'none'}`,
      metadata: culturalData,
      timestamp: Date.now(),
      importance: 7
    };

    memories.push(culturalMemory);
    this.memoryStore.set(userId, memories);

    console.log('[SIMPLIFIED ULTRATHINK] Stored cultural preferences for user:', userId);
    return { success: true, memoryId: culturalMemory.id };
  }

  // Search memories (simplified)
  async searchMemories(userId: string, query: string, limit: number = 10) {
    const memories = this.memoryStore.get(userId) || [];

    // Simple keyword matching for now
    const queryLower = query.toLowerCase();
    const relevantMemories = memories
      .filter(memory =>
        memory.content.toLowerCase().includes(queryLower) ||
        memory.type === 'profile' // Always include profile
      )
      .sort((a, b) => b.importance - a.importance) // Sort by importance
      .slice(0, limit);

    return relevantMemories;
  }

  // Process conversation with streaming and memory context
  async processConversationStream(userId: string, message: string, communityId?: number, onChunk?: (chunk: string) => void, systemPromptOverride?: string) {
    try {
      // Get relevant memories
      const relevantMemories = await this.searchMemories(userId, message, 5);

      // Build context prompt
      const memoryContext = relevantMemories
        .map(m => m.content)
        .join('\n');

      // Always include formatting instructions, but allow custom base prompt
      const systemPromptBase = systemPromptOverride && systemPromptOverride.trim().length > 0
        ? systemPromptOverride
        : `You are UltraThink, an intelligent cooking assistant with perfect memory.`;

      const recipeFormatInstructions = `
RECIPE OUTPUT FORMAT - MANDATORY (when providing recipes):
When sharing recipes, you MUST ALWAYS use this exact structured format:

# Recipe Name

## Ingredients:
- [quantity] [ingredient name]
- [quantity] [ingredient name]
- [quantity] [ingredient name]

## Instructions:
1. [First step - be clear and specific]
2. [Second step - include timing when relevant]
3. [Continue with numbered steps]

## Notes:
- [Any dietary modifications based on user's restrictions]
- [Cooking tips or substitutions]

CRITICAL FORMATTING RULES:
- Use DASHES (-) for ingredients list, NEVER numbers
- Use NUMBERS (1. 2. 3.) for instructions list
- Put a space after each dash and number
- Each ingredient and instruction on its own line
- Never mix the formats

IMPORTANT: Never provide recipes in paragraph format. Always use the structured format above.
For non-recipe responses, be conversational and helpful as normal.`;

      const systemPrompt = `${systemPromptBase}

MEMORY CONTEXT:
${memoryContext || 'No previous memories found for this user.'}

INSTRUCTIONS:
- Use the memory context to provide personalized responses
- Remember dietary restrictions and modify recipes accordingly
- Learn from past interactions and preferences
- Be conversational and helpful
- If no memory exists, help build it by asking relevant questions

${recipeFormatInstructions}

Current user query: "${message}"`;

      // Generate response with streaming GPT-4o-mini
      const response = await this.conversationModel.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message }
        ],
        temperature: 0.7,
        max_tokens: 1500,
        stream: true
      });

      let assistantResponse = "";

      // Stream the response
      for await (const chunk of response) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          assistantResponse += content;
          if (onChunk) {
            onChunk(content);
          }
        }
      }

      // Store this interaction
      const memories = this.memoryStore.get(userId) || [];
      const chatMemory: MemoryItem = {
        id: `chat_${Date.now()}`,
        userId,
        type: 'chat',
        content: `Chat: User: ${message}\nAssistant: ${assistantResponse}`,
        metadata: { communityId, query: message },
        timestamp: Date.now(),
        importance: 5
      };

      memories.push(chatMemory);
      this.memoryStore.set(userId, memories);

      return {
        response: assistantResponse,
        memoryContext: relevantMemories,
        model: "gpt-4o-mini (Simplified UltraThink Streaming)",
        contextUsed: relevantMemories.length
      };

    } catch (error) {
      console.error('[SIMPLIFIED ULTRATHINK STREAM] Conversation error:', error);
      throw new Error(`UltraThink streaming failed: ${error.message}`);
    }
  }

  // Process conversation with memory context
  async processConversation(userId: string, message: string, communityId?: number, systemPromptOverride?: string) {
    try {
      // Get relevant memories
      const relevantMemories = await this.searchMemories(userId, message, 5);

      // Build context prompt
      const memoryContext = relevantMemories
        .map(m => m.content)
        .join('\n');

      // Always include formatting instructions, but allow custom base prompt
      const systemPromptBase = systemPromptOverride && systemPromptOverride.trim().length > 0
        ? systemPromptOverride
        : `You are UltraThink, an intelligent cooking assistant with perfect memory.`;

      const recipeFormatInstructions = `
RECIPE OUTPUT FORMAT - MANDATORY (when providing recipes):
When sharing recipes, you MUST ALWAYS use this exact structured format:

# Recipe Name

## Ingredients:
- [quantity] [ingredient name]
- [quantity] [ingredient name]
- [quantity] [ingredient name]

## Instructions:
1. [First step - be clear and specific]
2. [Second step - include timing when relevant]
3. [Continue with numbered steps]

## Notes:
- [Any dietary modifications based on user's restrictions]
- [Cooking tips or substitutions]

CRITICAL FORMATTING RULES:
- Use DASHES (-) for ingredients list, NEVER numbers
- Use NUMBERS (1. 2. 3.) for instructions list
- Put a space after each dash and number
- Each ingredient and instruction on its own line
- Never mix the formats

IMPORTANT: Never provide recipes in paragraph format. Always use the structured format above.
For non-recipe responses, be conversational and helpful as normal.`;

      const systemPrompt = `${systemPromptBase}

MEMORY CONTEXT:
${memoryContext || 'No previous memories found for this user.'}

INSTRUCTIONS:
- Use the memory context to provide personalized responses
- Remember dietary restrictions and modify recipes accordingly
- Learn from past interactions and preferences
- Be conversational and helpful
- If no memory exists, help build it by asking relevant questions

${recipeFormatInstructions}

Current user query: "${message}"`;

      // Generate response with GPT-4o-mini
      const response = await this.conversationModel.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message }
        ],
        temperature: 0.7,
        max_tokens: 1500
      });

      const assistantResponse = response.choices[0]?.message?.content || "";

      // Store this interaction
      const memories = this.memoryStore.get(userId) || [];
      const chatMemory: MemoryItem = {
        id: `chat_${Date.now()}`,
        userId,
        type: 'chat',
        content: `Chat: User: ${message}\nAssistant: ${assistantResponse}`,
        metadata: { communityId, query: message },
        timestamp: Date.now(),
        importance: 5
      };

      memories.push(chatMemory);
      this.memoryStore.set(userId, memories);

      return {
        response: assistantResponse,
        memoryContext: relevantMemories,
        model: "gpt-4o-mini (Simplified UltraThink)",
        contextUsed: relevantMemories.length
      };

    } catch (error) {
      console.error('[SIMPLIFIED ULTRATHINK] Conversation error:', error);
      throw new Error(`UltraThink processing failed: ${error.message}`);
    }
  }

  // Find recipes with substitutions (simplified)
  async findRecipeWithSubstitutions(userId: string, query: string, creatorId?: string) {
    try {
      // Get user context
      const userContext = await this.searchMemories(userId, "dietary restrictions preferences allergies", 10);

      // For now, return a mock response since we don't have recipe vectorization
      const modifications = `Based on your dietary preferences and past interactions, here are some suggestions for "${query}":

User Context Found:
${userContext.map(m => `- ${m.content.slice(0, 100)}...`).join('\n')}

Since this is a simplified implementation, recipe search is not yet available.
The full mem0.ai integration will provide:
- Semantic recipe search
- Intelligent ingredient substitutions
- Personalized modifications based on your history

To enable full functionality, we need to resolve the mem0.ai dependency conflicts.`;

      return {
        originalRecipes: [],
        userContext,
        modifications,
        reasoning: "Simplified UltraThink - basic memory only",
        searchQuery: query,
        totalMatches: 0
      };

    } catch (error) {
      console.error('[SIMPLIFIED ULTRATHINK] Recipe search error:', error);
      throw new Error(`Recipe search failed: ${error.message}`);
    }
  }

  // Get user memory summary
  async getUserMemorySummary(userId: string) {
    try {
      const memories = this.memoryStore.get(userId) || [];

      const memoryTypes = memories.reduce((acc: any, memory) => {
        acc[memory.type] = (acc[memory.type] || 0) + 1;
        return acc;
      }, {});

      return {
        totalMemories: memories.length,
        memoryTypes,
        lastUpdated: Math.max(...memories.map(m => m.timestamp), 0),
        memories: memories.slice(-5) // Return recent 5 for preview
      };

    } catch (error) {
      console.error('[SIMPLIFIED ULTRATHINK] Memory summary error:', error);
      return { totalMemories: 0, memoryTypes: {}, error: error.message };
    }
  }

  // Clear user memories
  async clearUserMemories(userId: string) {
    try {
      const memories = this.memoryStore.get(userId) || [];
      this.memoryStore.delete(userId);

      return { cleared: memories.length };
    } catch (error) {
      console.error('[SIMPLIFIED ULTRATHINK] Clear memories error:', error);
      throw new Error(`Failed to clear memories: ${error.message}`);
    }
  }
}

export const simplifiedUltraThink = new SimplifiedUltraThink();