---
Task ID: 2
Agent: Main Agent
Task: Phase 2 — Proactive Intelligence Engine implementation

Work Log:
- Explored full Convex schema (40+ tables), existing crons (7 jobs), AI infrastructure (agents, embeddings, conversations)
- Created `convex/proactive.ts` — Proactive Intelligence Engine with:
  - Deadline Scanner (cron every 6h): scans tasks, events, service charges for overdue/upcoming deadlines
  - Anomaly Detector (daily 6AM UTC): detects stalled matters, unassigned matters, high defaulter ratios, unread messages
  - AI Morning Briefing (daily 6:15AM UTC): generates AI-powered briefing per firm stored as both insight + ARIA conversation
  - Queries: getInsights, getLatestBriefing, getInsightCounts
  - Mutations: dismissInsight, dismissAllInsights
  - Deduplication via deterministic dedupKey per entity+date
- Created `convex/conversationMemory.ts` — Cross-Session Conversation Memory with:
  - AI-powered conversation summarization (Gemini 2.0 Flash, JSON structured output)
  - Nightly batch summarization cron (11PM UTC)
  - Context injection query (getInjectionContext) for new ARIA sessions
  - Per-user, per-firm memory storage with topic extraction
- Added 2 new schema tables to `convex/schema.ts`:
  - `proactive_insights` — deadline/anomaly/briefing findings with dedup
  - `conversation_summaries` — compressed conversation memory
- Updated `convex/crons.ts` with 4 new cron jobs:
  - scanDeadlines (every 6h)
  - detectAnomalies (daily 6AM UTC)
  - generateMorningBriefing (daily 6:15AM UTC)
  - batchSummarizeConversations (daily 11PM UTC)
- Updated `src/agents/AgencyHub.ts`:
  - Added `conversationMemoryContext` and `proactiveInsights` parameters to getSystemInstruction
  - Injects URGENT ALERTS and Active Warnings into ARIA system prompt
  - Injects conversation memory for cross-session continuity
- Updated `src/services/geminiService.ts`:
  - Both sendMessage and streamMessage now accept conversationMemoryContext + proactiveInsights
  - Passes through to AgencyHub's getSystemInstruction
- Updated `src/services/aiService.ts`:
  - Context type now uses Parameters<typeof geminiService.sendMessage>[1] for consistency
- Updated `src/components/aloa/AloaChat.tsx`:
  - Added useQuery hooks for conversation memory and proactive insights
  - Passes memory + insights through aiContext to AI calls
  - Added Proactive Insight Badges UI in empty chat state (Urgent/Warning/Briefing Ready)
- Updated `src/components/aloa/MiniAloa.tsx`:
  - Added null placeholder fields for conversationMemoryContext and proactiveInsights
- Convex deployment successful (local)

Stage Summary:
- Phase 2 Proactive Intelligence Engine is fully implemented
- ARIA is now proactive: scans deadlines, detects anomalies, generates daily briefings
- Cross-session memory: ARIA can reference past conversations naturally
- Morning briefings appear as ARIA conversations with ☀️ indicator
- No multi-model routing as per user instruction
