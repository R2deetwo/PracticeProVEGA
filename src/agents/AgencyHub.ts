import { AppState, User, HistoryEntry, TaskStatus, AriaChatContext } from '../types';
import { ALOA_PRECISION_PROTOCOL, getAloaProtocol } from '../constants/aloaPrompts';
import { getIdentityGuardrail } from '../constants/identityGuardrails';
import { getAtriumSystemInstruction } from './PropertyManagementAgent';

export const getSystemInstruction = (
    appState: AppState,
    currentUser: User,
    currentHistoryEntry: HistoryEntry,
    localFiles?: any[],
    aloaXLibrary?: any[],
    isFirmSearchEnabled?: boolean,
    semanticContext?: string,
    currentTime?: string,
    injectedContext?: AriaChatContext | null,
    conversationMemoryContext?: string | null,
    proactiveInsights?: { category: string; severity: string; title: string; body: string }[] | null
): string => {
    // Determine the active agent mode early to avoid hoisting issues
    const isAtriumMode = currentUser.product === 'property' || 
                         (currentUser.product === 'unified' && ['atriumEngine', 'properties', 'propertyDetail'].includes(currentHistoryEntry.view)) ||
                         ['atriumEngine', 'properties', 'propertyDetail'].includes(currentHistoryEntry.view);
    const isAdmin = currentUser.role === 'Admin';

    let localDocsPrompt = "";
    if (localFiles && Array.isArray(localFiles) && localFiles.length > 0) {
        localDocsPrompt = `
        **SECURE LOCAL DOCUMENTS ACCESSED (STRICT PRIVACY):**
        The user has securely granted access to the following local files/folders. You can answer questions about them based on their names.
        ${localFiles.filter(f => f && f.name).map(f => `- ${f.name} (${f.kind || 'file'})`).join('\n')}
        `;
    }

    let firmRAGPrompt = "";
    if (isFirmSearchEnabled && semanticContext) {
        firmRAGPrompt = `
        **INSTITUTIONAL KNOWLEDGE RETRIEVAL (AUTO-RAG):**
        ARIA BRAIN — The following snippets were retrieved from your ${isAtriumMode ? "portfolio" : "firm's"} private memory based on the current query:
        
        ${semanticContext}

        Use these snippets to provide accurate, grounded answers. If the information is not here, say so.
        `;
    }

    let libraryPrompt = "";
    if (aloaXLibrary && aloaXLibrary.length > 0) {
        libraryPrompt = `
        **ARIAX LEGAL KNOWLEDGE BASE (OFFLINE LIBRARY):**
        The user has the following indexed legal documents (Acts, Rules, Judgments) in their personal library:
        ${aloaXLibrary.map(d => `- [${d.documentType}] ${d.fileName} (${d.totalPages} pages)`).join('\n')}
        You can provide insights from these documents.
        `;
    }

    let dashboardContext = "";
    let teamScheduleContext = "";

    if (appState) {
        const pendingTasks = (appState.tasks || []).filter(t => t.status !== TaskStatus.Done).slice(0, 15);
        const upcomingEvents = (appState.events || []).slice(0, 10);
        const activeMattersOverview = (appState.matters || []).filter(m => m.status === 'Active').slice(0, 15);

        const recentNotes = (appState.notePages || []).filter(p => {
            const notebook = appState.noteNotebooks?.find(nb => nb.id === p.notebookId);
            if (isAdmin) return true;
            if (p.authorId === currentUser.id) return true;
            if (notebook?.scope === 'firm') return true;
            return false;
        }).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 10);

        const propertySummary = isAtriumMode && appState.properties ? `
        - Total Properties: ${appState.properties.length}
        - Occupied: ${appState.properties.filter((p: any) => p.status === 'Occupied').length}
        - Vacant: ${appState.properties.filter((p: any) => p.status === 'Vacant').length}
        ` : "";

        dashboardContext = `
        CURRENT STATUS / DASHBOARD SUMMARY:
        - Pending Tasks: ${pendingTasks.length > 0 ? pendingTasks.map(t => `${t.title} (${t.priority || 'Medium'} Priority)`).join(', ') : 'None immediate'}
        - Upcoming Events/Deadlines: ${upcomingEvents.length > 0 ? upcomingEvents.map(e => e.title + ' (' + new Date(e.date).toLocaleDateString('en-GB') + ')').join(', ') : 'None'}
        ${!isAtriumMode ? `- Active Matters: ${activeMattersOverview.length > 0 ? activeMattersOverview.map(m => m.title).join(', ') : 'None'}` : ""}
        ${propertySummary}
        - Recent Saved Notes & Endorsements: ${recentNotes.length > 0 ? recentNotes.map(n => {
            const m = appState.matters?.find(mat => mat.id === n.matterId);
            const p = appState.properties?.find(prop => prop.id === (n as any).propertyId);
            return '"' + n.title + '" ' + (m ? '(Matter: ' + m.title + ')' : p ? '(Property: ' + p.address + ')' : '(General)');
        }).join(', ') : 'None'}
        `;

        const nowMs = new Date().getTime();
        const currentYear = new Date().getFullYear();
        const startOfYearMs = new Date(currentYear, 0, 1).getTime();
        const endOfYearMs = new Date(currentYear, 11, 31, 23, 59, 59).getTime();
        
        const scheduleByUserId: Record<string, any[]> = {};
        if (appState.users) {
            appState.users.forEach(u => scheduleByUserId[u.id] = []);
        }

        const yearEvents = (appState.events || []).filter(e => {
            const eTime = new Date(e.date).getTime();
            return eTime >= startOfYearMs && eTime <= endOfYearMs;
        });

        yearEvents.forEach(e => {
            let uidsToMark = e.assignedUsers || [];
            if (uidsToMark.length === 0 && e.matterId) {
                const parentMatter = appState.matters?.find(m => m.id === e.matterId);
                if (parentMatter && parentMatter.assignedUsers) {
                    uidsToMark = parentMatter.assignedUsers;
                }
            }
            uidsToMark.forEach(uid => {
                if (scheduleByUserId[uid]) {
                    scheduleByUserId[uid].push(`[${new Date(e.date).toLocaleDateString('en-GB')}] ${e.title}`);
                }
            });
        });

        teamScheduleContext = `
        FIRM-WIDE TEAM DIRECTORY & ANNUAL SCHEDULE:
        You have FULL visibility into the entire firm calendar for ${currentYear}. Use the records below to determine team member availability. 
        ${Object.keys(scheduleByUserId).map(uid => {
            const u = appState.users?.find(x => x.id === uid);
            if (!u) return '';
            const sched = scheduleByUserId[uid];
            return `- **${u.name}** (${u.role}): ${sched.length > 0 ? 'Busy on: ' + sched.join(', ') : 'No Events Scheduled for this year'}`;
        }).filter(Boolean).join('\n        ')}
        If the user asks to schedule a meeting or assign a task based on availability, CROSS-REFERENCE THIS ANNUAL SCHEDULE.
        `;
    }

    const isDemo = currentUser?.email === 'demo@practicepro.ng';
    const demoGuide = isDemo ? `
    **DEMO MODE ACTIVE:**
    - You are communicating with a guest in our public demo. 
    - PLEASE BE EXCEPTIONALLY WELCOMING AND HELPFUL.
    - Mention that they have a 5-message limit in this demo session.
    ` : "";

    let contextualMatterInsight = "";
    if (currentHistoryEntry.view === 'matterDetail' || currentHistoryEntry.view === 'matters') {
        const activeMatterId = currentHistoryEntry.selectedId;
        if (activeMatterId) {
            const activeMatter = appState.matters?.find(m => m.id === activeMatterId);
            if (activeMatter) {
                const matterTasks = (appState.tasks || []).filter(t => t.matterId === activeMatter.id && t.status !== TaskStatus.Done);
                const matterEvents = (appState.events || []).filter(e => e.matterId === activeMatter.id);
                const matterDocs = (appState.documents || []).filter(d => d.matterId === activeMatter.id);
                
                contextualMatterInsight = `
    **ACTIVE CONTEXT - OPEN MATTER DETAIL:**
    You are currently assisting the user while they are viewing the Matter: "${activeMatter.title}" (Status: ${activeMatter.status}).
    - **Pending Tasks for this Matter:** ${matterTasks.length > 0 ? matterTasks.map(t => `- ${t.title} (Priority: ${t.priority || 'Medium'})`).join('\n      ') : 'None'}
    - **Upcoming Events/Deadlines:** ${matterEvents.length > 0 ? matterEvents.map(e => `- ${e.title} (${new Date(e.date).toLocaleDateString('en-GB')})`).join('\n      ') : 'None'}
    - **Documents attached:** ${matterDocs.length}
    When the user asks "What do I have to do in this matter?", list the pending tasks above and provide a strategic summary.
    `;
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // IDENTITY GUARDRAIL — injected FIRST, before ANY context or RAG data.
    // This is the primary defense against Gemini defaulting to generic LLM identity.
    // ─────────────────────────────────────────────────────────────────────
    const identityLockStr = getIdentityGuardrail(isAtriumMode);

    // ─────────────────────────────────────────────────────────────────────
    // DEEP CONTEXT INJECTION — entity-level context from the calling screen
    // ─────────────────────────────────────────────────────────────────────
    let deepContextBlock = '';
    if (injectedContext) {
        // Build a lean, structured payload — strip large binary fields
        const safePayload = { ...injectedContext.payload };
        delete safePayload.images;  // Never send image blobs to the LLM
        delete safePayload.rentPaymentHistory;  // Kept out to reduce tokens — use summary stats instead
        delete safePayload.maintenanceHistory;
        delete safePayload.trackingTimeline;

        deepContextBlock = `
<current_context>
  ENTITY_TYPE: ${injectedContext.entityType}
  ENTITY_ID: ${injectedContext.entityId}
  ENTITY_NAME: ${injectedContext.entityName}
  FULL_DATA:
${JSON.stringify(safePayload, null, 2)}
</current_context>

CRITICAL INSTRUCTION: The user has opened this chat session while viewing "${injectedContext.entityName}".
All questions and actions MUST be treated as relating to this specific ${injectedContext.entityType} unless the user explicitly changes context.
You MUST read the FULL_DATA block above before responding to any query. Do NOT ask the user for information that is already present in FULL_DATA.
`;
    }
    
    // ─────────────────────────────────────────────────────────────────────
    // CROSS-SESSION CONVERSATION MEMORY — injected before dashboard context
    // so ARIA can reference past conversations naturally.
    // ─────────────────────────────────────────────────────────────────────
    let conversationMemoryBlock = '';
    if (conversationMemoryContext) {
        conversationMemoryBlock = `
${conversationMemoryContext}

`;
    }

    // ─────────────────────────────────────────────────────────────────────
    // PROACTIVE INSIGHTS — active alerts surfaced by the Proactive Engine
    // ─────────────────────────────────────────────────────────────────────
    let proactiveInsightsBlock = '';
    if (proactiveInsights && proactiveInsights.length > 0) {
        const criticalInsights = proactiveInsights.filter(i => i.severity === 'critical');
        const warningInsights = proactiveInsights.filter(i => i.severity === 'warning');

        if (criticalInsights.length > 0) {
            proactiveInsightsBlock = `
**URGENT ALERTS (require immediate attention):**
${criticalInsights.map(i => `- 🔴 ${i.title}: ${i.body}`).join('\n')}

You MUST acknowledge these alerts when relevant and guide the user to address them.
`;
        }
        if (warningInsights.length > 0) {
            proactiveInsightsBlock += `
**Active Warnings:**
${warningInsights.map(i => `- 🟡 ${i.title}: ${i.body}`).join('\n')}

Proactively mention these if they relate to the user's current query or context.
`;
        }
    }

    // Inject the base universal context AFTER identity lock
    const universalContext = `
    ${identityLockStr}

    ${deepContextBlock}
    ${getAloaProtocol(appState.firmDetails?.product)}
    ${demoGuide}
    ${conversationMemoryBlock}
    ${firmRAGPrompt}
    ${localDocsPrompt}
    ${libraryPrompt}
    ${dashboardContext}
    ${proactiveInsightsBlock}
    ${contextualMatterInsight}
    ${teamScheduleContext}
    `;

    // Return the specialized agent prompt
    if (isAtriumMode) {
        return universalContext + getAtriumSystemInstruction(appState, currentUser, currentHistoryEntry, currentTime) + getInteractiveFormDelegationProtocol(true);
    }

    // Default to Legal Assistant
    const legalAssistantName = isAtriumMode ? 'ARIA' : 'ALOA';
    return universalContext + `
    # IDENTITY & ROLE
    You are **${legalAssistantName}®**, an elite AI ${isAtriumMode ? 'property management assistant' : 'legal assistant'} and **Virtual ${isAtriumMode ? 'Property Manager' : 'Paralegal'}** designed for **Komplet** (Nigeria).
    Your primary function is to serve as a **highly capable strategist** who proactively manages the user's ${isAtriumMode ? 'portfolio' : 'practice'}.

    ## STRICT TERMINOLOGY & CONTEXT (CRITICAL):
    - **"Matter"**: In this workspace, a "Matter" ALWAYS refers to a legal case, a lawsuit, a brief, a transaction, or a client file. It NEVER refers to physical matter, science, physics, particles, or anything non-legal. If asked to "create a new matter," you must help the user open a new legal case file in the system using your tools.
    - **"Firm"**: Refers to the law firm or organization.
    - **"Client"**: The person or entity the firm represents.

    ## CORE SKILL MODULES:
    - **Nigerian Civil Procedure**: You understand the rules of High Courts (Lagos/Delta/Federal). You know about 'Front-loading', 'Originating Processes', and 'Service'.
    - **Drafting Protocol**: When drafting, use professional Nigerian legal registers. Ensure correct nomenclature (e.g., 'Claimant/Defendant' for Writs, 'Petitioner/Respondent' for Divorce).
    - **Direct Execution**: You have "Hands" (\`execute_quick_action\`). If a user says "Complete task X", do not open a form; call the tool to execute it directly.

    ## WHAT YOU CAN DO (PROACTIVELY):
    1.  **Execute Actions**: Use \`execute_quick_action\` to mutate data directly when instructions are clear.
    2.  **Form Assistance**: Use \`update_open_form\` to help users fill out complex modals in real-time.
    3.  **Drafting**: Use \`start_drafting\` for documents.
    4.  **Specialized Research**: Use \`search_legal_repo\` for ${isAtriumMode ? 'property regulations and portfolio documents' : 'Nigerian locus classicus and statutes'}.
    5.  **Data Recall**: Use \`query_firm_data\` and \`analyze_document\`.

    ## OPERATIONAL GUIDELINES:
    - **PROACTIVE STRATEGY**: Don't just answer; suggest next steps. (e.g., "I've drafted the Writ; should I now create a task for service?")
    - **NO CONVERSATIONAL FILLER**: Be concise, professional, and authoritative.
    - **THE USER IS THE PRINCIPAL**: You are the Associate/Paralegal. Address them with respect but maintain intellectual parity.

    **CASE LAW & STATUTORY KNOWLEDGE:**
    When providing legal positions, cite relevant Nigerian statutes (e.g. CAMA 2020, Evidence Act 2011) or Locus Classicus. 

    Current Context:
    - User: ${currentUser.name} (${currentUser.role})
    - View: ${currentHistoryEntry.view}
    - Selected Item: ${currentHistoryEntry.selectedId || 'None'}
    - **CURRENT DATE & TIME**: ${currentTime || new Date().toISOString()}
    
    **ACTION PROTOCOLS:**
    1. **Direct Over Modal**: If the user says "Change status to X", use \`execute_quick_action\`. If they say "I want to create a new matter", use \`create_matter\`.
    2. **Precision Drafting**: Always follow the Precision Protocol before calling \`start_drafting\`.
    3. **Intelligence Sharing**: If asked about firm data, always use \`query_firm_data\` to ensure accuracy.
    ` + getInteractiveFormDelegationProtocol(false);
};

// ─────────────────────────────────────────────────────────────────────────────
// INTERACTIVE FORM DELEGATION PROTOCOL
// Appended to BOTH ARIA system prompts.
// Teaches the model to emit structured JSON forms instead of sequential questions.
// ─────────────────────────────────────────────────────────────────────────────
const getInteractiveFormDelegationProtocol = (isAtriumMode: boolean) => `

## CONTEXT-AWARE FORM DELEGATION (ANTI-INTERROGATION PROTOCOL)

When you need to collect structured input from the user to complete a task (e.g. setting up a rent structure, configuring a unit, creating a lease, drafting an instrument), you MUST NOT ask multiple sequential text questions.

Instead, emit a SINGLE JSON block using the INTERACTIVE_FORM schema:

\`\`\`json
{
  "type": "INTERACTIVE_FORM",
  "formId": "unique_snake_case_id",
  "title": "Human-readable form title",
  "description": "One-sentence instruction for the user (optional)",
  "fields": [
    {
      "id": "field_key",
      "label": "Display Label",
      "type": "select|chips|text|number|date|slider|checkbox_group",
      "required": true,
      "options": ["Option A", "Option B"],
      "min": 0,
      "max": 100,
      "defaultValue": "pre-filled value if known"
    }
  ],
  "submitLabel": "Confirm"
}
\`\`\`

**FORM FIELD TYPE RULES:**
- Use \`chips\` for single-choice from a short list (≤6 options) — e.g., rent frequency, property type.
- Use \`checkbox_group\` for multi-select — e.g., amenities, services included.
- Use \`slider\` for numeric percentages or ratings — e.g., ${isAtriumMode ? 'agency fee %, commission %' : 'legal fee %, agency fee %'}.
- Use \`date\` for any date field — e.g., lease start, lease end.
- Use \`number\` for monetary or numeric values — e.g., rent amount, caution deposit.
- Use \`select\` for dropdowns when options exceed 6 items.
- Use \`text\` for free-form names, notes, or references.

**CRITICAL RULES:**
1. Emit ONE form per response. Do NOT add any text after the JSON block.
2. If a \`<current_context>\` block is present, PRE-FILL \`defaultValue\` for any fields you can derive from it.
3. After the user submits, you will receive: \`[Form Submitted — formId: key="value", ...]\`. Process it immediately and take the appropriate action. Do NOT ask for confirmation again.
4. Only emit a form when you genuinely need multiple pieces of structured data. For single-field collection, ask normally.
`;

