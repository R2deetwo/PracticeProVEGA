/**
 * endorsementDateParser — pull the FIRST dated mention out of an endorsement
 * so "+ Task" / "+ Event" on the matter endorsement composer can create the
 * diary entry in ONE click (owner brief 2026-11-24: "Must there be some extra
 * step for the user to take before it can be logged as something that will
 * enter the calendar…?").
 *
 * Nigerian drafting convention first: "12/03/2026" is day-first. Month-first
 * is honoured when the numbers force it (03/25/2026). Plain English dates
 * ("12th of March 2026", "March 12, 2026") and relative words (today /
 * tomorrow / next week) are recognised; a time-of-day ("by 2:30pm") rides
 * along so the event lands at the right hour (default 09:00).
 *
 * ROUND 25 (ALOA Vox intelligence overhaul, owner bug report 2026-11-28):
 * SPOKEN ORDINAL WORDS — "the fourth of December 2026", "the twenty-first
 * of March" — parse exactly like their digit forms, because dictated dates
 * arrive as words.
 *
 * Pure and dependency-free — unit-tested in
 * tests/unit/endorsementDateParser.test.ts.
 */

const MONTHS = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
];

const monthIndex = (token: string): number => {
    const t = token.toLowerCase();
    const hit = MONTHS.findIndex((m) => m.startsWith(t.slice(0, 3)));
    return hit; // -1 when not a month
};

/** ROUND 25: spoken ordinal words → their number ("fourth" → 4,
 *  "twenty-first" → 21). -1 when the word is not an ordinal. */
const ORDINAL_WORDS: Record<string, number> = {
    first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6,
    seventh: 7, eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12,
    thirteenth: 13, fourteenth: 14, fifteenth: 15, sixteenth: 16,
    seventeenth: 17, eighteenth: 18, nineteenth: 19, twentieth: 20,
    'twenty-first': 21, 'twenty-second': 22, 'twenty-third': 23,
    'twenty-fourth': 24, 'twenty-fifth': 25, 'twenty-sixth': 26,
    'twenty-seventh': 27, 'twenty-eighth': 28, 'twenty-ninth': 29,
    thirtieth: 30, 'thirty-first': 31,
};

const ordinalWordToNumber = (word: string): number => {
    const key = word.toLowerCase().replace(/\s+/g, '-');
    return ORDINAL_WORDS[key] ?? -1;
};

/** ROUND 25: the day token — digits ("12", "4th") or a spoken ordinal word
 *  ("fourth", "twenty-first"). */
const DAY_TOKEN = '(\\d{1,2}(?:st|nd|rd|th)?|[a-z]+(?:-[a-z]+)?)';

/** Resolve a matched day token to a day number; NaN when it is not a day. */
const parseDayToken = (token: string): number => {
    const digits = token.match(/^(\d{1,2})/);
    if (digits) return Number(digits[1]);
    return ordinalWordToNumber(token);
};

const DAYS_AFTER = (n: number) => n * 24 * 60 * 60 * 1000;

export interface DatedMention {
    /** Local-midnight anchor date of the mention. */
    date: Date;
    /** The substring the date was read from (for toasts/echoes). */
    matched: string;
    /** Minutes since midnight when a time-of-day was spoken (else null). */
    timeMinutes: number | null;
}

const parseNumeric = (m: RegExpExecArray): { day: number; month: number; year: number } | null => {
    const a = Number(m[1]);
    const b = Number(m[2]);
    let year = Number(m[3]);
    if (year < 100) year += 2000;
    if (year < 2000 || year > 2100) return null;
    let day = a;
    let month = b;
    if (a > 12 && b <= 12) {
        // 25/03/2026 — unambiguous day-first.
    } else if (b > 12 && a <= 12) {
        // 03/25/2026 — month-first (US draft leaked in).
        day = b; month = a;
    }
    // else: both ≤12 — Nigerian convention, day-first (already set).
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return { day, month, year };
};

const parseTime = (text: string): number | null => {
    let m = /\b(\d{1,2}):(\d{2})\s*(am|pm)\b/i.exec(text)
        || /\b(\d{1,2})\s*(am|pm)\b/i.exec(text);
    if (m) {
        let hour = Number(m[1]);
        const minutes = m[2] && /^\d+$/.test(m[2]) ? Number(m[2]) : 0;
        const meridiem = (m[3] || m[2] || '').toString().toLowerCase();
        if (/pm/.test(meridiem) && hour < 12) hour += 12;
        if (/am/.test(meridiem) && hour === 12) hour = 0;
        if (hour >= 0 && hour <= 23) return hour * 60 + minutes;
        return null;
    }
    m = /\b([01]?\d|2[0-3]):([0-5]\d)\b/.exec(text);
    if (m) return Number(m[1]) * 60 + Number(m[2]);
    return null;
};

/** Extract the first dated mention in the text (chronologically scanned,
 *  left-to-right). `now` is injectable for tests. */
export const extractDatedMention = (text: string, now: Date = new Date()): DatedMention | null => {
    if (!text) return null;
    const flat = text.replace(/\s+/g, ' ');

    // 1. Numeric dd/mm/yyyy (Nigerian convention, month-first fallback).
    const numeric = /(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\b/.exec(flat);
    if (numeric) {
        const parsed = parseNumeric(numeric);
        if (parsed) {
            const d = new Date(parsed.year, parsed.month - 1, parsed.day);
            if (!isNaN(d.getTime())) {
                return {
                    date: d,
                    matched: numeric[0],
                    timeMinutes: parseTime(flat),
                };
            }
        }
    }

    // 2. "12th of March 2026" / "12 March 2026" / "the fourth of December
    //    2026" (ROUND 25: the spoken ordinal word form).
    const dayMonthYear = new RegExp(
        `\\b(?:the\\s+)?${DAY_TOKEN}\\s+(?:of\\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\s+(\\d{4})\\b`,
        'i',
    ).exec(flat);
    if (dayMonthYear) {
        const month = monthIndex(dayMonthYear[2]);
        const day = parseDayToken(dayMonthYear[1]);
        const year = Number(dayMonthYear[3]);
        const d = new Date(year, month, day);
        if (month >= 0 && day >= 1 && day <= 31 && !isNaN(d.getTime())) {
            return { date: d, matched: dayMonthYear[0], timeMinutes: parseTime(flat) };
        }
    }

    // 3. "March 12, 2026".
    const monthDayYear = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/i.exec(flat);
    if (monthDayYear) {
        const month = monthIndex(monthDayYear[1]);
        const day = Number(monthDayYear[2]);
        const year = Number(monthDayYear[3]);
        const d = new Date(year, month, day);
        if (month >= 0 && !isNaN(d.getTime())) {
            return { date: d, matched: monthDayYear[0], timeMinutes: parseTime(flat) };
        }
    }

    // 4. Month + day, no year — the NEXT future occurrence. ROUND 25: the
    //    day token may be a spoken ordinal word ("the fourth of December").
    const dayMonth = new RegExp(
        `\\b(?:the\\s+)?${DAY_TOKEN}\\s+(?:of\\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\b`,
        'i',
    ).exec(flat);
    if (dayMonth) {
        const month = monthIndex(dayMonth[2]);
        const day = parseDayToken(dayMonth[1]);
        if (month >= 0 && Number.isFinite(day) && day >= 1 && day <= 31) {
            let d = new Date(now.getFullYear(), month, day);
            if (d.getTime() < now.getTime() - DAYS_AFTER(1)) {
                d = new Date(now.getFullYear() + 1, month, day);
            }
            return { date: d, matched: dayMonth[0], timeMinutes: parseTime(flat) };
        }
    }

    // 5. Relative words.
    const lower = flat.toLowerCase();
    const relative: Array<{ re: RegExp; days: number; label: string }> = [
        { re: /\btoday\b/, days: 0, label: 'today' },
        { re: /\btomorrow\b/, days: 1, label: 'tomorrow' },
        { re: /\bnext week\b/, days: 7, label: 'next week' },
    ];
    for (const rel of relative) {
        if (rel.re.test(lower)) {
            const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + rel.days);
            return { date: d, matched: rel.label, timeMinutes: parseTime(flat) };
        }
    }

    return null;
};

/** Format a DatedMention for toasts: "Tue 24 Dec, 2:30 PM". */
export const formatDatedMention = (mention: DatedMention): string => {
    const date = mention.date;
    const day = date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    if (mention.timeMinutes != null) {
        const h = Math.floor(mention.timeMinutes / 60);
        const mm = mention.timeMinutes % 60;
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 === 0 ? 12 : h % 12;
        return `${day}, ${h12}:${String(mm).padStart(2, '0')} ${ampm}`;
    }
    return day;
};

/** Derive a clean one-line title from an endorsement body (first non-empty
 *  line, HTML stripped, whitespace collapsed, 90 chars max). */
export const endorsementTitleFrom = (content: string): string => {
    const plain = (content || '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .trim();
    const firstLine = plain.split('\n').map((l) => l.trim()).find(Boolean) || '';
    const collapsed = firstLine.replace(/\s+/g, ' ').trim();
    if (!collapsed) return 'Case endorsement';
    return collapsed.length > 90 ? `${collapsed.slice(0, 90).trimEnd()}…` : collapsed;
};
