/**
 * convex/invoiceNumbering.ts — SERVER-SIDE, ATOMIC, PER-FIRM INVOICE
 * NUMBERING (V2, V-FIN-6).
 *
 * Before V2 the invoice number was generated on the CLIENT from
 * `existingInvoiceCount + 1` (src/utils/invoiceHelpers.generateInvoiceNumber):
 * two staff creating invoices at the same moment read the same count and
 * issued the SAME number; the retainer engine stamped `INV-RET-` + the last
 * six digits of Date.now() (collides within the same second window). Both
 * paths are replaced by this module — the same financial_counters
 * read-modify-write pattern the Atrium receipt engine has used since Round B
 * (M8): the counter row is patched INSIDE the creating transaction, so
 * Convex's serializable isolation makes concurrent invoice creations
 * conflict on the counter row and retry — sequential AND unique by
 * construction.
 *
 * FORMAT PRESERVED (the "Negative Rule" from invoiceHelpers): the number is
 * computed once at creation and persisted as a plain string:
 *     INV-[FirmInitials][LeadInitials]-[0001…]
 *     e.g. INV-AJ-0007 (solo) · INV-AJMA-0007 (multi-user) · INV-ORG-0007
 *
 * CONTINUITY: the first server-issued number per firm continues the legacy
 * client-generated sequence — the counter initialises to the largest 4-digit
 * (or shorter) trailing sequence found in the firm's existing numbers, so
 * INV-AJ-0001…0009 are followed by INV-XX-0010, never by INV-XX-0001 again.
 */

/** Connector words that never contribute initials (mirrors invoiceHelpers). */
const CONNECTOR_WORDS = new Set([
  "and", "&", "the", "of", "for", "in", "at", "by", "co", "lp", "llp", "llc", "ltd", "plc", "inc",
]);

/** "Avery & Jarvis Legal Practitioner" → "AJ" (server port of the client
 *  helper — the format must survive the migration to server numbering). */
export function extractFirmInitials(firmName: string | undefined | null): string {
  if (!firmName || !String(firmName).trim()) return "ORG";
  const tokens = String(firmName).trim().split(/\s+/);
  const initials: string[] = [];
  for (const token of tokens) {
    const clean = token.replace(/^[^A-Za-z]+/, "");
    if (!clean) continue;
    if (CONNECTOR_WORDS.has(clean.toLowerCase())) continue;
    initials.push(clean[0].toUpperCase());
  }
  return initials.slice(0, 4).join("") || "ORG";
}

/** "Mark Anthony" → "MA"; "Amina" → "A". */
export function extractPersonInitials(name: string | undefined | null): string {
  if (!name || !String(name).trim()) return "";
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Roles that don't count as active firm members (mirrors invoiceHelpers). */
const NON_MEMBER_ROLES = new Set(["Client", "Tenant", "Pending", "ExternalCounsel"]);

/**
 * Assemble the firm-branded prefix: firm initials + (multi-user firms only)
 * the lead professional's initials.
 */
export function invoiceNumberPrefix(firm: { name?: string | null } | null | undefined, users: Array<{ name?: string | null; role?: string | null }> | null | undefined): string {
  const firmSegment = extractFirmInitials(firm?.name);
  const members = (users || []).filter((u) => u && !NON_MEMBER_ROLES.has(String(u.role ?? "")));
  let leadSegment = "";
  if (members.length > 1) {
    const lead = members.find((u) => String(u.role ?? "") === "Admin") ?? members[0];
    leadSegment = extractPersonInitials(lead?.name);
  }
  return `${firmSegment}${leadSegment}`;
}

/**
 * Largest ≤4-digit trailing sequence in the firm's existing invoice numbers
 * (0001-style continuation; the retainer engine's 6-digit Date.now() junk and
 * foreign formats are ignored so the sequence stays human).
 */
export function maxLegacySequence(invoiceNumbers: Array<string | null | undefined> | null | undefined): number {
  let max = 0;
  for (const raw of invoiceNumbers || []) {
    if (!raw) continue;
    const m = String(raw).match(/(\d+)\s*$/);
    if (!m) continue;
    const digits = m[1];
    if (digits.length > 4) continue; // 6-digit retainer stamps / other formats
    const n = parseInt(digits, 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max;
}

/**
 * Issue the next invoice number for a firm — the ONE creation-time authority.
 * Read-modify-writes the firm's `financial_counters` row (scope "invoices")
 * inside the caller's transaction; concurrent creators conflict on that row
 * and are retried by Convex, so every call returns a distinct, sequential
 * number. First use per firm seeds the counter from the legacy sequence.
 */
export async function issueInvoiceNumber(
  ctx: any,
  firmId: string,
): Promise<string> {
  const now = Date.now();

  const counter = await ctx.db
    .query("financial_counters")
    .withIndex("by_firm_scope", (q: any) => q.eq("firmId", firmId).eq("scope", "invoices"))
    .first();

  let sequence: number;
  if (counter) {
    sequence = counter.value + 1;
    await ctx.db.patch(counter._id, { value: sequence, updatedAt: now });
  } else {
    // Seed from history: continue the client-generated 0001-style sequence.
    const firmInvoices: any[] = await ctx.db
      .query("invoices")
      .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
      .collect();
    sequence = maxLegacySequence(firmInvoices.map((i) => i?.invoiceNumber)) + 1;
    await ctx.db.insert("financial_counters", {
      firmId,
      scope: "invoices",
      value: sequence,
      updatedAt: now,
    });
  }

  // Prefix from server-side records (firm + users), never client claims.
  let firm: any = null;
  try { firm = await ctx.db.get(firmId); } catch { firm = null; }
  const users: any[] = await ctx.db
    .query("users")
    .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
    .collect();
  const prefix = invoiceNumberPrefix(firm, users);

  return `INV-${prefix}-${String(sequence).padStart(4, "0")}`;
}
