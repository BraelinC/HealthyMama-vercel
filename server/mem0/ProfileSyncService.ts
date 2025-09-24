import { UltraThinkMemoryEngine } from './UltraThinkMemoryEngine';
import { db } from "../db";
import { and, desc, eq } from "drizzle-orm";
import {
  profiles,
  communityMemoryItems,
  cookbookEntries,
  chatMessages,
  mergeFamilyDietaryRestrictions,
  type FamilyMember,
} from "@shared/schema";
import {
  mapProfileRecordToUltraThink,
  mapProfilePayloadToUltraThink,
  buildProfileMemorySummary,
  computeProfileSignature,
  collectPreferenceCategories,
  type UltraThinkProfileData,
} from './profileUtils';

export class ProfileSyncService {
  private memoryEngine: UltraThinkMemoryEngine;

  constructor() {
    this.memoryEngine = new UltraThinkMemoryEngine();
  }

  // Sync existing user profile to mem0
  async syncUserProfile(userId: string, overrideProfile?: any) {
    try {
      let source: 'client' | 'database' = 'client';
      let profileData: UltraThinkProfileData | null = mapProfilePayloadToUltraThink(overrideProfile);

      if (!profileData) {
        source = 'database';
        const [profile] = await db
          .select()
          .from(profiles)
          .where(eq(profiles.user_id, userId))
          .limit(1);

        if (!profile) {
          console.log('[PROFILE SYNC] No profile found for user:', userId);
          return { synced: false, reason: 'No profile found', source };
        }

        profileData = mapProfileRecordToUltraThink(profile);
      }

      if (!profileData) {
        return { synced: false, reason: 'Unable to map profile data', source };
      }

      await this.memoryEngine.storeUserProfile(userId, profileData);

      const summary = buildProfileMemorySummary(profileData);
      const preferenceCategories = collectPreferenceCategories(profileData);
      const profileSignature = computeProfileSignature(profileData);

      console.log('[PROFILE SYNC] Synced profile for user:', userId, {
        source,
        dietaryRestrictions: profileData.dietaryRestrictions.length,
        goals: profileData.goals.length,
        familySize: profileData.familySize,
        culturalBackground: profileData.culturalBackground.length,
        profileSignature,
      });

      return {
        synced: true,
        source,
        profileData,
        summary,
        preferenceCategories,
        profileSignature,
        stats: {
          dietaryRestrictions: profileData.dietaryRestrictions.length,
          goals: profileData.goals.length,
          familyMembers: profileData.members.length,
          culturalPreferences: profileData.culturalBackground.length
        }
      };

    } catch (error) {
      console.error('[PROFILE SYNC ERROR]', { userId, error: error.message });
      throw new Error(`Failed to sync profile: ${error.message}`);
    }
  }

  async getUserProfile(userId: string) {
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.user_id, userId))
      .limit(1);

    if (!profile) {
      return null;
    }

    const mapped = mapProfileRecordToUltraThink(profile);

    if (!mapped) {
      return null;
    }

    return {
      profile: mapped,
      summary: buildProfileMemorySummary(mapped),
      preferenceCategories: collectPreferenceCategories(mapped),
      profileSignature: computeProfileSignature(mapped),
      updatedAt: profile.updated_at,
      source: 'database' as const,
    };
  }

  // Sync existing community memory items
  async syncCommunityMemories(userId: string, communityId: number) {
    try {
      // Get existing memory items from PostgreSQL
      const memoryItems = await db
        .select()
        .from(communityMemoryItems)
        .where(and(
          eq(communityMemoryItems.user_id, userId),
          eq(communityMemoryItems.community_id, communityId)
        ))
        .orderBy(desc(communityMemoryItems.created_at))
        .limit(100); // Limit to recent 100 items

      let syncedCount = 0;

      for (const item of memoryItems) {
        try {
          // Convert old memory format to new mem0 format
          const memoryContent = this.convertLegacyMemory(item);

          if (memoryContent) {
            // Store legacy memory using proper storeUserProfile method
            await this.memoryEngine.storeUserProfile(userId, {
              profileName: memoryContent,
              dietaryRestrictions: [],
              goals: [],
              familySize: 1,
              culturalBackground: [],
              profileType: 'individual',
              primaryGoal: '',
              members: []
            });
            syncedCount++;
          }
        } catch (itemError) {
          console.warn('[MEMORY SYNC ITEM ERROR]', { itemId: item.id, error: itemError.message });
        }
      }

      console.log('[MEMORY SYNC] Synced community memories:', { userId, communityId, syncedCount });

      return {
        synced: true,
        totalItems: memoryItems.length,
        syncedCount,
        communityId
      };

    } catch (error) {
      console.error('[MEMORY SYNC ERROR]', { userId, communityId, error: error.message });
      throw new Error(`Failed to sync community memories: ${error.message}`);
    }
  }

  // Sync cookbook entries for a community
  async syncCookbookEntries(communityId: number) {
    try {
      // Get cookbook entries
      const cookbookEntries = await db
        .select()
        .from(cookbookEntries)
        .where(eq(cookbookEntries.community_id, communityId))
        .limit(50); // Limit to recent 50 entries

      let syncedCount = 0;

      for (const entry of cookbookEntries) {
        try {
          // Convert cookbook entry to recipe format
          const recipe = this.convertCookbookEntry(entry);

          await this.memoryEngine.storeCookbookRecipe(
            `community_${communityId}`,
            recipe
          );

          syncedCount++;
        } catch (entryError) {
          console.warn('[COOKBOOK SYNC ITEM ERROR]', { entryId: entry.id, error: entryError.message });
        }
      }

      console.log('[COOKBOOK SYNC] Synced cookbook entries:', { communityId, syncedCount });

      return {
        synced: true,
        totalEntries: cookbookEntries.length,
        syncedCount,
        communityId
      };

    } catch (error) {
      console.error('[COOKBOOK SYNC ERROR]', { communityId, error: error.message });
      throw new Error(`Failed to sync cookbook entries: ${error.message}`);
    }
  }

  // Store recipe feedback from user interaction
  async storeRecipeFeedback(userId: string, recipeId: string, feedback: any) {
    try {
      // Create recipe object from feedback data
      const recipe = {
        id: recipeId,
        title: feedback.recipeTitle || feedback.title || 'Unknown Recipe',
        cuisine: feedback.cuisine || 'unknown',
        prepTime: feedback.prepTime,
        difficulty: feedback.difficulty,
        ingredients: feedback.ingredients || []
      };

      // Store feedback in mem0
      await this.memoryEngine.storeRecipeInteraction(userId, recipe, feedback);

      console.log('[RECIPE FEEDBACK] Stored feedback for user:', userId, { recipeId, rating: feedback.rating });

      return {
        stored: true,
        recipeId,
        userId,
        feedback: {
          rating: feedback.rating,
          liked: feedback.liked,
          modifications: feedback.modifications || 'none'
        }
      };

    } catch (error) {
      console.error('[RECIPE FEEDBACK ERROR]', { userId, recipeId, error: error.message });
      throw new Error(`Failed to store recipe feedback: ${error.message}`);
    }
  }

  // Store cultural preferences
  async storeCulturalPreferences(userId: string, culturalData: any) {
    try {
      await this.memoryEngine.storeCulturalPreference(userId, culturalData);

      console.log('[CULTURAL SYNC] Stored cultural preferences for user:', userId);

      return {
        stored: true,
        userId,
        preferences: culturalData
      };

    } catch (error) {
      console.error('[CULTURAL SYNC ERROR]', { userId, error: error.message });
      throw new Error(`Failed to store cultural preferences: ${error.message}`);
    }
  }

  // Sync recent chat history for context
  async syncRecentChats(userId: string, communityId: number, sessionId?: string) {
    try {
      let query = db
        .select()
        .from(chatMessages)
        .where(and(
          eq(chatMessages.community_id, communityId),
          eq(chatMessages.user_id, userId)
        ));

      if (sessionId) {
        query = query.where(eq(chatMessages.session_id, sessionId));
      }

      const recentMessages = await query
        .orderBy(desc(chatMessages.created_at))
        .limit(20); // Recent 20 messages

      let syncedPairs = 0;

      // Group messages into user-assistant pairs
      for (let i = 0; i < recentMessages.length - 1; i++) {
        const userMsg = recentMessages[i];
        const assistantMsg = recentMessages[i + 1];

        if (userMsg.role === 'user' && assistantMsg.role === 'assistant') {
          try {
            // Store legacy chat using cultural preferences method (simplified)
            await this.memoryEngine.storeCulturalPreference(userId, {
              preferredCuisines: ['general'],
              background: `Chat: ${userMsg.content.slice(0, 100)}`
            });
            syncedPairs++;
          } catch (msgError) {
            console.warn('[CHAT SYNC PAIR ERROR]', { error: msgError.message });
          }
        }
      }

      console.log('[CHAT SYNC] Synced chat history:', { userId, communityId, syncedPairs });

      return {
        synced: true,
        totalMessages: recentMessages.length,
        syncedPairs,
        communityId
      };

    } catch (error) {
      console.error('[CHAT SYNC ERROR]', { userId, communityId, error: error.message });
      throw new Error(`Failed to sync chat history: ${error.message}`);
    }
  }

  // Full sync for a user
  async fullUserSync(userId: string, communityId?: number) {
    try {
      const results = {
        profile: null,
        memories: null,
        chats: null,
        cookbook: null
      };

      // Sync profile
      results.profile = await this.syncUserProfile(userId);

      // If community specified, sync community-specific data
      if (communityId) {
        results.memories = await this.syncCommunityMemories(userId, communityId);
        results.chats = await this.syncRecentChats(userId, communityId);
        results.cookbook = await this.syncCookbookEntries(communityId);
      }

      console.log('[FULL SYNC] Completed for user:', userId, { communityId, results });

      return {
        success: true,
        userId,
        communityId,
        results,
        timestamp: Date.now()
      };

    } catch (error) {
      console.error('[FULL SYNC ERROR]', { userId, communityId, error: error.message });
      throw new Error(`Full sync failed: ${error.message}`);
    }
  }

  // Helper: Extract dietary restrictions (from existing memoryService logic)
  private extractDietaryRestrictions(profile: any): string[] {
    if (!profile) return [];

    const members: FamilyMember[] = Array.isArray(profile.members) ? profile.members : [];
    const merged = members.length ? mergeFamilyDietaryRestrictions(members) : [];
    if (merged.length) return merged;

    const direct = Array.isArray(profile.dietaryRestrictions) ? profile.dietaryRestrictions : [];
    const legacy = Array.isArray(profile.dietary_restrictions) ? profile.dietary_restrictions : [];
    const prefs = Array.isArray(profile.preferences) ? profile.preferences : [];
    const raw = [...direct, ...legacy, ...prefs];

    if (!raw.length) return [];

    const keywords = [
      "allerg", "intoleran", "free", "vegan", "vegetarian", "pescatarian", "keto", "paleo", "kosher", "halal", "diet",
      "gluten", "dairy", "lactose", "milk", "nut", "tree nut", "peanut", "soy", "sesame", "wheat", "fodmap",
      "shellfish", "fish", "seafood", "egg", "seed oil", "sugar-free", "low carb", "low sodium", "no ", "avoid "
    ];

    const normalized = raw
      .map((x: any) => String(x || "").trim())
      .filter(Boolean)
      .filter((s: string) => {
        const ls = s.toLowerCase();
        return keywords.some((k) => ls.includes(k));
      });

    return Array.from(new Set(normalized));
  }

  // Helper: Extract goals (from existing memoryService logic)
  private extractGoals(profile: any): string[] {
    const goalSet = new Set<string>();

    const addGoal = (value: any) => {
      const str = String(value || "").trim();
      if (!str) return;
      if (str.toLowerCase() === "weight-based planning") return;
      goalSet.add(str);
    };

    if (Array.isArray(profile.goals)) {
      profile.goals.forEach((g: any) => {
        const str = String(g || "").trim();
        if (!str || str.includes(":")) return;
        addGoal(str);
      });
    }

    addGoal(profile.primary_goal);

    return Array.from(goalSet).slice(0, 6);
  }

  // Helper: Convert legacy memory item
  private convertLegacyMemory(item: any): string | null {
    try {
      if (!item.content) return null;

      switch (item.memory_type) {
        case 'fact':
          return `Personal fact: ${item.content}`;
        case 'preference':
          return `Food preference: ${item.content}`;
        case 'summary':
          return `Summary: ${item.content}`;
        case 'note':
          return `Note: ${item.content}`;
        default:
          return `Memory: ${item.content}`;
      }
    } catch {
      return null;
    }
  }

  // Helper: Convert cookbook entry to recipe format
  private convertCookbookEntry(entry: any) {
    return {
      id: entry.id,
      title: entry.title || 'Untitled Recipe',
      cuisine: entry.cuisine || 'international',
      content: entry.content || '',
      instructions: entry.content || '',
      ingredients: this.extractIngredients(entry.content),
      prepTime: 'unknown',
      difficulty: 'medium',
      dietaryTags: [],
      imageUrl: entry.image_url || null
    };
  }

  // Helper: Extract ingredients from content
  private extractIngredients(content: string): string[] {
    try {
      // Simple extraction - look for bullet points, numbers, or common ingredient patterns
      const lines = content.split('\n');
      const ingredients = lines
        .filter(line => line.match(/^[-•*]\s|^\d+\.?\s|ingredients:/i))
        .map(line => line.replace(/^[-•*]\s|^\d+\.?\s|ingredients:/i, '').trim())
        .filter(Boolean);

      return ingredients.slice(0, 20); // Limit to 20 ingredients
    } catch {
      return [];
    }
  }
}

export const profileSyncService = new ProfileSyncService();