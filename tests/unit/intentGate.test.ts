/**
 * intentGate tests — phantom-action backstop (Task 68).
 *
 * Root cause being tested: a user typed "hello" in the ALOA chat and the
 * assistant called start_drafting, auto-generating a nonsensical
 * court-captioned document. The gate must block mutating tool calls that
 * respond to greetings/acks, while NEVER blocking real requests or
 * answers to the assistant's own clarifying questions.
 */
import { describe, it, expect } from 'vitest';
import {
    shouldBlockToolCall,
    isSmallTalkMessage,
    isTrivialDraftPrompt,
    hasDraftingIntent,
    MUTATING_TOOLS,
} from '../../src/utils/intentGate';

const gate = (userMsg: string, toolName = 'start_drafting', args: any = { prompt: 'Draft a tenancy agreement for Mr. Okafor, 12 months, Lagos' }, modelMsg = '') =>
    shouldBlockToolCall({ lastUserMessage: userMsg, lastModelMessage: modelMsg, toolName, args });

describe('MUTATING_TOOLS', () => {
    it('covers the creating/mutating tools and no read-only ones', () => {
        for (const t of ['start_drafting', 'create_matter', 'create_task', 'create_contact', 'create_event', 'create_property', 'draft_workflow', 'execute_quick_action', 'update_open_form']) {
            expect(MUTATING_TOOLS.has(t)).toBe(true);
        }
        for (const ro of ['query_firm_data', 'search_web', 'fetch_web_page', 'analyze_document', 'get_note_details', 'navigate_to']) {
            expect(MUTATING_TOOLS.has(ro)).toBe(false);
        }
    });
});

describe('greetings must never produce work', () => {
    it('blocks start_drafting for "hello"', () => {
        const r = gate('hello');
        expect(r.blocked).toBe(true);
        expect(r.reason).toContain('BLOCKED');
    });

    it('blocks for common greetings and farewells', () => {
        for (const m of ['hello', 'Hello!', 'hi', 'HI', 'hey', 'good morning', 'Good afternoon.', 'greetings', "what's up", 'how are you', 'how far', 'bye']) {
            const r = gate(m);
            expect(r.blocked, `expected block for "${m}"`).toBe(true);
        }
    });

    it('blocks greetings even when the assistant just asked a question', () => {
        // "hello" is never an answer to "Shall I draft it?"
        const r = gate('hello', 'start_drafting', { prompt: 'x' }, 'Shall I draft the agreement for you?');
        expect(r.blocked).toBe(true);
    });

    it('blocks greetings even mid-conversation (after a completed draft)', () => {
        const r = gate('hello', 'start_drafting', { prompt: 'another document' }, "I've drafted your letter. Anything else?");
        expect(r.blocked).toBe(true);
    });

    it('blocks create_matter / create_task from a greeting too', () => {
        expect(gate('hello', 'create_matter').blocked).toBe(true);
        expect(gate('good morning', 'create_task').blocked).toBe(true);
    });
});

describe('real requests must never be blocked', () => {
    it('allows an explicit drafting request', () => {
        expect(gate('Please draft a tenancy agreement for my tenant Chukwu').blocked).toBe(false);
    });

    it('allows long messages even without drafting keywords', () => {
        expect(gate('My landlord is refusing to return my caution fee after I moved out of the Lekki flat in March').blocked).toBe(false);
    });

    it('allows a greeting that also carries a request', () => {
        expect(gate('Good morning, I need a quit notice for a tenant in Surulere').blocked).toBe(false);
    });

    it('allows read-only tools even from a greeting (no gating)', () => {
        expect(gate('hello', 'query_firm_data').blocked).toBe(false);
        expect(gate('hello', 'search_web').blocked).toBe(false);
    });
});

describe('acknowledgements answer questions but never start work alone', () => {
    it('blocks a bare "ok" with no preceding question', () => {
        expect(gate('ok').blocked).toBe(true);
        expect(gate('thanks').blocked).toBe(true);
    });

    it('blocks "yes" after a completed deliverable when the follow-up prompt is garbage', () => {
        // Model asked "Want me to also prepare the affidavit?" → "yes" is a
        // real answer, BUT if the model then tries to draft with a junk
        // prompt, the belt-and-braces still catches the phantom.
        const r = gate('yes', 'start_drafting', { prompt: 'x' }, "I've drafted your letter. Want me to also prepare the affidavit?");
        expect(r.blocked).toBe(true);
        expect(r.reason).toContain('too vague');
    });

    it('allows "yes" answering a question when the follow-up prompt is substantive', () => {
        const r = gate('yes', 'start_drafting', { prompt: 'Prepare the affidavit in support of the motion to compel' }, 'Shall I go ahead and draft the affidavit?');
        expect(r.blocked).toBe(false);
    });

    it('blocks "ok" when the last model message was a statement, not a question', () => {
        const r = gate('ok', 'start_drafting', { prompt: 'x' }, "Your letter is ready in DraftPro.");
        expect(r.blocked).toBe(true);
    });

    it('allows "yes please" as an answer to a clarifying question', () => {
        const r = gate('yes please', 'start_drafting', { prompt: 'Draft the tenancy agreement' }, 'Shall I go ahead and draft it?');
        expect(r.blocked).toBe(false);
    });

    it('allows a short answer like "to John" after a question', () => {
        const r = gate('to John', 'start_drafting', { prompt: 'Letter to John regarding outstanding rent' }, 'Who should the letter be addressed to?');
        expect(r.blocked).toBe(false);
    });
});

describe('start_drafting prompt-substance backstop', () => {
    it('blocks a start_drafting call with an empty prompt even when the message slipped through', () => {
        const r = gate('hello there, good to see you today', 'start_drafting', { prompt: '' });
        expect(r.blocked).toBe(true);
    });

    it('blocks a start_drafting whose prompt is a lone greeting', () => {
        const r = gate('As discussed earlier', 'start_drafting', { prompt: 'hello' });
        expect(r.blocked).toBe(true);
    });

    it('allows a substantive prompt', () => {
        const r = gate('as discussed', 'start_drafting', { prompt: 'Draft a demand letter to Chukwu Nwosu for ₦450,000 outstanding rent on the Lekki flat' });
        expect(r.blocked).toBe(false);
    });
});

describe('isSmallTalkMessage', () => {
    it('classifies greetings and acks', () => {
        for (const m of ['hello', 'ok', 'thanks', 'yes', 'hi there!', 'good evening']) expect(isSmallTalkMessage(m)).toBe(true);
    });
    it('does not classify substance as small talk', () => {
        for (const m of ['draft a letter', 'What is my next court date?', 'Remind me to serve the writ on Monday']) expect(isSmallTalkMessage(m)).toBe(false);
    });
});

describe('isTrivialDraftPrompt (DraftPro auto-draft guard)', () => {
    it('treats empty/greeting/single-word prompts as trivial', () => {
        for (const p of ['', undefined, 'hello', 'hi', 'draft', 'document', 'letter', 'untitled draft', 'test']) {
            expect(isTrivialDraftPrompt(p), `expected trivial for "${p}"`).toBe(true);
        }
    });
    it('treats real prompts as substantive', () => {
        for (const p of [
            'Draft a tenancy agreement for Mr. Okafor',
            'letter to Chukwu regarding outstanding rent',
            'Prepare a quit notice under the Lagos Tenancy Law 2011',
        ]) {
            expect(isTrivialDraftPrompt(p), `expected NOT trivial for "${p}"`).toBe(false);
        }
    });
});

describe('hasDraftingIntent', () => {
    it('detects drafting nouns', () => {
        expect(hasDraftingIntent('I need a letter to my landlord')).toBe(true);
        expect(hasDraftingIntent('prepare the affidavit for Monday')).toBe(true);
        expect(hasDraftingIntent('what is the weather')).toBe(false);
    });
});
