/**
 * noteDictation.ts — AI-powered transcript cleaning for Vega (legal) dictation.
 *
 * Vega mode (dual-output):
 *   1. Web Speech API produces a RAW transcript (verbatim, never edited)
 *   2. This action sends the raw transcript to Gemini with a legal-grade
 *      cleanup prompt: remove filler words, fix false starts, structure into
 *      paragraphs, correct obvious recognition errors — but preserve legal
 *      terminology, names, and technical terms verbatim.
 *   3. The CLEANED version is stored alongside the RAW version in notePages.
 *      The user can toggle between them. The raw is the source of truth
 *      for any dispute about what was actually said.
 *
 * Atrium mode (single-pass): no cleaning pass — property notes are
 * lighter-weight and don't need the dual-output ceremony.
 */

import { action, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireFirmUser } from "./authHelpers";

// ─── AI CLEANUP ACTION (Vega only) ────────────────────────────────────────
// Calls Gemini to produce a cleaned version of the raw transcript.
// The prompt is specifically calibrated for Nigerian legal dictation:
//   - Preserve case names, court names, statutory references verbatim
//   - Fix common Web Speech API recognition errors on Nigerian names
//   - Structure into paragraphs but DON'T add content the user didn't say
//   - Flag (don't silently fix) ambiguous terms

export const cleanTranscript = action({
  args: {
    rawTranscript: v.string(),
    firmGeminiApiKey: v.optional(v.string()),
    // contextHint helps Gemini make better cleanup decisions. E.g. "matter
    // note" vs "client meeting" vs "court hearing observation"
    contextHint: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const envKey = process.env.GEMINI_API_KEY || process.env.GEMINI_DEMO_KEY;
    const apiKey = args.firmGeminiApiKey || envKey;
    if (!apiKey) {
      throw new Error("No API key available. Please configure the firm's AI key in Settings → AI.");
    }

    const systemInstruction = `You are a legal-grade transcript cleaner for Nigerian legal practice. Your job is to take a raw speech-to-text transcript and produce a clean, readable version while preserving the speaker's exact meaning.

RULES:
1. Remove filler words and false starts (um, uh, "you know", "I mean", repeated words like "the the").
2. Fix obvious Web Speech API recognition errors on common Nigerian names (e.g., "Chidi" not "Chiddy", "Barrister" not "Barister").
3. Preserve legal terminology VERBATIM: case names, statute sections, court names (Federal High Court, Court of Appeal, Supreme Court, Magistrate Court, etc.), Latin legal terms.
4. Structure into paragraphs where there are clear topic transitions, but don't add headings the speaker didn't say.
5. NEVER add content the speaker didn't say. If something is ambiguous, leave it as-is rather than guessing.
6. Preserve Nigerian English spellings (e.g., "judgement" not "judgment").
7. Don't correct grammatical errors — preserve the speaker's voice. Only clean recognition artifacts.
8. Return ONLY the cleaned transcript, no commentary, no preamble.

${args.contextHint ? `CONTEXT: This is a ${args.contextHint}.` : ""}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const body = {
      contents: [{
        role: 'user',
        parts: [{ text: `Clean this transcript:\n\n${args.rawTranscript}` }],
      }],
      systemInstruction: { parts: [{ text: systemInstruction }] },
      generationConfig: {
        temperature: 0.1,  // Low temp — we want deterministic cleanup, not creative rewriting
        maxOutputTokens: Math.min(8192, args.rawTranscript.length * 4),  // ~4x raw length max
      },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[cleanTranscript] Gemini API error:', res.status, errText);
      throw new Error(`AI cleanup failed: ${res.status}. Raw transcript preserved — you can edit manually or retry.`);
    }

    const data: any = await res.json();
    const cleaned = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!cleaned) {
      throw new Error('AI cleanup returned no text. Raw transcript preserved — you can edit manually or retry.');
    }
    return cleaned.trim();
  },
});

// ─── SAVE TRANSCRIPT MUTATION ─────────────────────────────────────────────
// Persists the raw + cleaned transcripts to the notePage. Called after
// dictation ends (Vega mode) or after the user manually triggers a cleanup
// pass on an existing note.

export const saveTranscripts = mutation({
  args: {
    noteId: v.id("notePages"),
    sessionToken: v.optional(v.string()),
    rawTranscript: v.string(),
    cleanedTranscript: v.optional(v.string()),
    dictationMode: v.string(),  // 'vega_dual' | 'atrium_single'
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const note: any = await ctx.db.get(args.noteId);
    if (!note) throw new Error("Note not found");
    if (note.firmId !== auth.firmId) throw new Error("Not authorized");

    await ctx.db.patch(args.noteId, {
      rawTranscript: args.rawTranscript,
      cleanedTranscript: args.cleanedTranscript || null,
      dictationMode: args.dictationMode,
      updatedAt: new Date().toISOString(),
    });
  },
});
