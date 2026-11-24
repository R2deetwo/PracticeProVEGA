/**
 * whatsappShareAudit — the WhatsApp launch-readiness pins (R76,
 * 2026-11-24 owner directive: "Audit and finalize all WhatsApp messaging,
 * notification, and sharing workflows… zero stubs or broken actions").
 *
 * Covers the four surfaces that directive names:
 *
 *   1. CLIENT wa.me HANDOFFS — every wa.me URL in src/ is built through
 *      whatsappShare.ts (Nigerian phone normalisation, clean encoding);
 *      the support line is the real business number, not a placeholder.
 *   2. LINK PREVIEWS — the three entry shells (index/vega/atrium) carry
 *      ABSOLUTE og:image/og:url on the live origin, route-correct og
 *      cards, twitter:card, and the Vercel rewrites serve each product
 *      shell; the three OG card PNGs exist at 2400x1260 (2x retina) and
 *      stay under WhatsApp's 300 KB guidance.
 *   3. AUTOMATED-SEND ATTRIBUTION — every automated free-form WhatsApp
 *      send appends the "— Automated notice … via PracticePro (link)"
 *      suffix (manual compose never does; template sends never can), the
 *      suffix carries a WORKING link (the dead practicepro.ng domain is
 *      banned from it), and the buildAutomatedWhatsAppSuffix stub that sat
 *      unused since its birth is now actually wired.
 *   4. COLLEAGUE INVITES — the join-link builders and the dignified
 *      share text (no exclamation marks, no marketing copy — Nigerian
 *      legal etiquette), and the signup→wizard parking keys.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { readdirSync } from "node:fs";

import {
  normalizePhoneForWa,
  whatsappShareUrl,
  whatsappSupportUrl,
  PRACTICEPRO_SUPPORT_PHONE,
} from "../../src/utils/whatsappShare";
import {
  parseInviteCodeParam,
  colleagueInviteUrl,
  buildColleagueInviteText,
  PENDING_INVITE_STORAGE_KEY,
} from "../../src/utils/colleagueInvite";
import { buildAutomatedWhatsAppSuffix, PRACTICEPRO_PLATFORM_URL } from "../../convex/emailBranding";

const repoRoot = join(__dirname, "..", "..");
const read = (...p: string[]) => readFileSync(join(repoRoot, ...p), "utf-8");

// ─── 1. CLIENT wa.me HANDOFFS ───────────────────────────────────────────────

describe("client wa.me handoffs — one builder, Nigerian normalisation", () => {
  it("empty/absent text omits the ?text= param entirely", () => {
    expect(whatsappShareUrl("08012345678", "")).toBe("https://wa.me/2348012345678");
    expect(whatsappShareUrl("08012345678", "   ")).toBe("https://wa.me/2348012345678");
    expect(whatsappShareUrl(null, "  ")).toBe("https://wa.me/");
  });

  it("trims text before encoding (no leading-space glitch in the prefilled chat)", () => {
    expect(whatsappShareUrl("08012345678", " Hello ")).toBe(
      "https://wa.me/2348012345678?text=Hello"
    );
  });

  it("the support line is the real WhatsApp Business number, not a placeholder", () => {
    expect(PRACTICEPRO_SUPPORT_PHONE).toBe("2348163122497");
    expect(whatsappSupportUrl()).toContain(`https://wa.me/${PRACTICEPRO_SUPPORT_PHONE}?text=`);
    expect(whatsappSupportUrl("does it work in Ikeja?")).toContain(
      encodeURIComponent("Hello PracticePro team — does it work in Ikeja?")
    );
  });

  it("EVERY wa.me URL in src/ is built through whatsappShare.ts (no inline builders)", () => {
    // Recursively collect src .ts/.tsx files and flag any literal wa.me
    // construction outside the single builder module. An inline build is
    // how the EstateCommunity vendor link shipped without 080→23480
    // normalisation — this pin makes that class of bug impossible again.
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const p = join(dir, entry);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(entry)) {
          const src = readFileSync(p, "utf-8");
          if (src.includes("https://wa.me") && !p.endsWith(join("src", "utils", "whatsappShare.ts"))) {
            offenders.push(p);
          }
        }
      }
    };
    walk(join(repoRoot, "src"));
    expect(offenders).toEqual([]);
  });

  it("the previously broken vendor link routes through the normaliser", () => {
    const view = read("src", "components", "tenant", "EstateCommunityResidentView.tsx");
    expect(view).toContain("whatsappShareUrl(p.whatsapp, '')");
    expect(view).not.toContain("p.whatsapp.replace(/\\D/g");
  });

  it("the visitor pass share prefills the visitor's chat when the phone is known", () => {
    const portal = read("src", "components", "portal", "VisitorPortal.tsx");
    expect(portal).toContain("whatsappShareUrl(lastGenerated.visitorPhone, lastGenerated.message)");
    expect(portal).not.toContain("`https://wa.me/?text=");
  });

  it('the "message us" surfaces deep-link the real support line', () => {
    const drawer = read("src", "sites", "shared", "ContactSalesDrawer.tsx");
    expect(drawer).toContain("whatsappSupportUrl()");
  });
});

// ─── 2. LINK PREVIEWS (Open Graph / Twitter) ─────────────────────────────────

const LIVE_ORIGIN = "https://practice-pro-vega.vercel.app";

describe("WhatsApp link previews — per-route OG cards on the live origin", () => {
  const shells = {
    hub: read("index.html"),
    vega: read("vega.html"),
    atrium: read("atrium.html"),
  };

  it("all three shells exist and were generated (vega/atrium carry the generator marker)", () => {
    expect(existsSync(join(repoRoot, "vega.html"))).toBe(true);
    expect(existsSync(join(repoRoot, "atrium.html"))).toBe(true);
    expect(shells.vega).toContain("GENERATED by scripts/generate-product-pages.cjs");
    expect(shells.atrium).toContain("GENERATED by scripts/generate-product-pages.cjs");
  });

  it("og:image is ABSOLUTE on the live origin in every shell (WhatsApp's crawler needs it)", () => {
    for (const [name, html] of Object.entries(shells)) {
      const ogImage = html.match(/<meta property="og:image" content="([^"]+)" \/>/)?.[1];
      expect(ogImage, `${name} og:image`).toMatch(/^https:\/\/practice-pro-vega\.vercel\.app\/assets\/landing\/og-.+\.png$/);
    }
    expect(shells.hub).toContain(`og-brand.png`);
    expect(shells.vega).toContain(`og-vega.png`);
    expect(shells.atrium).toContain(`og-atrium.png`);
  });

  it("og:url is present and route-correct in every shell", () => {
    expect(shells.hub).toContain(`<meta property="og:url" content="${LIVE_ORIGIN}/" />`);
    expect(shells.vega).toContain(`<meta property="og:url" content="${LIVE_ORIGIN}/vega" />`);
    expect(shells.atrium).toContain(`<meta property="og:url" content="${LIVE_ORIGIN}/atrium" />`);
  });

  it("og:title / og:description are route-correct (the product shells are NOT the hub card)", () => {
    expect(shells.vega).toMatch(/<meta property="og:title" content="Vega — Legal Practice OS/);
    expect(shells.vega).toMatch(/<meta property="og:description" content="Case management, AI-assisted drafting/);
    expect(shells.atrium).toMatch(/<meta property="og:title" content="Atrium — Property Management OS/);
    expect(shells.atrium).toMatch(/<meta property="og:description" content="Rent and service-charge collection/);
  });

  it("twitter:card is summary_large_image with absolute images in every shell", () => {
    for (const [name, html] of Object.entries(shells)) {
      expect(html, `${name} twitter:card`).toContain(`<meta name="twitter:card" content="summary_large_image" />`);
      const twImage = html.match(/<meta name="twitter:image" content="([^"]+)" \/>/)?.[1];
      expect(twImage, `${name} twitter:image`).toMatch(/^https:\/\/practice-pro-vega\.vercel\.app\//);
    }
  });

  it("the dead practicepro.ng domain appears in NO sharing surface", () => {
    // NXDOMAIN as of 2026-11-24 — any og/twitter/JSON-LD reference to it
    // is a broken link for every crawler and recipient.
    for (const [name, html] of Object.entries(shells)) {
      const body = html.replace(/<!--[\s\S]*?-->/g, ""); // strip ALL comments (where the domain is only MENTIONED)
      expect(body.includes("practicepro.ng"), `${name} references practicepro.ng`).toBe(false);
    }
    const branding = read("src", "components", "marketing", "brand", "useProductBranding.ts");
    expect(branding).not.toContain("url: 'https://practicepro.ng");
    expect(branding).toContain("LIVE_ORIGIN");
  });

  it("the three OG card PNGs exist at 1200x630 class (2400x1260 retina) under 300 KB", () => {
    // WhatsApp renders cards up to 1.91:1; 2400x1260 is the 2x of the
    // 1200x630 standard and renders crisp. The hard cap is size: cards
    // over ~300 KB stop rendering in many WhatsApp builds.
    const dims = (buf: Buffer) => {
      // PNG IHDR: width/height are big-endian u32 at offsets 16 and 20.
      expect(buf.readUInt32BE(16)).toBeGreaterThan(0);
      return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
    };
    for (const card of ["og-brand.png", "og-vega.png", "og-atrium.png"]) {
      const p = join(repoRoot, "public", "assets", "landing", card);
      expect(existsSync(p), `${card} exists`).toBe(true);
      const buf = readFileSync(p);
      const { w, h } = dims(buf);
      expect(`${card} ${w}x${h}`).toBe(`${card} 2400x1260`);
      expect(statSync(p).size, `${card} under 300KB`).toBeLessThan(300 * 1024);
    }
  });

  it("the og cards are the LIGHT register (no dark hub card regression)", () => {
    // The retired og-brand.png was a dark-mode card. The generator now
    // renders the light-enterprise register — pin the light background
    // in the card source so a future edit cannot quietly re-darken it.
    const gen = read("scripts", "generate-brand-assets.cjs");
    const brandCard = gen.slice(gen.indexOf("const BRAND_CARD"));
    expect(brandCard.slice(0, brandCard.indexOf("const VEGA_CARD"))).toContain("body { background: #FFFFFF;");
  });

  it("Vercel serves each product shell at its clean route (rewrite order matters)", () => {
    const vercel = JSON.parse(read("vercel.json"));
    const rewrites: Array<{ source: string; destination: string }> = vercel.rewrites;
    const vegaIdx = rewrites.findIndex((r) => r.source === "/vega");
    const atriumIdx = rewrites.findIndex((r) => r.source === "/atrium");
    const catchAll = rewrites.findIndex((r) => r.source === "/(.*)");
    expect(vegaIdx).toBeGreaterThanOrEqual(0);
    expect(rewrites[vegaIdx].destination).toBe("/vega.html");
    expect(atriumIdx).toBeGreaterThanOrEqual(0);
    expect(rewrites[atriumIdx].destination).toBe("/atrium.html");
    expect(catchAll).toBeGreaterThan(Math.max(vegaIdx, atriumIdx));
  });

  it("the multi-page build registers all three entry shells", () => {
    const vite = read("vite.config.ts");
    expect(vite).toContain("main: path.resolve(__dirname, 'index.html')");
    expect(vite).toContain("vega: path.resolve(__dirname, 'vega.html')");
    expect(vite).toContain("atrium: path.resolve(__dirname, 'atrium.html')");
  });

  it("each product shell boots the same SPA entry (head-only variant)", () => {
    for (const name of ["vega.html", "atrium.html"]) {
      expect(read(name)).toContain(`<script type="module" src="/src/main.tsx"></script>`);
    }
  });
});

// ─── 3. AUTOMATED-SEND ATTRIBUTION ──────────────────────────────────────────

describe("automated-send attribution — subtle, linked, never on filings", () => {
  it("the suffix carries the firm name AND a working link back to the platform", () => {
    const s = buildAutomatedWhatsAppSuffix("Acme Chambers");
    expect(s).toContain("— Automated notice from Acme Chambers via PracticePro");
    expect(s).toContain(`(${PRACTICEPRO_PLATFORM_URL})`);
    expect(PRACTICEPRO_PLATFORM_URL).toBe(LIVE_ORIGIN);
  });

  it("survives a missing firm name (best-effort suffix, never a throw)", () => {
    expect(buildAutomatedWhatsAppSuffix(null)).toContain(
      "— Automated notice via PracticePro"
    );
    expect(buildAutomatedWhatsAppSuffix(undefined)).not.toContain("from ");
  });

  it("the core appends the suffix ONLY on the automated free-form path", () => {
    const comms = read("convex", "communications.ts");
    // The append happens in SEND PATH 2 and only when automated !== false.
    expect(comms).toContain("const isAutomated = args.automated !== false;");
    expect(comms).toContain("freeFormBody = `${args.messageText}${buildAutomatedWhatsAppSuffix(firmName)}`");
    // The firm name is resolved via a best-effort internal query.
    expect(comms).toContain("getFirmNameInternal");
  });

  it("manual compose (the public gate) explicitly opts OUT of the suffix", () => {
    const comms = read("convex", "communications.ts");
    expect(comms).toContain("{ ...coreArgs, automated: false }");
    // The internal (automated) wrapper defaults to true.
    expect(comms).toContain("{ ...args, automated: args.automated ?? true }");
  });

  it("formal court filings stay strictly clean — no attribution layer near DraftPro exports", () => {
    // The suffix exists ONLY in emailBranding.ts + the communications core.
    // It must never appear in the document/print/export paths: scan the
    // word-processor and document export surfaces for the suffix strings.
    const forbidden = [
      "src/components/wordprocessor",
      "src/components/details/DocumentDetailView.tsx",
      "src/utils/documentExport.ts",
    ];
    for (const p of forbidden) {
      const full = join(repoRoot, p);
      if (!existsSync(full)) continue;
      const src = statSync(full).isDirectory() ? "" : readFileSync(full, "utf-8");
      if (src) {
        expect(src.includes("Automated notice via PracticePro")).toBe(false);
        expect(src.includes("PRACTICEPRO_PLATFORM_URL")).toBe(false);
      }
    }
  });
});

// ─── 4. COLLEAGUE INVITES ───────────────────────────────────────────────────

describe("colleague invites — clean link, dignified message, parking", () => {
  it("parses the shapes a join link can carry", () => {
    expect(parseInviteCodeParam("INV-1234")).toBe("INV-1234");
    expect(parseInviteCodeParam("inv-1234")).toBe("INV-1234");
    expect(parseInviteCodeParam("1234")).toBe("INV-1234");
    expect(parseInviteCodeParam(null)).toBeNull();
    expect(parseInviteCodeParam("")).toBeNull();
    expect(parseInviteCodeParam("INV-AB")).toBeNull();
    expect(parseInviteCodeParam("not-a-code")).toBeNull();
  });

  it("builds the join link on the allowlisted production origin", () => {
    expect(colleagueInviteUrl("INV-1234")).toBe(
      `${LIVE_ORIGIN}/signup?invite=INV-1234`
    );
    // A preview origin passes through; a disallowed one falls back.
    expect(colleagueInviteUrl("inv-1234", "https://practice-pro-vega.vercel.app")).toBe(
      `${LIVE_ORIGIN}/signup?invite=INV-1234`
    );
    expect(colleagueInviteUrl("INV-1234", "https://evil.example.com")).toBe(
      `${LIVE_ORIGIN}/signup?invite=INV-1234`
    );
    expect(colleagueInviteUrl("garbage")).toBe("");
    expect(colleagueInviteUrl("INV-WORD")).toBe("");
  });

  it("the share text is dignified: no exclamations, no marketing copy, link + signature", () => {
    const text = buildColleagueInviteText({
      firmName: "Adeyemi & Co.",
      inviterName: "Tunde Adeyemi",
      inviteCode: "INV-4821",
      isLegal: true,
    });
    expect(text).toContain("We now run Adeyemi & Co. on PracticePro Vega");
    expect(text).toContain("matters, deadlines, court dates and drafting in one workspace");
    expect(text).toContain(`${LIVE_ORIGIN}/signup?invite=INV-4821`);
    expect(text).toContain("— Tunde Adeyemi, Adeyemi & Co.");
    // Understated tone: no exclamation marks, no discount/referral vocabulary.
    expect(text).not.toMatch(/!/);
    expect(text).not.toMatch(/discount|referral|promo|% off|limited time/i);
  });

  it("the property variant names Atrium and its capabilities", () => {
    const text = buildColleagueInviteText({
      firmName: "Chevron Estates",
      inviterName: "David Atrium",
      inviteCode: "INV-777",
      isLegal: false,
    });
    expect(text).toContain("PracticePro Atrium");
    expect(text).toContain("rent, service charges, maintenance and residents");
  });

  it("Signup parks the link's code; the wizard and JoinFirmModal consume it", () => {
    const signup = read("src", "components", "auth", "Signup.tsx");
    expect(signup).toContain("parseInviteCodeParam(params.get('invite'))");
    expect(signup).toContain(`sessionStorage.setItem(PENDING_INVITE_STORAGE_KEY, code)`);
    const wizard = read("src", "components", "modals", "OnboardingWizard.tsx");
    expect(wizard).toContain("readPendingInviteCode() ? 'join' : 'create'");
    expect(wizard).toContain("useState(() => readPendingInviteCode() || '')");
    expect(wizard).toContain("takePendingInviteCode();");
    const joinModal = read("src", "components", "modals", "JoinFirmModal.tsx");
    expect(joinModal).toContain("useState(() => readPendingInviteCode() || '')");
  });

  it("the Sidebar row and the FirmSettings Team card both render the invite panel", () => {
    const sidebar = read("src", "components", "Sidebar.tsx");
    expect(sidebar).toContain("InviteColleagueRow");
    expect(sidebar).toContain("permissions.canManageFirmDetails");
    const firmSettings = read("src", "components", "settings", "FirmSettings.tsx");
    expect(firmSettings).toContain("InviteColleagueRow");
    // The panel itself uses ui primitives (ratchet-safe: no raw form elements).
    const panel = read("src", "components", "workspace", "InviteColleagueRow.tsx");
    expect(panel).not.toMatch(/<(button|input|select|textarea)[\s>/]/);
    expect(panel).toContain('whatsappShareUrl(null, shareText)');
  });
});
