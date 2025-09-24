import { SimplifiedUltraThink } from './SimplifiedUltraThink';
import { db } from "../db";
import { and, asc, desc, eq } from "drizzle-orm";
import {
  chatSessions,
  chatMessages,
  communityMembers,
  communityAIConfigs,
} from "@shared/schema";
import {
  mapProfilePayloadToUltraThink,
  buildProfileMemorySummary,
  computeProfileSignature,
  collectPreferenceCategories,
  type UltraThinkProfileData,
} from './profileUtils';

export class SimplifiedMem0ChatService {
  private ultraThink: SimplifiedUltraThink;

  constructor() {
    this.ultraThink = new SimplifiedUltraThink();
  }

  async ensureSession(userId: string, communityId: number, sessionId?: string) {
    if (sessionId) return sessionId;
    const [s] = await db
      .insert(chatSessions)
      .values({ user_id: userId, community_id: communityId })
      .returning({ id: chatSessions.id });
    return s.id as string;
  }

  async assertMembership(userId: string, communityId: number) {
    const [m] = await db
      .select()
      .from(communityMembers)
      .where(and(eq(communityMembers.user_id, userId), eq(communityMembers.community_id, communityId)));
    if (!m) throw new Error("Not a member of this community");
  }

  async getAIConfig(communityId: number) {
    const [cfg] = await db.select().from(communityAIConfigs).where(eq(communityAIConfigs.community_id, communityId));
    return (
      cfg || {
        system_prompt: "You are UltraThink, an intelligent cooking assistant with perfect memory.",
        model: "simplified-ultrathink",
        temperature: 0.7,
        max_tokens: 1500,
        top_p: 1.0,
        memory_enabled: true,
        short_term_limit: 20,
        tools: [],
      }
    );
  }

  async sendMessageStream(params: {
    userId: string;
    communityId: number;
    sessionId?: string;
    message: string;
    onChunk: (chunk: string) => void;
    onComplete: (result: any) => void;
  }) {
    const { userId, communityId, message, onChunk, onComplete } = params;

    try {
      // Verify membership
      await this.assertMembership(userId, communityId);

      // Ensure session exists
      const sessionId = await this.ensureSession(userId, communityId, params.sessionId);

      console.log('[SIMPLIFIED MEM0 STREAM]', {
        communityId,
        model: 'Simplified UltraThink',
        sessionId,
        messageLength: message.length
      });

      // Store user message in PostgreSQL
      await db.insert(chatMessages).values({
        session_id: sessionId,
        community_id: communityId,
        user_id: userId,
        role: "user",
        content: message,
      });

      // Fetch AI config to allow system prompt override
      const cfg = await this.getAIConfig(communityId);

      // Process with streaming UltraThink
      const result = await this.ultraThink.processConversationStream(
        userId,
        message,
        communityId,
        onChunk,
        cfg.system_prompt
      );

      // Store assistant response in PostgreSQL
      await db.insert(chatMessages).values({
        session_id: sessionId,
        community_id: communityId,
        role: "assistant",
        content: result.response,
      });

      // Update session timestamp
      await db
        .update(chatSessions)
        .set({ last_message_at: new Date() })
        .where(eq(chatSessions.id, sessionId));

      const finalResult = {
        sessionId,
        response: result.response,
        model: "Simplified UltraThink",
        output_text: result.response,
        memoryContext: result.memoryContext,
        contextUsed: result.contextUsed,
        engine: "simplified-ultrathink"
      };

      onComplete(finalResult);
      return finalResult;

    } catch (error: any) {
      console.error("[SIMPLIFIED MEM0 STREAM ERROR]", {
        userId,
        communityId,
        messagePreview: String(message).slice(0, 200),
        error: error?.message
      });
      throw error;
    }
  }

  async sendMessage(params: {
    userId: string;
    communityId: number;
    sessionId?: string;
    message: string
  }) {
    const { userId, communityId, message } = params;

    try {
      // Verify membership
      await this.assertMembership(userId, communityId);

      // Ensure session exists
      const sessionId = await this.ensureSession(userId, communityId, params.sessionId);

      console.log('[SIMPLIFIED MEM0 CHAT]', {
        communityId,
        model: 'Simplified UltraThink',
        sessionId,
        messageLength: message.length
      });

      // Store user message in PostgreSQL
      await db.insert(chatMessages).values({
        session_id: sessionId,
        community_id: communityId,
        user_id: userId,
        role: "user",
        content: message,
      });

      // Fetch AI config to allow system prompt override
      const cfg = await this.getAIConfig(communityId);

      // Process with Simplified UltraThink
      const result = await this.ultraThink.processConversation(
        userId,
        message,
        communityId,
        cfg.system_prompt
      );

      console.log('[SIMPLIFIED MEM0 AI]', {
        model: result.model,
        contextUsed: result.contextUsed,
        responseLength: result.response?.length || 0
      });

      // Store assistant response in PostgreSQL
      await db.insert(chatMessages).values({
        session_id: sessionId,
        community_id: communityId,
        role: "assistant",
        content: result.response,
      });

      // Update session timestamp
      await db
        .update(chatSessions)
        .set({ last_message_at: new Date() })
        .where(eq(chatSessions.id, sessionId));

      return {
        sessionId,
        response: result.response,
        model: "Simplified UltraThink",
        output_text: result.response,
        memoryContext: result.memoryContext,
        contextUsed: result.contextUsed,
        engine: "simplified-ultrathink"
      };

    } catch (error: any) {
      console.error("[SIMPLIFIED MEM0 CHAT ERROR]", {
        userId,
        communityId,
        messagePreview: String(message).slice(0, 200),
        error: error?.message
      });
      throw error;
    }
  }

  async previewResponse(params: {
    userId: string;
    communityId: number;
    message: string
  }) {
    const { userId, communityId, message } = params;

    try {
      // Allow only community creator to preview
      const { communities } = await import("@shared/schema");
      const [comm] = await db.select().from(communities).where(eq(communities.id, communityId));
      if (!comm || comm.creator_id !== userId) {
        throw new Error("Forbidden");
      }

      // Process preview with Simplified UltraThink
      const result = await this.ultraThink.processConversation(
        userId,
        message,
        communityId
      );

      return {
        response: result.response,
        model: "Simplified UltraThink",
        output_text: result.response,
        memoryContext: result.memoryContext,
        contextUsed: result.contextUsed,
        engine: "simplified-ultrathink"
      };

    } catch (error: any) {
      console.error("[SIMPLIFIED MEM0 PREVIEW ERROR]", {
        userId,
        communityId,
        error: error?.message
      });
      throw error;
    }
  }

  async listSessions(userId: string, communityId: number) {
    return db
      .select()
      .from(chatSessions)
      .where(and(eq(chatSessions.user_id, userId), eq(chatSessions.community_id, communityId)))
      .orderBy(desc(chatSessions.last_message_at));
  }

  async getHistory(userId: string, communityId: number, sessionId: string) {
    const [s] = await db.select().from(chatSessions).where(eq(chatSessions.id, sessionId));
    if (!s || s.user_id !== userId || s.community_id !== communityId) {
      throw new Error("Forbidden");
    }

    return db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.session_id, sessionId))
      .orderBy(asc(chatMessages.id));
  }

  // Recipe search with simplified intelligence
  async searchRecipes(params: {
    userId: string;
    query: string;
    creatorId?: string;
  }) {
    try {
      const result = await this.ultraThink.findRecipeWithSubstitutions(
        params.userId,
        params.query,
        params.creatorId
      );

      return {
        query: params.query,
        totalMatches: result.totalMatches,
        recipes: result.originalRecipes,
        modifications: result.modifications,
        userContext: result.userContext,
        reasoning: result.reasoning,
        engine: "simplified-ultrathink"
      };

    } catch (error: any) {
      console.error("[SIMPLIFIED MEM0 RECIPE SEARCH ERROR]", {
        userId: params.userId,
        query: params.query,
        error: error?.message
      });
      throw error;
    }
  }

  // Store recipe feedback
  async storeRecipeFeedback(params: {
    userId: string;
    recipeId: string;
    feedback: any;
  }) {
    try {
      const recipe = {
        id: params.recipeId,
        title: params.feedback.recipeTitle || 'Unknown Recipe',
        cuisine: params.feedback.cuisine || 'unknown'
      };

      await this.ultraThink.storeRecipeInteraction(
        params.userId,
        recipe,
        params.feedback
      );

      return { success: true, stored: true };

    } catch (error: any) {
      console.error("[SIMPLIFIED MEM0 FEEDBACK ERROR]", {
        userId: params.userId,
        recipeId: params.recipeId,
        error: error?.message
      });
      throw error;
    }
  }

  // Get user memory insights
  async getUserMemoryInsights(userId: string) {
    try {
      const summary = await this.ultraThink.getUserMemorySummary(userId);

      return {
        ...summary,
        engine: "simplified-ultrathink",
        userId
      };

    } catch (error: any) {
      console.error("[SIMPLIFIED MEM0 INSIGHTS ERROR]", {
        userId,
        error: error?.message
      });
      return {
        totalMemories: 0,
        memoryTypes: {},
        error: error?.message,
        engine: "simplified-ultrathink"
      };
    }
  }

  // Clear user memories
  async clearUserMemories(userId: string) {
    try {
      const result = await this.ultraThink.clearUserMemories(userId);

      return {
        ...result,
        success: true,
        engine: "simplified-ultrathink"
      };

    } catch (error: any) {
      console.error("[SIMPLIFIED MEM0 CLEAR ERROR]", {
        userId,
        error: error?.message
      });
      throw error;
    }
  }

  // Sync user profile to memory
  async syncUserProfile(userId: string, profileData?: any) {
    try {
      const mappedProfile = mapProfilePayloadToUltraThink(profileData) || {
        profileName: 'User Profile',
        profileType: 'individual',
        primaryGoal: '',
        familySize: 1,
        dietaryRestrictions: [],
        goals: [],
        preferences: [],
        culturalBackground: [],
        members: [],
      };

      await this.ultraThink.storeUserProfile(userId, mappedProfile);

      return {
        synced: true,
        profileData: mappedProfile,
        summary: buildProfileMemorySummary(mappedProfile),
        preferenceCategories: collectPreferenceCategories(mappedProfile),
        profileSignature: computeProfileSignature(mappedProfile),
        engine: "simplified-ultrathink"
      };

    } catch (error: any) {
      console.error("[SIMPLIFIED MEM0 SYNC ERROR]", {
        userId,
        error: error?.message
      });
      throw error;
    }
  }
}

export const simplifiedMem0ChatService = new SimplifiedMem0ChatService();