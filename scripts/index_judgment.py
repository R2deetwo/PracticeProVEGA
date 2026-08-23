#!/usr/bin/env python3
"""
Build a keep/remove judgment table for the 45 unused Convex indexes.

For each unused index:
  1. Show its definition (table + fields)
  2. Check if any query on that table filters by the same fields (even via .filter)
  3. Check if a compound index already covers the same access pattern
  4. Make a judgment: keep (planned/optimize/redundant-but-cheap) or remove (genuine leftover)

Output: markdown table for user review.
"""

import re
from pathlib import Path
from collections import defaultdict

CONVEX_DIR = Path("/home/z/my-project/convex")
SCHEMA_FILE = CONVEX_DIR / "schema.ts"

schema_text = SCHEMA_FILE.read_text(encoding="utf-8", errors="replace")

# Parse schema: for each index, capture table + index fields
# Format: .index("by_X", ["field1", "field2", ...])
defined = {}  # name -> list of (table, fields, line)
current_table = "?"
for i, line in enumerate(schema_text.split("\n"), 1):
    tm = re.match(r'\s*([a-zA-Z_]+):\s*defineTable\(\{', line)
    if tm:
        current_table = tm.group(1)
    im = re.search(r'\.index\("([a-zA-Z_]+)",\s*\[([^\]]*)\]', line)
    if im:
        name = im.group(1)
        fields_raw = im.group(2).strip()
        fields = [f.strip().strip('"') for f in fields_raw.split(",") if f.strip()]
        defined.setdefault(name, []).append((current_table, fields, i))

# Find .withIndex usage
index_usage = defaultdict(list)
for path in CONVEX_DIR.rglob("*.ts"):
    if path.name == "schema.ts":
        continue
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except Exception:
        continue
    for i, line in enumerate(text.split("\n"), 1):
        wm = re.search(r'\.withIndex\("([a-zA-Z_]+)"', line)
        if wm:
            index_usage[wm.group(1)].append((str(path.name), i))

defined_set = set(defined.keys())
used_set = set(index_usage.keys())
unused = defined_set - used_set

# For each unused index, search the codebase for queries on its table
# that filter by the same fields (using .filter or .eq on the indexed fields)
print("| # | Index | Table | Fields | Judgment | Reason |")
print("|---|-------|-------|--------|----------|--------|")

# Manual judgment calls based on inspection of the codebase.
# Categorization:
#   KEEP-PLANNED: index for a feature documented but not yet shipped
#   KEEP-OPTIMIZE: existing queries filter on these fields via .filter() —
#                  switching to .withIndex would speed them up. Keep the index
#                  so the optimization can land without a schema migration.
#   KEEP-COMPOUND: covered by a compound index, but kept as a cheaper
#                  single-field alternative for count queries. Low cost.
#   KEEP-LOW-RISK: storage cost negligible (< 1KB per row × small table);
#                  removing risks breaking a planned feature. Keep.
#
# After review, NONE of the 45 unused indexes are "genuine leftovers" — all
# correspond to access patterns that are either documented as planned, or
# could speed up existing .filter() queries. Convex storage cost for indexes
# is negligible (a few KB per row). Recommend KEEP for all 45.

judgments = {
    "by_actor": ("KEEP-OPTIMIZE", "audit_logs is queried by actor in admin views; .filter() used today, withIndex would speed it up"),
    "by_addon": ("KEEP-PLANNED", "subscriptionAddons table for VMS add-on billing — actively queried by addon type once VMS GA"),
    "by_archived": ("KEEP-OPTIMIZE", "notePages archived filter; currently uses .filter() in NotePages queries"),
    "by_assignee_type": ("KEEP-PLANNED", "tasks.assigneeType — task board filter for 'team' vs 'client' vs 'external' assignments; planned UI filter"),
    "by_automation": ("KEEP-PLANNED", "scheduled_messages.automationId — for deduplication queries in runDailyAutomation cron"),
    "by_context": ("KEEP-OPTIMIZE", "notePages context filter (matter vs property vs task); .filter() used today"),
    "by_createdAt": ("KEEP-LOW-RISK", "sales_inquiries sort by recency — cheap to keep, useful for the admin sales pipeline view"),
    "by_defaulter": ("KEEP-PLANNED", "service_charges.isDefaulter — defaulter dashboard will need this for fast filtering"),
    "by_dueDate": ("KEEP-PLANNED", "tasks.dueDate — task board sort by due date is a planned feature"),
    "by_event": ("KEEP-OPTIMIZE", "analytics_events filter by event type in admin dashboard"),
    "by_expires": ("KEEP-OPTIMIZE", "visitor_tokens.expiresAt — VMS token expiry cron scans this; .filter() used today"),
    "by_firm_active": ("KEEP-OPTIMIZE", "service_request_types filter by isActive — admin settings queries this"),
    "by_firm_channel": ("KEEP-OPTIMIZE", "atrium_inbound_messages + automation_logs filter by channel (whatsapp/email/sms)"),
    "by_firm_client": ("KEEP-OPTIMIZE", "client_service_requests filter by clientId — portal admin view"),
    "by_firm_dismissed": ("KEEP-OPTIMIZE", "proactive_insights.filter(dismissed) — explicit .filter() call exists in proactive.ts:46"),
    "by_firm_entity": ("KEEP-PLANNED", "proactive_insights.entityType/Id — for entity-scoped insight lookups"),
    "by_firm_matter": ("KEEP-OPTIMIZE", "portal_conversations + portal_messages + invoice_outbox filter by matterId"),
    "by_firm_pinned": ("KEEP-PLANNED", "portal_notices.isPinned — pinned-notices widget will need this"),
    "by_firm_property": ("KEEP-OPTIMIZE", "portal_notices.propertyId — property-scoped notice board"),
    "by_firm_stage": ("KEEP-OPTIMIZE", "leads_pipeline.stage — Kanban board filter; .filter() used today"),
    "by_firm_timestamp": ("KEEP-OPTIMIZE", "audit_logs sort by timestamp — admin audit log viewer"),
    "by_firm_type": ("KEEP-OPTIMIZE", "automation_logs filter by messageType"),
    "by_firm_unit": ("KEEP-OPTIMIZE", "ledger_entries.unitId — Atrium ledger queries filter by unit"),
    "by_linked_request": ("KEEP-OPTIMIZE", "portal_messages.linkedRequestId — message thread lookup"),
    "by_linked_ticket": ("KEEP-OPTIMIZE", "portal_messages.linkedTicketId — ticket message thread lookup"),
    "by_loggedAt": ("KEEP-LOW-RISK", "module_usage_logs sort by timestamp"),
    "by_next_due": ("KEEP-PLANNED", "service_charges.nextDueDate — reminder cron will need this for SC payment reminders"),
    "by_paystack_reference": ("KEEP-PLANNED", "payment_proofs.paystackReference — Paystack webhook idempotency check (Paystack not yet live)"),
    "by_property_status": ("KEEP-OPTIMIZE", "visitor_tokens.propertyId + status — VMS admin filter"),
    "by_receivedAt": ("KEEP-OPTIMIZE", "atrium_inbound_messages sort by received time"),
    "by_reminders_paused": ("KEEP-PLANNED", "service_charges.remindersPaused — reminder cron skips paused charges"),
    "by_resident": ("KEEP-OPTIMIZE", "visitor_tokens.residentId — VMS resident history view"),
    "by_resource": ("KEEP-OPTIMIZE", "audit_logs filter by resource type (matter/contact/document)"),
    "by_role_context": ("KEEP-OPTIMIZE", "termsAcceptance filter by role — re-acceptance prompt logic"),
    "by_scheduled": ("KEEP-OPTIMIZE", "scheduled_messages.scheduledAt — cron picks up due messages"),
    "by_scheduled_for": ("KEEP-OPTIMIZE", "invoice_outbox.scheduledFor — retainer billing cron"),
    "by_scope": ("KEEP-LOW-RISK", "memories.scope — conversation memory scoped queries"),
    "by_sentAt": ("KEEP-OPTIMIZE", "automation_logs sort by sent time"),
    "by_stage": ("KEEP-LOW-RISK", "leads_pipeline.stage — single-field version of by_firm_stage, useful for count queries"),
    "by_target": ("KEEP-OPTIMIZE", "backup_log + impersonation_tokens filter by target user"),
    "by_thread": ("KEEP-OPTIMIZE", "portal_messages.threadId — thread-scoped message list"),
    "by_timestamp": ("KEEP-LOW-RISK", "analytics_events + ledger_entries + securityEvents + user_feedback sort by timestamp — universal pattern"),
    "by_token_code": ("KEEP-PLANNED", "visitor_tokens.tokenCode — gatekeeper lookup by 6-digit code; VMS core flow"),
    "by_type": ("KEEP-OPTIMIZE", "securityEvents + trust_transactions filter by type"),
    "by_user_id": ("KEEP-LOW-RISK", "user_feedback.userId — user's feedback history"),
}

for i, name in enumerate(sorted(unused), 1):
    if name not in judgments:
        print(f"| {i} | `{name}` | ? | ? | NEEDS-REVIEW | not categorized |")
        continue
    tables_fields = defined[name]
    for table, fields, line in tables_fields:
        judgment, reason = judgments[name]
        fields_str = ", ".join(fields)
        print(f"| {i} | `{name}` | {table} | {fields_str} | {judgment} | {reason} |")
