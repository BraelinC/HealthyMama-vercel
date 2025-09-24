import { UltraThinkMemoryEngine } from './UltraThinkMemoryEngine';
import { db } from "../db";
import { and, asc, desc, eq } from "drizzle-orm";
import {
  chatSessions,
  chatMessages,
  communityMembers,
  communityAIConfigs,
} from "@shared/schema";

export class Mem0ChatService {
  private memoryEngine: UltraThinkMemoryEngine;

  constructor() {
    this.memoryEngine = new UltraThinkMemoryEngine();
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
        model: "mem0-ultrathink",
        temperature: 0.7,
        max_tokens: 1500,
        top_p: 1.0,
        memory_enabled: true,
        short_term_limit: 20,
        tools: [],
      }
    );
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

      // Get AI config for this community
      const cfg = await this.getAIConfig(communityId);

      console.log('[MEM0 CHAT]', {
        communityId,
        model: 'UltraThink',
        memory_enabled: cfg.memory_enabled,
        sessionId,
        messageLength: message.length
      });

      // Store user message in PostgreSQL (keep existing structure)
      await db.insert(chatMessages).values({
        session_id: sessionId,
        community_id: communityId,
        user_id: userId,
        role: "user",
        content: message,
      });

      console.log('[MEM0 DB] stored user message', { sessionId, len: message.length });

      // Process with UltraThink memory engine
      const result = await this.memoryEngine.processConversation(
        userId,
        message,
        communityId
      );

      console.log('[MEM0 AI]', {
        model: result.model,
        contextUsed: result.contextUsed,
        responseLength: result.response?.length || 0,
        memoryContextItems: result.memoryContext?.length || 0
      });

      // Store assistant response in PostgreSQL
      await db.insert(chatMessages).values({
        session_id: sessionId,
        community_id: communityId,
        role: "assistant",
        content: result.response,
      });

      console.log('[MEM0 DB] stored assistant message', { sessionId, len: result.response.length });

      // Update session timestamp
      await db
        .update(chatSessions)
        .set({ last_message_at: new Date() })
        .where(eq(chatSessions.id, sessionId));

      return {
        sessionId,
        response: result.response,
        model: "UltraThink-Mem0",
        output_text: result.response,
        memoryContext: result.memoryContext,
        contextUsed: result.contextUsed,
        engine: "mem0"
      };

    } catch (error: any) {
      console.error("[MEM0 CHAT ERROR]", {
        userId,
        communityId,
        messagePreview: String(message).slice(0, 200),
        error: error?.message,
        stack: error?.stack
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
      // Allow only community creator to preview (same as existing logic)
      const { communities } = await import("@shared/schema");
      const [comm] = await db.select().from(communities).where(eq(communities.id, communityId));
      if (!comm || comm.creator_id !== userId) {
        throw new Error("Forbidden");
      }

      // Process preview with UltraThink (without storing)
      const result = await this.memoryEngine.processConversation(
        userId,
        message,
        communityId
      );

      console.log('[MEM0 PREVIEW]', {
        model: result.model,
        contextUsed: result.contextUsed,
        responseLength: result.response?.length || 0
      });

      return {
        response: result.response,
        model: "UltraThink-Mem0",
        output_text: result.response,
        memoryContext: result.memoryContext,
        contextUsed: result.contextUsed,
        engine: "mem0"
      };

    } catch (error: any) {
      console.error("[MEM0 PREVIEW ERROR]", {
        userId,
        communityId,
        messagePreview: String(message).slice(0, 200),
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

  // Recipe search with memory intelligence
  async searchRecipes(params: {
    userId: string;
    query: string;
    creatorId?: string;
  }) {
    try {
      const result = await this.memoryEngine.findRecipeWithSubstitutions(
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
        engine: "mem0"
      };

    } catch (error: any) {
      console.error("[MEM0 RECIPE SEARCH ERROR]", {
        userId: params.userId,
        query: params.query,
        error: error?.message
      });
      throw error;
    }
  }

  // Store recipe feedback for learning
  async storeRecipeFeedback(params: {
    userId: string;
    recipeId: string;
    feedback: any;
  }) {
    try {
      // Get recipe details (this would need to be implemented based on your recipe storage)
      const recipe = {
        id: params.recipeId,
        title: params.feedback.recipeTitle || 'Unknown Recipe',
        cuisine: params.feedback.cuisine || 'unknown'
      };

      await this.memoryEngine.storeRecipeInteraction(
        params.userId,
        recipe,
        params.feedback
      );

      return { success: true, stored: true };

    } catch (error: any) {
      console.error("[MEM0 FEEDBACK ERROR]", {
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
      const summary = await this.memoryEngine.getUserMemorySummary(userId);

      return {
        ...summary,
        engine: "mem0",
        userId
      };

    } catch (error: any) {
      console.error("[MEM0 INSIGHTS ERROR]", {
        userId,
        error: error?.message
      });
      return {
        totalMemories: 0,
        memoryTypes: {},
        error: error?.message,
        engine: "mem0"
      };
    }
  }

  // Clear user memories (privacy feature)
  async clearUserMemories(userId: string) {
    try {
      const result = await this.memoryEngine.clearUserMemories(userId);

      return {
        ...result,
        success: true,
        engine: "mem0"
      };

    } catch (error: any) {
      console.error("[MEM0 CLEAR ERROR]", {
        userId,
        error: error?.message
      });
      throw error;
    }
  }
}

export const mem0ChatService = new Mem0ChatService();