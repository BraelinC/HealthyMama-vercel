import { db } from "./db";
import { and, desc, eq } from "drizzle-orm";
import {
  communityMemoryItems,
  cookbookEntries,
  chatMessages,
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

    return { shortTerm, facts, cookbook, longTerm };
  }
}

export const memoryService = new MemoryService();



