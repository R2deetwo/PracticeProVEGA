import { internalMutation, internalAction, internalQuery, query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// ─────────────────────────────────────────────────────────────────────────────
// CONVERSATION MEMORY — Phase 2
//
// Cross-session conversation memory for ARIA. This module:
//
//   1. COMPRESSes long conversations into structured summaries (AI-generated)
//   2. STOREs summaries in `conversation_summaries` table per firm+user
//   3. INJECTS relevant past context when a new conversation starts
//   4. Runs on a nightly cron to compress conversations older than 24h
//
// Architecture:
//   ┌──────────────────┐     ┌─────────────────────┐
//   │ aloaConversations │────▶│ conversation_       │
//   │ (full messages)   │     │ summaries (compact) │
//   └──────────────────┘     └─────────────────────┘
//          │                          │
//          │ (after compression)      │ (injected into new sessions)
//          ▼                          ▼
//   Messages remain for detail    Summary provides continuity
// ─────────────────────────────────────────────────────────────────────────────

// ─── QUERIES ────────────────────────────────────────────────────────────────

/** Get all summaries for a user, newest first. */
export const getSummaries = query({
  args: {
    firmId: v.string(),
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { firmId, userId, limit }) => {
    return await ctx.db
      .query("conversation_summaries")
      .withIndex("by_firm_user", (q) => q.eq("firmId", firmId).eq("userId", userId))
      .order("desc")
      .take(limit ?? 20);
  },
});

/** Get recent summaries for context injection (last 5 conversations). */
export const getRecentContextSummaries = query({
  args: {
    firmId: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, { firmId, userId }) => {
    const summaries = await ctx.db
      .query("conversation_summaries")
      .withIndex("by_firm_user", (q) => q.eq("firmId", firmId).eq("userId", userId))
      .order("desc")
      .take(5);

    // Return a compact format suitable for system instruction injection
    return summaries.map((s) => ({
      title: s.title,
      summary: s.summary,
      keyTopics: s.keyTopics,
      createdAt: s.createdAt,
    }));
  },
});

/** Get the raw context string for injection into a new ARIA session. */
export const getInjectionContext = query({
  args: {
    firmId: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, { firmId, userId }) => {
    const summaries = await ctx.db
      .query("conversation_summaries")
      .withIndex("by_firm_user", (q) => q.eq("firmId", firmId).eq("userId", userId))
      .order("desc")
      .take(5);

    if (summaries.length === 0) return null;

    const lines = summaries.map((s, i) => {
      const date = new Date(s.createdAt).toLocaleDateString("en-NG", {
        day: "numeric",
        month: "short",
      });
      const topics = s.keyTopics?.length ? `Topics: ${s.keyTopics.join(", ")}` : "";
      return `${i + 1}. [${date}] ${s.title} — ${s.summary}${topics ? ` (${topics})` : ""}`;
    });

    return `PREVIOUS CONVERSATION MEMORY (recent sessions):
The user has had these recent conversations with you. Use this context to maintain continuity and avoid asking questions already answered.

${lines.join("\n")}

INSTRUCTION: If the user references something from a previous session, use this memory. Do NOT explicitly say "based on my memory" — just naturally incorporate the context.`;
  },
});

/** Get conversations that need summarization (no summary yet, older than 24h). */
export const getUnsummarizedConversations = internalQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const cutoff = Date.now() - 24 * 3600000; // 24 hours ago
    const conversations = await ctx.db
      .query("aloaConversations")
      .order("desc")
      .take(limit ?? 100);

    const unsummarized = [];
    for (const convRaw of conversations) {
      const conv = convRaw as any;
      // Skip system/proactive engine conversations
      if (conv.userId === "proactive_engine") continue;
      if (conv.createdAt < cutoff) {
        // Check if already summarized
        const existing = await ctx.db
          .query("conversation_summaries")
          .withIndex("by_conversation", (q) =>
            q.eq("conversationId", convRaw._id as string)
          )
          .first();
        if (!existing) {
          unsummarized.push(convRaw);
        }
      }
      if (unsummarized.length >= (limit ?? 50)) break;
    }
    return unsummarized;
  },
});

// ─── MUTATIONS ──────────────────────────────────────────────────────────────

/** Store a conversation summary. */
export const storeSummary = internalMutation({
  args: {
    conversationId: v.string(),
    firmId: v.string(),
    userId: v.string(),
    title: v.string(),
    summary: v.string(),
    keyTopics: v.array(v.string()),
    actionItems: v.optional(v.array(v.string())),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("conversation_summaries", {
      conversationId: args.conversationId,
      firmId: args.firmId,
      userId: args.userId,
      title: args.title,
      summary: args.summary,
      keyTopics: args.keyTopics,
      actionItems: args.actionItems ?? [],
      createdAt: args.createdAt,
    });
  },
});

/** Manually trigger a summary for a specific conversation. */
export const summarizeConversation = internalAction({
  args: {
    conversationId: v.string(),
  },
  handler: async (ctx, { conversationId }) => {
    // 1. Fetch the conversation
    const convRaw = await ctx.runQuery(internal.conversationMemory.getConversation, {
      conversationId,
    });
    if (!convRaw) throw new Error("Conversation not found");

    // Cast to aloaConversations type — the generic return includes all table types
    const conv = convRaw as any;

    // Skip proactive engine conversations
    if (conv.userId === "proactive_engine") {
      return { skipped: true };
    }

    // 2. Fetch messages
    const messages = await ctx.runQuery(internal.conversationMemory.getConversationMessages, {
      conversationId,
    });

    if (messages.length < 3) {
      // Too short to summarize meaningfully
      return { skipped: true, reason: "Too few messages" };
    }

    // 3. Build the summarization prompt
    const messageLog = messages
      .map((m: any) => {
        const role = m.role === "user" ? "User" : "ARIA";
        const content = m.content || m.text || "";
        if (content.length > 500) {
          return `${role}: ${content.substring(0, 500)}...`;
        }
        return `${role}: ${content}`;
      })
      .join("\n");

    const prompt = `Summarize this ARIA conversation in a structured format. The conversation is from PracticePro, a Nigerian legal/property management platform.

CONVERSATION:
${messageLog}

Return ONLY a JSON object with these fields:
{
  "title": "Short descriptive title (max 60 chars)",
  "summary": "2-3 sentence summary of what was discussed and decided",
  "keyTopics": ["topic1", "topic2", "topic3"],
  "actionItems": ["action1", "action2"]  // any tasks or follow-ups mentioned, or empty array
}

Be specific — include names, matter titles, amounts, or deadlines that were discussed. Do not use generic descriptions.`;

    // 4. Call AI
    const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_DEMO_KEY;
    if (!apiKey) throw new Error("No API key for summarization");

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 512,
            response_mime_type: "application/json",
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`AI summarization failed: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      throw new Error("AI returned empty response");
    }

    // Parse the JSON response
    let parsed: any;
    try {
      // Strip markdown code fences if present
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // Fallback: use the raw content as the summary
      parsed = {
        title: conv.title || "Conversation Summary",
        summary: content.substring(0, 300),
        keyTopics: [],
        actionItems: [],
      };
    }

    // 5. Store the summary
    await ctx.runMutation(internal.conversationMemory.storeSummary, {
      conversationId,
      firmId: conv.firmId,
      userId: conv.userId,
      title: parsed.title || conv.title || "Conversation Summary",
      summary: parsed.summary || "No summary available.",
      keyTopics: Array.isArray(parsed.keyTopics) ? parsed.keyTopics.slice(0, 8) : [],
      actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems.slice(0, 5) : [],
      createdAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * NIGHTLY BATCH SUMMARIZATION (cron)
 * Compresses all unsummarized conversations older than 24 hours.
 */
export const batchSummarize = internalAction({
  args: {},
  handler: async (ctx) => {
    const unsummarized = await ctx.runQuery(
      internal.conversationMemory.getUnsummarizedConversations,
      { limit: 50 }
    );

    let summarized = 0;
    let errors = 0;

    for (const conv of unsummarized) {
      try {
        const result = await ctx.runAction(
          internal.conversationMemory.summarizeConversation,
          { conversationId: conv._id as string }
        );
        if (!(result as any)?.skipped) {
          summarized++;
        }
      } catch (err) {
        console.error(`[Memory] Failed to summarize ${conv._id}:`, err);
        errors++;
      }
    }

    console.log(
      `[Memory] Batch summarization complete: ${summarized} summarized, ${errors} errors, ${unsummarized.length - summarized - errors} skipped.`
    );
    return { summarized, errors };
  },
});

// ─── HELPER QUERIES (called by actions) ─────────────────────────────────────

export const getConversation = internalQuery({
  args: { conversationId: v.string() },
  handler: async (ctx, { conversationId }) => {
    return await ctx.db.get(conversationId as any);
  },
});

export const getConversationMessages = internalQuery({
  args: { conversationId: v.string() },
  handler: async (ctx, { conversationId }) => {
    return await ctx.db
      .query("aloaMessages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .order("asc")
      .take(200);
  },
});
