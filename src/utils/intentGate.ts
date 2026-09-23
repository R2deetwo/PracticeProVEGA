/**
 * intentGate — client-side guard against phantom AI actions.
 *
 * ## Why this module exists
 *
 * 2026-09-23 user report: typing "hello" in the ALOA/ARIA chat caused the
 * assistant to call `start_drafting`, which auto-generated a nonsensical
 * "legal" document (court caption on a letter, "applicable framework"
 * boilerplate). The model treated a greeting as an instruction to produce
 * work — the AI equivalent of a junior lawyer filing a phantom process
 * because the client said "good morning".
 *
 * Prompt-side instructions are the primary fix (see
 * ai/prompts/01-aloa-legal-identity.md → "CONVERSATION COMMON SENSE"),
 * but prompts are advisory. This module is the deterministic backstop:
 * before a MUTATING tool call executes, we check whether the user's last
 * message actually carries actionable intent. If not, the tool call is
 * rejected with a corrective tool result so the model recovers and
 * answers conversationally.
 *
 * ## Two-tier design
 *
 * GREETINGS ("hello", "good morning") are never instructions — nobody
 * answers "Shall I draft it?" with "hello" — so they are blocked
 * unconditionally.
 *
 * ACKNOWLEDGEMENTS ("ok", "yes", "thanks") CAN be answers to a question
 * the assistant just asked ("Shall I draft it?" → "yes please"), so they
 * are only blocked when the assistant did NOT just ask a question.
 *
 * In both tiers, any message that carries drafting nouns or substantive
 * length is never blocked — the gate only fires for pure social filler.
 */

/** Tools that create or mutate data — gated by shouldBlockToolCall. */
export const MUTATING_TOOLS: ReadonlySet<string> = new Set([
    'start_drafting',
    'plan_document_packet',
    'create_matter',
    'create_contact',
    'create_task',
    'create_event',
    'create_property',
    'draft_workflow',
    'execute_quick_action',
    'update_open_form',
]);

/**
 * Words that indicate drafting/document intent. If ANY of these appear in
 * the user's last message, drafting tools are allowed regardless of length.
 */
const DRAFTING_INTENT_RE =
    /\b(draft|draught|write|prepare|compose|generate|document|letter|agreement|contract|tenancy|lease|deed|writ|summons|motion|affidavit|petition|plead|brief|notice|memorandum|memo|opinion|advisory|demand|counterclaim|statement of defence|originating process)[a-z]*\b/i;

/**
 * Messages longer than this are assumed to carry substance (a name, a
 * place, an instruction) and are never gated.
 */
const SMALL_TALK_MAX_LEN = 42;

/** Tier 1 — pure greetings. Never actionable, blocked unconditionally. */
const GREETING_ONLY_RE =
    /^(?:hello+|hi+|hey+|yo|howdy|hola|greetings|what'?s\s+up|sup|good\s*(?:morning|afternoon|evening|day)|how\s+(?:are\s+you|far|na|you\s+dey|body\s+dey))(?:\s+(?:there|everyone|folks|team|all|sir|ma|chief|counsel|lawyer|senior))?[\s!.,;:')]*$/i;

/**
 * Tier 2 — bare acknowledgements / affirmations / farewells. Actionable
 * ONLY as an answer to a question the assistant just asked.
 */
const ACK_ONLY_RE =
    /^(?:okay+|ok|k|okey|alright|right|yes+|yeah|yep|yup|sure|no|nope|nah|maybe|please|pls|plz|thanks?(?:\s+(?:a\s+lot|so\s+much|very\s+much))?|thank\s+you|ty|great|nice|cool|perfect|awesome|good|fine|bye|goodbye|see\s+ya|later|lol|lmao|haha+|hehe+|hmm+|hm+|wow|interesting|well\s+done|good\s+job|nice\s+one)[\s!.,;:')]*$/i;

/** Whitespace-normalised lowercase copy of a message. */
const norm = (s: string): string => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();

/** True when the message is a pure greeting (tier 1 social filler). */
export function isGreetingOnly(text: string): boolean {
    const t = norm(text);
    if (!t) return true; // empty message — nothing actionable
    if (t.length > SMALL_TALK_MAX_LEN) return false;
    if (DRAFTING_INTENT_RE.test(t)) return false;
    return GREETING_ONLY_RE.test(t);
}

/** True when the message is a bare acknowledgement (tier 2 filler). */
export function isAckOnly(text: string): boolean {
    const t = norm(text);
    if (t.length > SMALL_TALK_MAX_LEN) return false;
    if (DRAFTING_INTENT_RE.test(t)) return false;
    return ACK_ONLY_RE.test(t);
}

/**
 * Is this message pure small talk with no instruction and no factual
 * content? (Union of both tiers — used by tests and the DraftPro
 * trivial-prompt check.)
 */
export function isSmallTalkMessage(text: string): boolean {
    return isGreetingOnly(text) || isAckOnly(text);
}

/**
 * Does the text contain explicit drafting/document intent?
 * (Used to short-circuit the gate for start_drafting specifically.)
 */
export function hasDraftingIntent(text: string): boolean {
    return DRAFTING_INTENT_RE.test(norm(text));
}

/**
 * Extract the text of a message, tolerating the AloaMessage shape where
 * content may be a string or an array of parts.
 */
function messageText(m: { content?: unknown } | null | undefined): string {
    if (!m) return '';
    const c = m.content;
    if (typeof c === 'string') return c;
    if (Array.isArray(c)) {
        return c.map((p: any) => (typeof p?.text === 'string' ? p.text : '')).join(' ');
    }
    return '';
}

export interface IntentGateInput {
    /** The user's most recent message (object with .content, or raw string). */
    lastUserMessage: { content?: unknown; role?: string } | string | null | undefined;
    /** The assistant's most recent message BEFORE this turn's tool call. */
    lastModelMessage: { content?: unknown; role?: string } | string | null | undefined;
    /** Tool name being invoked, e.g. 'start_drafting'. */
    toolName: string;
    /** Parsed tool args (used for the start_drafting prompt-substance check). */
    args?: Record<string, any> | null;
}

export interface IntentGateResult {
    /** true → reject the tool call with a corrective message. */
    blocked: boolean;
    /** Human-readable corrective instruction fed back to the model. */
    reason?: string;
}

/**
 * The gate. Returns { blocked: true, reason } when a mutating tool call
 * should be rejected because the user's last message carried no actionable
 * intent.
 *
 * Blocked cases:
 *  - last user message is a pure greeting ("hello") → always blocked
 *  - last user message is a bare ack ("ok", "yes") AND the assistant did
 *    not just ask a question → blocked
 *  - start_drafting whose prompt arg itself is trivial → blocked
 *    (belt-and-braces — a real draft prompt always carries substance)
 */
export function shouldBlockToolCall(input: IntentGateInput): IntentGateResult {
    const { toolName } = input;
    if (!MUTATING_TOOLS.has(toolName)) return { blocked: false };

    const userText =
        typeof input.lastUserMessage === 'string'
            ? input.lastUserMessage
            : messageText(input.lastUserMessage as any);
    const modelText =
        typeof input.lastModelMessage === 'string'
            ? input.lastModelMessage
            : messageText(input.lastModelMessage as any);

    const modelAskedQuestion = !!modelText && modelText.includes('?');

    let smallTalk = false;
    if (isGreetingOnly(userText)) {
        // Tier 1: greetings are never instructions — even right after a
        // question, nobody answers "Shall I draft it?" with "hello".
        smallTalk = true;
    } else if (isAckOnly(userText) && !modelAskedQuestion) {
        // Tier 2: bare acks are only meaningful as answers to a question.
        smallTalk = true;
    }

    if (!smallTalk) {
        // Belt-and-braces for drafting: a REAL start_drafting call always
        // carries a substantive prompt ("Draft a tenancy agreement for…").
        // If the prompt arg itself is trivial, it's a phantom even when the
        // message slipped through the small-talk tests.
        if (toolName === 'start_drafting') {
            const prompt = String(input.args?.prompt || input.args?.title || '');
            if (!prompt.trim() || (!hasDraftingIntent(prompt) && prompt.trim().length < 25)) {
                return {
                    blocked: true,
                    reason:
                        'BLOCKED: The drafting instruction is empty or too vague to produce a meaningful document. ' +
                        'Do NOT create a document. Instead, ask the user what document they need — the type of ' +
                        'document, the parties, and the key facts. A short clarifying question is the professional ' +
                        'response; a guessed draft is malpractice.',
                };
            }
        }
        // Same idea for packets (Task 69): a real plan_document_packet call
        // always carries at least one named document. A plan with no
        // documents is a phantom plan.
        if (toolName === 'plan_document_packet') {
            const docs = Array.isArray(input.args?.documents) ? input.args.documents : [];
            const first = docs.find((d: any) => d && typeof d.name === 'string' && d.name.trim());
            if (!first) {
                return {
                    blocked: true,
                    reason:
                        'BLOCKED: The packet plan carried no documents. Do NOT present a plan. Ask the user to ' +
                        'describe the job/process, then itemise the documents it genuinely requires before planning.',
                };
            }
        }
        return { blocked: false };
    }

    const what =
        toolName === 'start_drafting'
            ? 'a document'
            : toolName === 'plan_document_packet'
                ? 'a document packet'
            : toolName.startsWith('create_')
                ? `a new ${toolName.replace('create_', '').replace('_', ' ')}`
                : 'this change';

    return {
        blocked: true,
        reason:
            `BLOCKED: The user's last message ("${userText.slice(0, 60)}") was a greeting or ` +
            `acknowledgement, not a request. Do NOT create ${what}. Reply conversationally: ` +
            `acknowledge them warmly in one short line, then ask what they would like help ` +
            `with today. If they earlier discussed a document that is already drafted, remind ` +
            `them it is ready and offer to refine it — do not produce another one.`,
    };
}

/**
 * Trivial-prompt check for the DraftPro auto-draft pipeline.
 * DraftProEditor should NOT auto-generate a document when the drafting
 * prompt carries no substantive instruction ("hello", "draft", empty).
 * This is the last line of defence before Gemini invents a phantom.
 */
const TRIVIAL_PROMPT_PHRASES =
    /^(?:untitled(?:\s+draft|\s+document)?|new\s+document|draft(?:\s+document)?|document|letter|a\s+letter|a\s+document|legal\s+document|professional\s+letter|test|test\s+draft|placeholder|todo|hello|hi|hey|new\s+draft)[\s.,!?:-]*$/i;

export function isTrivialDraftPrompt(prompt: string | null | undefined): boolean {
    const t = norm(prompt || '');
    if (!t) return true;
    if (t.length < 12) return true;
    if (isSmallTalkMessage(t)) return true;
    if (TRIVIAL_PROMPT_PHRASES.test(t)) return true;
    // A real prompt names its subject: at least two distinct 3+ letter words
    // ("tenancy agreement", "letter to Chukwu"). Single-word prompts are
    // placeholders, not instructions.
    if (!/[a-z]{3,}\s+[a-z]{3,}/.test(t)) return true;
    return false;
}
