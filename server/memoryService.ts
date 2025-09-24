import { db } from "./db";
import { and, desc, eq } from "drizzle-orm";
import {
  communityMemoryItems,
  cookbookEntries,
  chatMessages,
  profiles,
  mergeFamilyDietaryRestrictions,
  type FamilyMember,
} from "@shared/schema";

type ShortMsg = { role: string; content: string; timestamp: number };

export class MemoryService {
  private shortTermBySession = new Map<string, ShortMsg[]>();

  async addShortTerm(sessionId: string, role: string, content: string, limit = 20) {
    const list = this.shortTermBySession.get(sessionId) || [];
    list.push({ role, content, timestamp: Date.now() });
    if (list.length > limit) list.shift();
    this.shortTermBySession.set(sessionId, list);
  }

  async extractAndSaveFacts(userId: string, communityId: number, text: string) {
    const patterns = [
      { type: "name", re: /my name is (\w+)/i },
      { type: "preference", re: /i (like|love|prefer|hate|dislike) (.+)/i },
      { type: "age", re: /i am (\d+) years old/i },
      { type: "location", re: /i live in (.+)/i },
      { type: "job", re: /i work as (.+)/i },
    ];
    const toInsert: { memory_type: string; content: string }[] = [];
    for (const p of patterns) {
      const m = text.match(p.re);
      if (m) {
        const value = m[1] ?? m[2];
        if (value) toInsert.push({ memory_type: "fact", content: `${p.type}:${value}` });
      }
    }
    if (toInsert.length) {
      await db.insert(communityMemoryItems).values(
        toInsert.map((f) => ({
          user_id: userId,
          community_id: communityId,
          memory_type: f.memory_type,
          content: f.content,
        }))
      );
    }
  }

  async getContext(userId: string, communityId: number, sessionId: string, query: string, k = 5) {
    const shortTerm = this.shortTermBySession.get(sessionId) || [];

    const facts = await db
      .select()
      .from(communityMemoryItems)
      .where(and(eq(communityMemoryItems.user_id, userId), eq(communityMemoryItems.community_id, communityId)))
      .limit(50);

    const cookbook = await db
      .select()
      .from(cookbookEntries)
      .where(eq(cookbookEntries.community_id, communityId))
      .limit(10);

    const longTerm = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.community_id, communityId))
      .orderBy(desc(chatMessages.id))
      .limit(k);

    // Build profile summary: only dietary restrictions + goals
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.user_id, userId))
      .limit(1);

    function extractDietaryRestrictions(p: any): string[] {
      if (!p) return [];
      const members: FamilyMember[] = Array.isArray(p.members) ? p.members : [];
      const merged = members.length ? mergeFamilyDietaryRestrictions(members) : [];
      if (merged.length) return merged;

      const direct = Array.isArray((p as any).dietaryRestrictions) ? (p as any).dietaryRestrictions : [];
      const legacy = Array.isArray((p as any).dietary_restrictions) ? (p as any).dietary_restrictions : [];
      const prefs = Array.isArray(p.preferences) ? p.preferences : [];
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
    const goalSet = new Set<string>();
    const addGoal = (value: any) => {
      const str = String(value || "").trim();
      if (!str) return;
      if (str.toLowerCase() === "weight-based planning") return;
      goalSet.add(str);
    };

    if (Array.isArray((profile as any)?.goals)) {
      (profile as any).goals.forEach((g: any) => {
        const str = String(g || "").trim();
        if (!str || str.includes(":")) return;
        addGoal(str);
      });
    }

    addGoal((profile as any)?.primary_goal);

    const profileSummary = profile
      ? {
          profileName: (profile as any).profile_name || "",
          dietaryRestrictions: extractDietaryRestrictions(profile),
          goals: Array.from(goalSet).slice(0, 6),
        }
      : { profileName: "", dietaryRestrictions: [], goals: [] };

    return { shortTerm, facts, cookbook, longTerm, profileSummary };
  }
}

export const memoryService = new MemoryService();



