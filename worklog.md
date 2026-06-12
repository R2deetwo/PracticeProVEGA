---
Task ID: 1
Agent: Main Agent
Task: Redesign unit card UX - fix cog menu overflow, compact expanded card, plan Quit Notice automation

Work Log:
- Analyzed two user screenshots showing: (1) cog menu with 6+ items, (2) expanded unit card taking 60-70% of viewport height with menu cut off at bottom
- Read PropertyDetailView.tsx (~1732 lines) to understand current unit card + cog menu implementation
- Identified root cause of menu cutoff: hardcoded estimatedMenuHeight=340, no actual measurement, no flip logic
- Identified root cause of tall expanded card: full metadata grid + messaging panel + action buttons = 400+px

Changes Implemented:
1. Smart cog menu positioning: Added useEffect that measures actual rendered menu height via ref, auto-flips upward if it overflows viewport bottom, auto-shifts rightward if it overflows left edge. Added unitMenuInnerRef for measurement.
2. Two-tier unit card design: Tier 1 is a compact quick-action bar (~40px) with Pay, Demand, Message, Edit, and More buttons. Tier 2 (shown on "More" click) reveals full metadata + secondary actions (Quit Notice, Legal File, Ledger Entry, etc.).
3. Reset showFullUnitDetail state on card click/deselect.

Automation Plan Presented (not yet implemented):
- Quit Notice → Mark Served → Mark Delivered → Auto-schedule 7-Day Notice → Auto-generate draft
- New data model: evictionTracker on unit record
- Convex cron for scheduled 7-Day Notice generation
- Context-sensitive action buttons based on eviction status

Stage Summary:
- PropertyDetailView.tsx: 1732 → 1796 lines (net +64, mainly from two-tier structure)
- Build passes, TypeScript clean, braces/parens balanced
- Git commit: b205943
- Quit Notice automation plan presented for user review before implementation
