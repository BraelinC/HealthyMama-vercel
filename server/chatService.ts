import { db } from "./db";
import { and, asc, desc, eq } from "drizzle-orm";
import OpenAI from "openai";
import {
  chatSessions,
  chatMessages,
  communityAIConfigs,
  communityMembers,
} from "@shared/schema";
import { memoryService } from "./memoryService";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
// Basic startup diagnostics (no secrets)
(() => {
  const key = process.env.OPENAI_API_KEY || "";
  console.log("[AI INIT] OPENAI_API_KEY present:", Boolean(key), "len:", key.length);
})();

// Rough token estimator (chars/4). Good enough for dynamic completion sizing.
function estimateTokens(text: string | undefined | null): number {
  const s = (text || "").trim();
  if (!s) return 0;
  return Math.ceil(s.length / 4);
}

function extractResponseText(resp: any): string {
  if (!resp) return "";
  if (typeof (resp as any).output_text === "string" && (resp as any).output_text.trim()) {
    return (resp as any).output_text.trim();
  }
  try {
    const parts: string[] = [];
    const output = (resp as any).output || (resp as any).response?.output || [];
    if (Array.isArray(output)) {
      for (const msg of output) {
        const content = (msg as any)?.content || [];
        if (Array.isArray(content)) {
          for (const c of content) {
            if (typeof c === "string" && c.trim()) parts.push(c);
            else if (typeof (c as any)?.text === "string" && (c as any).text.trim()) parts.push((c as any).text);
            else if (typeof (c as any)?.value === "string" && (c as any).value.trim()) parts.push((c as any).value);
          }
        } else if (typeof content === "string" && content.trim()) {
          parts.push(content);
        }
      }
    }
    return parts.join("\n").trim();
  } catch {
    return "";
  }
}

async function generateWithResponsesAPI(params: {
  model: string;
  systemPrompt: string;
  userMessage: string;
  maxOutputTokens: number;
  useLowReasoning: boolean;
}): Promise<{ text: string; lastRaw?: any }> {
  const { model, systemPrompt, userMessage, maxOutputTokens, useLowReasoning } = params;
  let aggregated = "";
  let attempt = 0;
  const maxAttempts = 3;
  let lastRaw: any;
  let promptForUser = userMessage;

  while (attempt < maxAttempts) {
    attempt++;
    const body: any = {
      model,
      input: [
        { role: 'system', content: [{ type: 'input_text', text: `Respond in plain text only.\n\n${systemPrompt}` }] },
        { role: 'user', content: [{ type: 'input_text', text: promptForUser }] },
      ],
      max_output_tokens: Math.max(64, Math.min(maxOutputTokens, 8192)),
    };
    if (useLowReasoning) body.reasoning = { effort: 'low' as const };

    const resp: any = await openai.responses.create(body);
    lastRaw = resp;
    const chunk = extractResponseText(resp);
    if (chunk) aggregated += (aggregated ? "\n" : "") + chunk;

    const status = resp?.status;
    const incompleteReason = resp?.incomplete_details?.reason;
    console.log('[RESPONSES DEBUG]', { attempt, status, incompleteReason, appended: chunk?.length || 0 });

    if (status !== 'incomplete') break;

    // Ask to continue if truncated
    promptForUser = "Continue the previous answer from where you stopped. Output plain text only.";
  }

  return { text: aggregated.trim(), lastRaw };
}

export class ChatService {
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
        system_prompt: "You are a helpful assistant for this community.",
        model: "gpt-4o-mini",
        temperature: 0.7,
        max_tokens: 800,
        top_p: 1.0,
        memory_enabled: true,
        short_term_limit: 20,
        tools: [],
      }
    );
  }

  buildSystemPrompt(
    cfg: any,
    ctx: { facts: any[]; cookbook: any[]; profileSummary?: { dietaryRestrictions?: string[]; goals?: string[] } }
  ) {
    let prompt = cfg.system_prompt + "\n\n";
    if (ctx.facts?.length) {
      prompt += "User facts:\n";
      ctx.facts.forEach((f: any) => (prompt += `- ${f.content}\n`));
      prompt += "\n";
    }
    if (ctx.cookbook?.length) {
      prompt += "Community knowledge:\n";
      ctx.cookbook.slice(0, 5).forEach((e: any) => (prompt += `- ${e.title}: ${String(e.content).slice(0, 300)}\n`));
      prompt += "\n";
    }
    if (ctx.profileSummary) {
      const dr = (ctx.profileSummary.dietaryRestrictions || []).slice(0, 6);
      const goals = (ctx.profileSummary.goals || []).slice(0, 6);
      if (dr.length || goals.length) {
        prompt += "User Profile (strict):\n";
        if (dr.length) prompt += `- Dietary Restrictions (MANDATORY): ${dr.join(", ")}\n`;
        if (goals.length) prompt += `- Goals: ${goals.join(", ")}\n`;
        prompt += "\n";
      }
    }
    prompt += "If no exact match, adapt the closest base recipe to user intent, honoring mandatory dietary constraints.";
    return prompt;
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
    if (!s || s.user_id !== userId || s.community_id !== communityId) throw new Error("Forbidden");
    return db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.session_id, sessionId))
      .orderBy(asc(chatMessages.id));
  }

  async sendMessage(params: { userId: string; communityId: number; sessionId?: string; message: string }) {
    const { userId, communityId, message } = params;
    await this.assertMembership(userId, communityId);
    const sessionId = await this.ensureSession(userId, communityId, params.sessionId);

    const cfg = await this.getAIConfig(communityId);
    console.log('[CHAT CONFIG]', {
      communityId,
      model: cfg?.model,
      temperature: cfg?.temperature,
      top_p: cfg?.top_p,
      max_tokens: cfg?.max_tokens,
      memory_enabled: cfg?.memory_enabled,
      short_term_limit: cfg?.short_term_limit,
      system_prompt_len: (cfg?.system_prompt || '').length,
    });

    // persist user message
    await db.insert(chatMessages).values({
      session_id: sessionId,
      community_id: communityId,
      user_id: userId,
      role: "user",
      content: message,
    });
    console.log('[CHAT DB] stored user message', { sessionId, len: message.length });

    await memoryService.addShortTerm(sessionId, "user", message, cfg.short_term_limit ?? 20);
    await memoryService.extractAndSaveFacts(userId, communityId, message);

    const ctx = await memoryService.getContext(userId, communityId, sessionId, message);
    const systemPrompt = this.buildSystemPrompt(cfg, ctx);

    // For now, do NOT include prior context; only system + current user message
    const messages = [{ role: "system" as const, content: systemPrompt }, { role: "user" as const, content: message }];
    console.log('[CHAT MSGS]', {
      system_len: systemPrompt.length,
      user_len: message.length,
      preview_user: message.slice(0, 120)
    });

    const selectedModel = (cfg.model || "gpt-4o-mini").toString();
    const isGpt5 = selectedModel.toLowerCase().startsWith("gpt-5");

    const maxTokensRaw = typeof cfg.max_tokens === "number" ? cfg.max_tokens : 512;
    // Dynamic completion sizing: aim for 3-5x of prompt depending on system prompt size
    const systemTok = estimateTokens(systemPrompt);
    const userTok = estimateTokens(message);
    const promptTok = systemTok + userTok;
    const growthFactor = systemTok < 200 ? 5 : systemTok < 600 ? 4 : 3;
    const desiredCompletion = Math.max(64, Math.min(promptTok * growthFactor, 12000));
    const gpt5CompletionTokens = Math.max(64, Math.min(desiredCompletion, maxTokensRaw, 128000));
    const nonGpt5Max = Math.max(1, Math.min(maxTokensRaw, 16000));

    let response = "";
    try {
      // Unified SDK path for all models using Responses API with continuation
      const maxOut = isGpt5 ? gpt5CompletionTokens : nonGpt5Max;
      const { text, lastRaw } = await generateWithResponsesAPI({
        model: selectedModel,
        systemPrompt,
        userMessage: message,
        maxOutputTokens: maxOut,
        useLowReasoning: isGpt5,
      });
      response = text;
      console.log('[CHAT RAW TRUNCATED]', JSON.stringify(lastRaw).slice(0, 800));
      console.log('[CHAT AI DEBUG]', {
        model: selectedModel,
        isGpt5,
        len: response?.length ?? 0,
        preview: typeof response === 'string' ? response.slice(0, 160) : ''
      });
    } catch (error: any) {
      console.error("[CHAT AI ERROR]", {
        model: selectedModel,
        isGpt5,
        messagePreview: String(message).slice(0, 200),
        error: error?.message,
        data: error?.response?.data,
        status: error?.response?.status,
        stack: error?.stack
      });
      throw error;
    }

    await db.insert(chatMessages).values({
      session_id: sessionId,
      community_id: communityId,
      role: "assistant",
      content: response,
    });
    console.log('[CHAT DB] stored assistant message', { sessionId, len: response.length });

    await memoryService.addShortTerm(sessionId, "assistant", response, cfg.short_term_limit ?? 20);

    await db
      .update(chatSessions)
      .set({ last_message_at: new Date() })
      .where(eq(chatSessions.id, sessionId));

    return {
      sessionId,
      response,
      model: selectedModel,
      output_text: response,
      usedContext: { profileSummary: ctx.profileSummary },
    };
  }

  async previewResponse(params: { userId: string; communityId: number; message: string }) {
    const { userId, communityId, message } = params;
    // allow only community creator to preview
    const { db } = await import("./db");
    const { communities } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    const [comm] = await db.select().from(communities).where(eq(communities.id, communityId));
    if (!comm || comm.creator_id !== userId) throw new Error("Forbidden");

    const cfg = await this.getAIConfig(communityId);
    const ctx = await memoryService.getContext(
      userId,
      communityId,
      `preview-${userId}-${communityId}`,
      params.message
    );
    const systemPrompt = this.buildSystemPrompt(cfg, {
      facts: ctx.facts,
      cookbook: ctx.cookbook,
      profileSummary: ctx.profileSummary,
    });
    const messages = [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: message },
    ];
    const inputTextForGpt5 = `${systemPrompt}\n\nUser: ${message}`;

    const selectedModel = (cfg.model || "gpt-4o-mini").toString();
    const isGpt5 = selectedModel.toLowerCase().startsWith("gpt-5");

    const maxTokensRaw = typeof cfg.max_tokens === "number" ? cfg.max_tokens : 512;
    const systemTok = estimateTokens(systemPrompt);
    const userTok = estimateTokens(message);
    const promptTok = systemTok + userTok;
    const growthFactor = systemTok < 200 ? 5 : systemTok < 600 ? 4 : 3;
    const desiredCompletion = Math.max(64, Math.min(promptTok * growthFactor, 12000));
    const gpt5CompletionTokens = Math.max(64, Math.min(desiredCompletion, maxTokensRaw, 128000));
    const nonGpt5Max = Math.max(1, Math.min(maxTokensRaw, 16000));

    let response = "";
    if (isGpt5) {
      const { text, lastRaw } = await generateWithResponsesAPI({
        model: selectedModel,
        systemPrompt,
        userMessage: message,
        maxOutputTokens: gpt5CompletionTokens,
        useLowReasoning: true,
      });
      response = text;
      console.log('[CHAT RAW PREVIEW TRUNCATED]', JSON.stringify(lastRaw).slice(0, 800));
    } else {
      const { text, lastRaw } = await generateWithResponsesAPI({
        model: selectedModel,
        systemPrompt,
        userMessage: message,
        maxOutputTokens: nonGpt5Max,
        useLowReasoning: false,
      });
      response = text;
      console.log('[CHAT RAW PREVIEW TRUNCATED]', JSON.stringify(lastRaw).slice(0, 800));
    }
    console.log('[CHAT AI DEBUG][preview]', {
      model: selectedModel,
      isGpt5,
      len: response?.length ?? 0,
      preview: typeof response === 'string' ? response.slice(0, 160) : ''
    });
    return { response, model: selectedModel, output_text: response, usedContext: { profileSummary: ctx.profileSummary } };
  }
}

export const chatService = new ChatService();
