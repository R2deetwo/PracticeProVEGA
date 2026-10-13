/**
 * Website-repositioning regression suite — W0–W11.
 *
 * Pins the PracticePro Systems brand architecture on the public website
 * (docs/brand-architecture.md), the same way corporateIdentity.test.ts pins
 * it in the legal documents:
 *
 *   - Company:  PracticePro Systems Limited ("PracticePro")
 *   - Products: PracticePro Vega (legal), PracticePro Atrium (property),
 *               Komplete (the bundle)
 *   - Client commissions: Kozy Care (live at kozycare.ng)
 *   - W6 (2026-10-07, owner direction): the root page is the company's full
 *     corporate home — it sells the BUILDER (what we do, what we've built,
 *     how we work, how to reach us), not just the product picker. The
 *     company-and-location eyebrow is retired from the top of the page.
 *   - W7 (2026-10-07, owner direction): the wow site — a cinematic dark hero
 *     with a WebGL morphing brand orb, and a portfolio showroom where every
 *     project carries REAL SCREENS from the live systems plus its stack and
 *     what's inside. Positioning broadened: “we build systems” — Lagos is
 *     where we work from, not a limit on where we work.
 *   - W8 (2026-10-08, owner direction): structured fluidity — the blob becomes
 *     a system: a morphing crystal lattice with wireframe, nodes, rings and a
 *     constellation network. Sections melt into one another through liquid
 *     seams, the nav carries a fluid pill, and auth (Log In / Start Free
 *     Trial) lives with the products, not on the company page. Alpha 3D
 *     (the W7 orb) is preserved at git tag `alpha-3d` for rollback.
 *   - W9 (2026-10-08, owner direction): the living page — the logo assembles
 *     in 3D where “What can we build for you?” lands and its squares ride
 *     down the rest of the page; the process section walks itself step by
 *     step; text settles in softly; the seams reshape as you scroll; a
 *     workflow & notification capability joins the services; and “Preview
 *     the system” becomes an interactive guided tour (clearly-labeled demo
 *     data) with the real screens alongside.
 *   - Honest marketing (P8): no fabricated testimonial personas, no
 *     fabricated structured-data ratings, and the tour is labeled demo data.
 *   - W10 (2026-10-08, owner direction): the mark becomes the system — the
 *     intact logo in a box; the streak-squares layer retired; SVG wave
 *     seams; the preview is REAL CAPTURES ONLY (demo data is fine, mocked-up
 *     UI is not).
 *   - W11 (2026-10-08, owner direction): the interiors go real — Kozy Care's
 *     signed-in ordering flow, portal with a live order, invoice, membership
 *     states and admin console, all captured from the live product; plus
 *     Woosh, our own free temporary-email tool (live at woosh.dpdns.org),
 *     joins the portfolio with its API story.
 *   - W12 (2026-10-08, owner direction): the breaking-apart of the logo is
 *     RETIRED FOR GOOD — the mark is never disassembled. (Superseded below.)
 *   - W13 (2026-10-08, owner direction): the mark LEAVES the What-we-do
 *     section entirely — no box, no traces (the full-page trace overlay
 *     drew its lines over the section's headings; that class of bug is now
 *     structurally impossible). In its place: a real three.js rendering —
 *     the system core, seven glass modules orbiting a faceted engine, one
 *     per capability — drawn strictly INSIDE its own canvas.
 *   - W14 (2026-10-08, owner direction): navigation truth (the logo and the
 *     Products menu move the URL — /, /vega, /atrium — like every visitor
 *     expects); the hero orb ZIPS a point toward the pointer with a damped
 *     wave and an opposite-side echo; the What-we-do shapes MORPH (cubes
 *     melt into pyramids, prisms, octahedra) and DESCEND into the capability
 *     cards on scroll, each card receiving its own wireframe shape; the
 *     caption jargon "Seven modules. One system." becomes the owner's own
 *     "Making your systems one."; the hero stops selling the product
 *     catalogue; and a new "Sound familiar?" section mirrors the visitor's
 *     daily friction first, because people who need a system don't know
 *     they want one yet.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = join(__dirname, "..", "..");
const read = (...p: string[]) => readFileSync(join(repoRoot, ...p), "utf-8");
const landing = read("src", "components", "LandingPage.tsx");
// P0 sites split: the three surfaces moved out of LandingPage.tsx into
// src/sites/{hub,vega,atrium}. The hub branch is now three files (the
// moved sections, the shell, the composition); `hub` is their union —
// the faithful equivalent of the old single-file hub branch.
// P1: HubSections.tsx was replaced by per-section files.
const hubHeroSection = read("src", "sites", "hub", "sections", "HeroSection.tsx");
const hubProducts = read("src", "sites", "hub", "sections", "ProductsSection.tsx");
const hubWhatWeBuild = read("src", "sites", "hub", "sections", "WhatWeBuildSection.tsx");
const hubWork = read("src", "sites", "hub", "sections", "WorkSection.tsx");
const hubSoundFamiliar = read("src", "sites", "hub", "sections", "SoundFamiliarSection.tsx");
const hubProcess = read("src", "sites", "hub", "sections", "ProcessSections.tsx");
const hubShell = read("src", "sites", "hub", "HubShell.tsx");
const hubIndex = read("src", "sites", "hub", "index.tsx");
const hub = [hubShell, hubIndex, hubHeroSection, hubProducts, hubWhatWeBuild,
  hubWork, hubSoundFamiliar, hubProcess].join("\n");
const vegaSite = read("src", "sites", "vega", "index.tsx");
const vegaShell = read("src", "sites", "vega", "VegaShell.tsx");
const atriumSite = read("src", "sites", "atrium", "index.tsx");
const atriumShell = read("src", "sites", "atrium", "AtriumShell.tsx");
const productPages = vegaSite + "\n" + vegaShell + "\n" + atriumSite + "\n" + atriumShell;
const sharedChrome = read("src", "sites", "shared", "useSiteChrome.ts");
const surfaces = landing + "\n" + hub + "\n" + productPages;
const index = read("index.html");
const tour = read("src", "components", "marketing", "SystemTour.tsx");
const css = read("src", "index.css");
// Vega Pass A — the page-specific rebuild files under marketing/vega/.
const vegaHero = read("src", "sites", "vega", "sections", "VegaHero.tsx");
const vegaMatters = read("src", "sites", "vega", "sections", "VegaMattersLedger.tsx");
const vegaProcedure = read("src", "sites", "vega", "sections", "VegaProcedure.tsx");
const vegaCredentials = read("src", "sites", "vega", "sections", "VegaCredentials.tsx");
const vegaFAQ = read("src", "sites", "vega", "sections", "VegaFAQInk.tsx");
const vegaFinalCTA = read("src", "sites", "vega", "sections", "VegaFinalCTA.tsx");
const atriumStats = read("src", "sites", "atrium", "sections", "AtriumStats.tsx");
const atriumFeatures = read("src", "sites", "atrium", "sections", "AtriumFeatures.tsx");
const atriumTrust = read("src", "sites", "atrium", "sections", "AtriumTrust.tsx");
const atriumAI = read("src", "sites", "atrium", "sections", "AtriumAI.tsx");
const atriumHowItWorks = read("src", "sites", "atrium", "sections", "AtriumHowItWorks.tsx");
const atriumWhyRunOn = read("src", "sites", "atrium", "sections", "AtriumWhyRunOn.tsx");
const atriumFAQ = read("src", "sites", "atrium", "sections", "AtriumFAQ.tsx");
const atriumFinalCTA = read("src", "sites", "atrium", "sections", "AtriumFinalCTA.tsx");

describe("W6/W7 — the root page is the company's corporate home", () => {
  it("the hero sells what the company does, value-first", () => {
    // P1 (owner direction): the scaling-noun promise is retired. The hero
    // opens with the company's plain promise, exact copy.
    expect(hub).toContain("We build the systems your business runs on.");
    expect(hub).toContain("PracticePro Systems designs, builds and runs business software from Lagos.");
    expect(hub).toContain("Two products of our own, Vega for law firms and Atrium for property");
    expect(hub).toContain("plus custom systems for clients.");
    expect(hub).not.toContain("SCALE_NOUNS");
    expect(hub).not.toContain("ScalingNoun");
    // The hero CTAs: one primary (moss) + one text link (P1 C1).
    expect(hub).toContain("Talk to us");
    expect(hub).toContain("See our work");
    // The static system diagram — four labelled nodes, no WebGL.
    expect(hub).toContain("WhatsApp order");
    expect(hub).toContain("One queue");
    expect(hub).toContain("Ledger");
    expect(hub).toContain("Receipt");
    expect(hub).not.toContain("MorphScene");
    expect(hub).not.toContain("SystemCoreScene");
  });

  it("W17 — the page decorates in the brand's green, not amber (owner: “quite a cry from my colors”)", () => {
    // Gradient type: mint → emerald → green, never amber-led. W18: the
    // ramp is painted per span — “scale your” wears mint → emerald, the
    // cycling noun wears emerald → green (see the W18 test below).
    // P1: the gradient headline is retired with the scaling noun; the
    // amber ban stays forever.
    expect(hub).not.toContain("#F59E0B");
    // The clouds/aurora glows are green.
    expect(hub).not.toContain("bg-amber-500/10 blur-[110px]");
    expect(hub).not.toContain("bg-amber-500/[0.07]");
    expect(hub).not.toContain("bg-amber-400/70");
    // P1: the 3D scenes (MorphScene, SystemCoreScene) are deleted with
    // their colour contracts — the hub has no WebGL at all.
    // The hero's structural fallback cloud is mint too.
    expect(css).not.toContain("rgba(217, 119, 6, 0.15)");
    expect(css).not.toContain("linear-gradient(135deg, #F59E0B, #16A34A)");
    // Vega keeps its amber PRODUCT identity (product coding, not page
    // decoration) — that contract is untouched.
    expect(css).toContain("--color-amber: #D97706");
  });

  it("the hero positions the company broadly — we build systems, not 'a Lagos software company' (W7)", () => {
    expect(hub).toContain("PracticePro Systems designs, builds and runs");
    expect(hub).not.toContain("is a Lagos software company");
  });

  it("the company-and-location eyebrow is retired from the top of the page", () => {
    expect(hub).not.toContain("PracticePro Systems · Lagos, Nigeria");
  });

  it("the corporate nav walks the company sections", () => {
    expect(hub).toContain("Products");
    expect(hub).toContain("Work");
    expect(hub).toContain("How we work");
    expect(hub).toContain("About");
  });

  it("the services section presents builder capabilities", () => {
    // P1 C3: the card grid is now a ruled index table; the seven
    // capabilities and their copy survive.
    expect(hub).toContain("WHAT_WE_BUILD");
    expect(hub).toContain("Custom business systems");
    expect(hub).toContain("Custom integrations");
    expect(hub).toContain("Payments & revenue operations");
    expect(hub).toContain("Hosting, security & compliance");
  });

  it("the engagement process is presented", () => {
    expect(hub).toContain("HOW_WE_WORK");
    expect(hub).toContain("From first conversation to a system you scale with");
    expect(hub).toContain("Understand your operations");
    expect(hub).toContain("Launch, train & run with you");
  });

  it("the about section grounds the company in Lagos honestly", () => {
    expect(hub).toContain("Run in production.");
    expect(hub).toContain(
      "PracticePro Systems is a software company based in Lagos, Nigeria."
    );
  });
});

describe("W6 — the portfolio: products + client commissions", () => {
  it("presents the systems the company has built", () => {
    expect(hub).toContain("OUR_WORK");
    expect(hub).toContain("Systems we&apos;ve built");
  });

  it("Vega and Atrium link to their product pages", () => {
    expect(hub).toContain("Vega — Legal Practice OS");
    expect(hub).toContain("Atrium — Property Management OS");
    expect(hub).toContain('href="/vega"');
    expect(hub).toContain('href="/atrium"');
  });

  it("Kozy Care is presented as a client commission, live at kozycare.ng", () => {
    expect(hub).toContain("Kozy Care");
    expect(hub).toContain("Built for a client");
    expect(hub).toContain("https://kozycare.ng");
  });

  it("every work card carries the Built-by mark", () => {
    expect(hub).toContain("Built by PracticePro");
  });

  it("the hub footer sells the custom-systems line of business", () => {
    expect(hub).toContain("Custom systems — built to order");
    expect(hub).toContain("Kozy Care — a client build");
  });
});

describe("W7 — the wow site: real screens, stack, and the preview system", () => {
  it("every project showcases REAL SCREENS captured from the live systems", () => {
    // Vega — product page + real mobile-app screens + client portal
    expect(hub).toContain("/assets/landing/work/vega-page.jpg");
    expect(hub).toContain("/assets/landing/work/vega-calendar.jpg");
    expect(hub).toContain("/assets/landing/work/vega-messages.jpg");
    expect(hub).toContain("/assets/landing/work/vega-portal.jpg");
    // Atrium — product page + the financials app screen + residents' portal
    expect(hub).toContain("/assets/landing/work/atrium-page.jpg");
    expect(hub).toContain("/assets/landing/work/atrium-financials.jpg");
    expect(hub).toContain("/assets/landing/work/atrium-portal.jpg");
    // Kozy Care — the client's live customer-facing system
    expect(hub).toContain("/assets/landing/work/kozy-home.jpg");
    expect(hub).toContain("/assets/landing/work/kozy-services.jpg");
    expect(hub).toContain("/assets/landing/work/kozy-memberships.jpg");
  });

  it("each project presents its stack and what's inside it", () => {
    expect(hub).toContain("Built with");
    expect(hub).toContain("Inside the system");
    // Stack chips for all three systems (honest — verified against the repos)
    expect(hub).toContain("'React + TypeScript', 'Convex'");
    expect(hub).toContain("'Gemini AI'");
    expect(hub).toContain("'Next.js', 'Prisma + Supabase'");
    expect(hub).toContain("'Paystack'");
    // What's inside
    expect(hub).toContain("'AI drafting — DraftPro & ALOA'");
    expect(hub).toContain("'GPS rider dispatch — 12 zones'");
  });

  it("the preview modal opens per project and offers the live system + contact", () => {
    expect(hub).toContain("WorkDetailModal");
    expect(hub).toContain("Preview the system");
    expect(hub).toContain("Ask us about a system like this");
  });

  it("the hero carries the morphing system with a structural CSS fallback", () => {
    // RETIRED (P1): MorphScene is deleted; the hero is a static system
    // diagram. The pins now assert the retirement holds.
    expect(hub).not.toContain("MorphScene");
    expect(hub).not.toContain("w8-lattice-fallback");
  });
});

describe("W8 — structured fluidity: the lattice system", () => {
  it("RETIRED (P1) — the hero shows structure that morphs — a system lattice, not a blob", () => {
    expect(hub).not.toContain("w8-lattice");
  });


  it("RETIRED (P1) — sections pour into each other through visible SVG waves that morph as you scroll (W10)", () => {
    expect(hub).not.toContain("FluidSeam");
  });


  it("RETIRED (P1) — the nav carries a fluid pill that morphs between sections", () => {
    expect(hub).not.toContain("w8-nav-pill");
  });


  it("auth lives with the products, not on the company page", () => {
    // The hub hero no longer offers a sign-in…
    expect(hub).not.toContain("Already have an account?");
    // …the shell gates Log In / Start Free Trial to the product pages and
    // offers a quiet conversation on the company page instead. (P0: the
    // ternary NavBar is gone — each shell states its own register.)
    expect(productPages).toContain("Right Actions — Log In / Start Free Trial on product pages");
    expect(hub).toContain("Talk to us");
    expect(hub).toContain("Talk to us about your system");
    // The product pages keep their conversion machinery.
    expect(productPages).toContain("Start Free Trial");
    expect(productPages).toContain("Log In");
  });
});

describe("W9/W10/W13 — the living page, then the system core", () => {
  it("RETIRED (P1) — the What-we-do visual is a real 3D system core (W13)", () => {
    expect(hub).not.toContain("SystemCoreScene");
  });


  it("RETIRED (P1) — each capability card carries a quiet, always-on icon chip (W13)", () => {
    expect(hub).not.toContain("w14-chip");
  });


  it("RETIRED (P1) — everything renders INSIDE the canvas (W13)", () => {
    expect(hub).not.toContain("w13-");
  });


  it("RETIRED (P1) — the scene runs on the hero's engine contract", () => {
    expect(hub).not.toContain("w13-canvas");
  });


  it("the riding-squares layer is retired — no stray floaters (W10)", () => {
    expect(hub).not.toContain("SystemSquares");
    expect(css).not.toContain(".w9-squares-canvas");
  });

  it("RETIRED (P1) — text settles in softly across the hub (w9 reveal machinery)", () => {
    // The hub reveal is now a plain 200ms opacity fade (hub-reveal).
    expect(hub).not.toContain("w9-reveal");
    expect(hub).not.toContain("w9-step-node");
  });

  it("a workflow & notification capability joins the builder services", () => {
    expect(hub).toContain("Workflow & notification engines");
  });

  it("the preview goes INSIDE with REAL captures — no mocked-up UI (W10, W15)", () => {
    expect(hub).toContain("SystemTour");
    expect(hub).toContain("tourSystem: 'vega'");
    expect(hub).toContain("tourSystem: 'atrium'");
    expect(hub).toContain("tourSystem: 'kozy'");
    // W15: every stop is a feature story with a Desktop ⇄ Mobile toggle
    // wherever both real captures exist. The owner's review removed the
    // notifications panel (the stop is Messages, the real outbox) and
    // folded the matters board into “Matters” (the detail view).
    expect(tour).toContain("vega-demo-dashboard.jpg");
    expect(tour).toContain("vega-demo-messages.jpg");
    expect(tour).toContain("vega-demo-newmatter.jpg");
    expect(tour).toContain("vega-demo-matter-detail.jpg");
    expect(tour).toContain("vega-demo-billing.jpg");
    expect(tour).toContain("vega-demo-calendar.jpg");
    expect(tour).toContain("vega-demo-aloa.jpg");
    expect(tour).toContain("vega-portal.jpg");
    expect(tour).not.toContain("vega-demo-notifications.jpg");
    expect(tour).not.toContain("vega-demo-matters.jpg");
    // The mobile halves of the toggle pairs.
    expect(tour).toContain("vega-m-dashboard.jpg");
    expect(tour).toContain("vega-m-matters.jpg");
    expect(tour).toContain("vega-m-billing.jpg");
    expect(tour).toContain("vega-m-messages.jpg");
    expect(tour).toContain("atrium-demo-financials.jpg");
    expect(tour).toContain("kozy-order-service.jpg");
    // Every stop educates: outcome headline + “what it takes” ingredients.
    expect(tour).toContain("What it takes");
    expect(tour).toContain("Run the firm from one screen");
    expect(tour).toContain("Meet clients where they already are");
    expect(tour).toContain("Deadlines that compute themselves");
    // The form-factor toggle exists where both surfaces exist.
    expect(tour).toContain("'Desktop'");
    expect(tour).toContain("'Mobile'");
    // Auto-advance walk + pause on hover.
    expect(tour).toContain("DWELL_MS");
    expect(tour).toContain("onMouseEnter");
  });

  it("the tour is honest: every screen is labelled with exactly what it is", () => {
    expect(tour).toContain("Real app · demo data");
    expect(tour).toContain("The real mobile app");
    expect(tour).toContain("Live site");
    expect(tour).not.toContain("Guided tour · demo data");
  });

  it("Kozy Care's live gallery grows — booking, portal sign-in, partner network", () => {
    expect(hub).toContain("/assets/landing/work/kozy-book.jpg");
    expect(hub).toContain("/assets/landing/work/kozy-login.jpg");
    expect(hub).toContain("/assets/landing/work/kozy-partners.jpg");
    expect(hub).toContain("Payments, receipts & invoices — Paystack");
  });
});

describe("W11 — the interiors go real, and our own tool joins the portfolio", () => {
  it("Kozy Care quotes its real tagline on the card", () => {
    expect(hub).toContain("Uncompromising care. Exceptional convenience.");
  });

  it("the Kozy tour goes INSIDE — ordering, portal, invoice, membership, admin", () => {
    // The signed-in ordering flow, captured from the live product.
    expect(tour).toContain("kozy-order-service.jpg");
    expect(tour).toContain("kozy-order-logistics.jpg");
    expect(tour).toContain("kozy-order-checkout.jpg");
    // The customer portal with a live order, its detail and the invoice.
    expect(tour).toContain("kozy-portal-order.jpg");
    expect(tour).toContain("kozy-order-detail.jpg");
    expect(tour).toContain("kozy-invoice.jpg");
    // Membership states — joining and an active plan.
    expect(tour).toContain("kozy-membership-join.jpg");
    expect(tour).toContain("kozy-membership-active.jpg");
    // The admin console — order board, CRM, membership operations.
    expect(tour).toContain("kozy-admin-kanban.jpg");
    expect(tour).toContain("kozy-admin-crm.jpg");
    expect(tour).toContain("kozy-admin-members.jpg");
  });

  it("the Kozy gallery carries the interiors too", () => {
    expect(hub).toContain("/assets/landing/work/kozy-order-service.jpg");
    expect(hub).toContain("/assets/landing/work/kozy-portal-order.jpg");
    expect(hub).toContain("/assets/landing/work/kozy-invoice.jpg");
    expect(hub).toContain("/assets/landing/work/kozy-admin-crm.jpg");
  });

  it("Woosh — our own free tool — joins the portfolio as a fourth entry", () => {
    expect(hub).toContain("name: 'Woosh'");
    expect(hub).toContain("Our tool");
    expect(hub).toContain("https://woosh.dpdns.org");
    expect(hub).toContain("tourSystem: 'woosh'");
    // The stack story is capability-honest (no invented framework).
    expect(hub).toContain("REST API + webhooks");
    expect(hub).toContain("Verification-code extraction");
  });

  it("the Woosh tour shows the real tool in action, including Kozy mail", () => {
    expect(tour).toContain("woosh-home.jpg");
    expect(tour).toContain("woosh-inbox.jpg");
    expect(tour).toContain("woosh-message.jpg");
    expect(tour).toContain("woosh-dark.jpg");
    expect(tour).toContain("woosh-api.jpg");
  });

  it("the footer lists Woosh alongside the products and the client build", () => {
    expect(hub).toContain("Woosh — free temp email");
  });
});

describe("W14 — navigation truth, the pulse, the descent and the pitch", () => {
  it("the logo and All Products carry you home from any product page", () => {
    // R21: on a product page the brand is the PRODUCT lockup (mark +
    // wordmark + BY PRACTICEPRO) and it navigates back to the hub; on the
    // hub the PracticePro logo scrolls to the top. The two are separate
    // buttons now — no conditional handler.
    // P0: the ternary is gone by design — each product shell carries its
    // own narrowed literal lockup aria-label.
    expect(vegaShell).toContain('aria-label="Vega — a PracticePro product, back to all products"');
    expect(atriumShell).toContain('aria-label="Atrium — a PracticePro product, back to all products"');
    expect(productPages).toContain("onClick={onBackToHub}");
    expect(hub).toContain("onClick={() => scrollTo('home')}");
    expect(productPages).toContain("pathname !== '/'");
    expect(productPages).toContain("navigate('/')");
    expect(productPages).toContain("BY PRACTICEPRO");
  });

  it("selecting a product opens its own page in a NEW TAB (owner direction, R21)", () => {
    // The in-tab SPA product switch is retired: openProductPage opens
    // /vega or /atrium in a new tab and leaves this tab where it is.
    expect(surfaces).toContain("window.open(p === 'vega' ? '/vega' : '/atrium', '_blank', 'noopener,noreferrer')");
    expect(surfaces).not.toContain("navigate(target)");
    // Every product-selection surface opens the new tab.
    expect(hub).toContain("onOpenProduct('vega')");
    expect(hub).toContain("onOpenProduct('atrium')");
    // The footer's product entries are real anchors that open in new tabs.
    expect(hub).toContain('href="/vega" target="_blank" rel="noopener noreferrer"');
    expect(hub).toContain('href="/atrium" target="_blank" rel="noopener noreferrer"');
    // The work cards' Explore CTAs are external links now.
    expect(hub).toContain("label: 'Explore Vega', href: '/vega', external: true");
    expect(hub).toContain("label: 'Explore Atrium', href: '/atrium', external: true");
  });

  it("the hero sells the problem, not the product catalogue", () => {
    // The "Our products" quick-links are gone from the hero — too early.
    expect(hub).not.toContain("Our products</span>");
    // P1: the description is the owner's exact 30-word positioning; the
    // pain lives in 04 — SOUND FAMILIAR with the PAIN_MIRROR copy.
    expect(hubSoundFamiliar).toContain("PAIN_MIRROR");
    expect(hubSoundFamiliar).toContain("Orders and requests arrive by WhatsApp, SMS and walk-in");
  });

  it("a mirror before the pitch: Sound familiar? names the visitor's friction", () => {
    expect(hub).toContain("PAIN_MIRROR");
    expect(hub).toContain("04 — SOUND FAMILIAR");
    expect(hub).toContain("just not software");
    expect(hub).toContain("You need a system");
    expect(hub).toContain("Tell us what runs your business today");
    expect(hubIndex).toContain('<SoundFamiliarSection onContactSales');
  });

  it("RETIRED (P1) — MorphScene, SystemCoreScene, the descent and the Iso shapes", () => {
    // All deleted by owner direction (P1): no WebGL on the hub, no shape
    // watermarks, no scroll-linked descent.
    expect(hub).not.toContain("useLandingCards");
    expect(hub).not.toContain("w14-card");
    expect(hub).not.toContain("CARD_SHAPES");
    expect(hub).not.toContain("Iso");
  });
});

describe("W1/W2 — company-behind-products framing on the website", () => {
  it("the footer names the company's role and carries the Built-by mark", () => {
    expect(hub).toContain(
      "We design, build and run the systems businesses manage their affairs with"
    );
    expect(hub).toContain("From Lagos, for businesses anywhere");
    // P1 B2: the footer's exact attribution line.
    expect(hub).toContain("Vega and Atrium are built by PracticePro Systems Limited.");
  });

  it("product heroes carry the Built-by attribution eyebrow", () => {
    // Pass A: Vega's eyebrow moves to its own register ("The Chambers
    // Standard") so it no longer mirrors Atrium's "Product · Built by…"
    // pattern; the Built-by attribution itself survives on both pages.
    expect(vegaSite).toContain("'The Chambers Standard — Built by PracticePro'");
    expect(atriumSite).toContain("'Atrium · Built by PracticePro'");
  });

  it("sections name the product, never 'run on PracticePro'", () => {
    // Pass B: both attestations live in the product-owned files.
    expect(vegaCredentials).toContain("Why firms run on Vega");
    expect(atriumWhyRunOn).toContain("Why portfolios run on Atrium");
    expect(surfaces).not.toContain("run on PracticePro");
  });
});

describe("Vega rebrand Pass A — 'The Chambers Standard' page-specific sections", () => {
  it("/vega renders ONLY Vega-owned sections — zero shared sections, different inventory + order", () => {
    // P0 split: the vega render branch moved verbatim into its own file,
    // src/sites/vega/index.tsx — the <main> element IS the branch (the
    // shell chrome below it is the site's own, not shared sections).
    const body = vegaSite.slice(
      vegaSite.indexOf("<VegaHero"),
      vegaSite.indexOf("</main>")
    );
    // None of the shared template sections render on /vega.
    for (const s of [
      "StatsDemarcator",
      "FeaturesSection",
      "TrustBadgesStrip",
      "AICapabilitiesSection",
      "PricingSection",
      "HowItWorksSection",
      "WhyRunOnSection",
      "FAQSection",
      "FinalCTASection",
    ]) {
      expect(body).not.toContain(`<${s}`);
    }
    // The vega composition: 10 bands, this exact order (R21: the rate-card
    // band was removed by owner direction — pricing is sales-led now).
    const order = (body.match(/<(Vega[A-Za-z]+)/g) || []).map((t) =>
      t.slice(1)
    );
    expect(order).toEqual([
      "VegaHero",
      "VegaIndexLine",
      "VegaMattersLedger",
      "VegaAIDrafting",
      "VegaCourtRules",
      "VegaScaleOfCharges",
      "VegaProcedure",
      "VegaCredentials",
      "VegaFAQInk",
      "VegaFinalCTA",
    ]);
  });

  it("the vega branch never imports an atrium component and vice versa", () => {
    // Cross-page isolation: vega files import no atrium components.
    for (const src of [vegaHero, vegaMatters, vegaProcedure, vegaCredentials, vegaFAQ, vegaFinalCTA]) {
      expect(src).not.toContain("sites/atrium/");
      expect(src).not.toContain("../../atrium/");
      expect(src).not.toContain("AtriumHero");
      expect(src).not.toContain("AtriumReceipt");
    }
  });

  it("the hero is document-forward — night ground, no gradient headline", () => {
    // R22 "The Night Chambers": the h1 is parchment Fraunces at law-report
    // scale with ONE gilt-italic accent phrase — a SOLID colour span.
    // (The ban is on gradient TEXT: bg-clip-text / transparent glyphs.
    // The hero's night atmosphere is painted behind the type, never on it.)
    expect(vegaHero).not.toContain("bg-clip-text");
    expect(vegaHero).not.toContain("text-transparent");
    expect(vegaHero).not.toContain("font-vega-italic font-medium text-vega-amber-deep");
    // The signature object: a rendered motion on pleading paper — R21:
    // the demo drafts are SUPER ACCURATE, set in Times New Roman
    // (vg-pleading), with real prayers, grounds and execution block.
    expect(vegaHero).toContain("In the High Court of Lagos State");
    expect(vegaHero).toContain("In the Ikeja Judicial Division");
    expect(vegaHero).toContain("IKD/1287/2026");
    expect(vegaHero).toContain("Motion on Notice");
    expect(vegaHero).toContain("prays this Honourable Court for");
    expect(vegaHero).toContain("The grounds for this application are");
    expect(vegaHero).toContain("vg-pleading");
    expect(vegaHero).toContain("vg-doc__line");
    // The title-page devices: serif display + the gilt accent + the thin
    // gilt rule + the night atmosphere + the notary seal.
    expect(vegaHero).toContain("font-vega");
    expect(vegaHero).toContain("font-vega-italic text-vega-gilt-bright");
    expect(vegaHero).toContain("h-px w-24 bg-vega-gilt");
    expect(vegaHero).toContain("vg-hero-bg");
    expect(vegaHero).toContain("vg-grain");
    expect(vegaHero).toContain("vg-seal");
  });

  it("the stat-chip row is replaced by a mono index line", () => {
    expect(vegaSite).toContain("import { VegaIndexLine }");
    // No rounded stat cards on /vega — the shared chip row is atrium-only.
    expect(vegaMatters).not.toContain("VEGA_STATS");
  });

  it("features are a ruled ledger index, not a hover-expand card grid", () => {
    expect(vegaMatters).toContain('id="features"');
    expect(vegaMatters).not.toContain("rounded-");
    expect(vegaMatters).not.toContain("shadow-");
    expect(vegaMatters).toContain("MATTERS_INDEX");
    // R22: the night register — white hairlines on the dark ground, gilt
    // numerals, parchment titles.
    expect(vegaMatters).toContain("border-b border-white/10");
    expect(vegaMatters).toContain("text-vega-gilt-bright");
    expect(vegaMatters).toContain("text-vega-parchment");
  });

  it("pricing tiers are retired from the product pages (owner direction, R21)", () => {
    // The rate-card sections are deleted outright.
    expect(surfaces).not.toContain("VegaPricingLedger");
    expect(surfaces).not.toContain("AtriumPricing");
    expect(surfaces).not.toContain("getDisplayTiersForProduct");
    expect(surfaces).not.toContain('scrollTo(\'pricing\')');
    expect(surfaces).not.toContain("id=\"pricing\"");
    // No tier names leak anywhere on the marketing surface.
    for (const tier of ["Most Popular", "Start Growth", "Start Pro Trial", "Save 20%"]) {
      expect(hub).not.toContain(tier);
    }
    // The Komplete + bespoke cross-sells survive, relocated to the
    // colophon CTA band with the same verbatim copy.
    expect(vegaFinalCTA).toContain("Are you a Real Estate Lawyer?");
    expect(vegaFinalCTA).toContain("Explore Komplete");
    expect(vegaFinalCTA).toContain("Custom Automations");
    expect(vegaFinalCTA).not.toContain("rounded-3xl");
    expect(vegaFinalCTA).not.toContain("rounded-full");
  });

  it("how-it-works is a procedure schedule with plain numerals", () => {
    expect(vegaProcedure).toContain('id="howItWorks"');
    expect(vegaProcedure).toContain("Matter Ingestion Wizard");
    expect(vegaProcedure).toContain("DraftPro");
    // The audit's legibility rule: no 01/02/03 numbering.
    expect(vegaProcedure).not.toContain(">01<");
    expect(vegaProcedure).not.toContain("'01'");
  });

  it("the FAQ is the ink band, de-tiered, and carries the audit anchor copy", () => {
    expect(vegaFAQ).toContain("Questions? Answered.");
    expect(vegaFAQ).toContain("bg-vega-ink");
    expect(vegaFAQ).toContain("PracticePro Vega for law firms");
    // R21: no tier names anywhere in the FAQ.
    expect(vegaFAQ).not.toContain("Growth");
    expect(vegaFAQ).not.toContain("all tiers");
    // The money-back guarantee promise survives on the cost question.
    expect(vegaFAQ).toContain("How much does Vega cost?");
    expect(vegaFAQ).toContain("30-day money-back guarantee");
  });

  it("credentials fold the trust badges into a mono colophon (no chip strip)", () => {
    expect(vegaCredentials).toContain("NDPA 2023 Compliant");
    expect(vegaCredentials).toContain("TLS 1.3");
    expect(vegaCredentials).toContain("Data Encrypted at Rest");
  });
});

describe("Atrium rebrand — 'The Well-Kept Estate' register on /atrium", () => {
  it("the photography-led hero and signature sections are wired in", () => {
    expect(atriumSite).toContain("import { AtriumHero } from './sections/AtriumHero'");
    expect(atriumSite).toContain("import { AtriumReceipt } from './sections/AtriumReceipt'");
    expect(atriumSite).toContain("import { AtriumEstate } from './sections/AtriumEstate'");
    expect(atriumSite).toContain("import { AtriumSentryPass } from './sections/AtriumSentryPass'");
    expect(atriumSite).toContain("<AtriumEstate />");
    expect(atriumSite).toContain("<AtriumReceipt />");
    expect(atriumSite).toContain("<AtriumSentryPass />");
  });

  it("hero CTAs carry the atrium emerald tone, not the moss ramp", () => {
    expect(atriumSite).toContain('tone="atrium"');
    expect(atriumSite).toContain("eyebrow={'Atrium · Built by PracticePro'}");
  });

  it("the old cycling-screenshot hero is retired", () => {
    expect(surfaces).not.toContain("const HomeSection");
    expect(surfaces).not.toContain("atrium-hero-1.jpg");
  });

  it("the AI band is anchorable and the body carries the atrium hook", () => {
    expect(atriumAI).toContain('id="ai-capabilities"');
    // P0: the body-class machinery moved to shared/useSiteChrome.ts, parametrised
    // by the site's product instead of the old onAtrium boolean.
    expect(sharedChrome).toContain("body.classList.toggle('on-atrium-page', product === 'atrium')");
  });

  it("no dark bands on /atrium: AI capabilities and the final CTA go light", () => {
    // Pass B: both bands are Atrium-owned files painting sage — no
    // bg-slate-900 band, no vega ink, anywhere on the atrium page.
    // (The regex allows slate-900 at hover opacities like
    // hover:bg-slate-900/5 — a tint, not a band.)
    const darkBand = /bg-slate-900(?![-\w/])/;
    expect(atriumAI).not.toMatch(darkBand);
    expect(atriumAI).not.toContain("bg-vega-ink");
    expect(atriumAI).toContain("var(--color-sage)");
    expect(atriumFinalCTA).not.toMatch(darkBand);
    expect(atriumFinalCTA).not.toContain("bg-vega-ink");
    expect(atriumFinalCTA).toContain("var(--color-sage)");
    // The old bg-primary-600 band stays retired.
    expect(hub).not.toContain("'bg-primary-600'");
  });
});

describe("Atrium rebrand Pass B — 'The Well-Kept Estate' page-specific sections", () => {
  it("/atrium renders ONLY Atrium-owned sections — zero shared sections, different inventory + order", () => {
    // The shared template is deleted wholesale: no trace of it may return.
    for (const s of [
      "StatsDemarcator",
      "FeaturesSection",
      "TrustBadgesStrip",
      "AICapabilitiesSection",
      "PricingSection",
      "HowItWorksSection",
      "WhyRunOnSection",
      "FAQSection",
      "FinalCTASection",
    ]) {
      expect(hub).not.toContain(`<${s}`);
      expect(hub).not.toContain(`const ${s}`);
    }
    // The atrium composition: 12 bands, this exact order (R21: the SCE
    // pricing band was removed by owner direction — pricing is sales-led).
    // P0 split: the atrium render branch moved verbatim into its own file;
    // bound to the <main> element exactly as the vega pin above.
    const marker = atriumSite.indexOf("<AtriumHero");
    expect(marker).toBeGreaterThan(-1);
    const tail = atriumSite.slice(marker, atriumSite.indexOf("</main>"));
    const order = (tail.match(/<(Atrium[A-Za-z]+)/g) || []).map((t) =>
      t.slice(1)
    );
    expect(order).toEqual([
      "AtriumHero",
      "AtriumStats",
      "AtriumFeatures",
      "AtriumTrust",
      "AtriumAI",
      "AtriumEstate",
      "AtriumReceipt",
      "AtriumSentryPass",
      "AtriumHowItWorks",
      "AtriumWhyRunOn",
      "AtriumFAQ",
      "AtriumFinalCTA",
    ]);
  });

  it("the atrium files never import a vega component (cross-page isolation)", () => {
    for (const src of [atriumStats, atriumFeatures, atriumTrust, atriumAI, atriumHowItWorks, atriumWhyRunOn, atriumFAQ, atriumFinalCTA]) {
      expect(src).not.toContain("sites/vega/");
      expect(src).not.toContain("../../vega/");
      expect(src).not.toContain("VegaHero");
      expect(src).not.toContain("font-vega");
      expect(src).not.toContain("bg-vega-ink");
    }
  });

  it("features are the warm hover-expand grid, not a ruled ledger", () => {
    expect(atriumFeatures).toContain('id="features"');
    expect(atriumFeatures).toContain("ATRIUM_FEATURE_CATEGORIES");
    expect(atriumFeatures).toContain("landing-card feature-card");
    expect(atriumFeatures).not.toContain("vg-rule-h");
  });

  it("the SCE pricing band is retired; the FAQ keeps the promise copy de-tiered", () => {
    // R21: pricing tiers are off the marketing pages entirely — the
    // guarantee promise survives in the FAQ's cost answer.
    expect(atriumFAQ).toContain("How much does Atrium cost?");
    expect(atriumFAQ).toContain("30-day money-back guarantee");
    expect(atriumFAQ).not.toContain("all tiers");
    expect(atriumFAQ).not.toContain("Growth and above");
  });

  it("how-it-works stays the warm 3-step tiles", () => {
    expect(atriumHowItWorks).toContain('id="howItWorks"');
    expect(atriumHowItWorks).toContain("Sentry Pass");
    expect(atriumHowItWorks).toContain("rounded-2xl");
  });

  it("the FAQ is light and rounded — no ink band on /atrium", () => {
    expect(atriumFAQ).toContain("Questions? Answered.");
    expect(atriumFAQ).toContain("PracticePro Atrium for property managers");
    expect(atriumFAQ).toContain("rounded-lg");
    expect(atriumFAQ).not.toContain("bg-vega-ink");
  });

  it("the stat band carries the mono money register on sage", () => {
    expect(atriumStats).toContain("font-mono");
    expect(atriumStats).toContain("var(--color-sage)");
    expect(atriumStats).not.toContain("bg-vega-ink");
  });
});

describe("W3 — honest social proof (P8)", () => {
  it("no invented testimonial personas survive", () => {
    const personas = [
      "Adebayo Ogundimu",
      "Adaeze Nwosu",
      "Chidi Okafor",
      "Tunde Bakare",
      "Funmi Adewale",
      "Emeka Obi",
    ];
    for (const name of personas) {
      expect(hub).not.toContain(name);
    }
  });

  it("no five-star testimonial markup; capability cards instead", () => {
    expect(hub).not.toContain("Star rating");
    expect(hub).not.toContain("M9.049 2.927"); // the deleted star SVG path
    // Pass B: the capability attestations live in the product-owned
    // files — Vega's credentials section, Atrium's why-run-on band.
    expect(vegaCredentials).toContain("Drafted for Nigerian courts");
    expect(atriumWhyRunOn).toContain("WHY_RUN_ON");
    expect(atriumWhyRunOn).toContain("Every state's tenancy law, applied");
  });
});

describe("W4 — structured data: Organization + per-product apps", () => {
  it("declares the company as an Organization", () => {
    expect(index).toContain('"@type": "Organization"');
    expect(index).toContain("PracticePro Systems Limited");
    expect(index).toContain('"@id": "https://practicepro.ng/#organization"');
  });

  it("one SoftwareApplication per product, published by the company", () => {
    expect(index).toContain('"PracticePro Vega"');
    expect(index).toContain('"PracticePro Atrium"');
    expect(index).toContain('"url": "https://practicepro.ng/vega"');
    expect(index).toContain('"url": "https://practicepro.ng/atrium"');
    expect(index).toContain(
      '"publisher": { "@id": "https://practicepro.ng/#organization" }'
    );
  });

  it("no fabricated aggregateRating anywhere", () => {
    expect(index).not.toContain("aggregateRating");
    expect(index).not.toContain("ratingValue");
  });

  it("page metadata leads with the company's scaling positioning (W16)", () => {
    expect(index).toContain(
      "<title>PracticePro Systems — Build Systems That Help Scale Your Business</title>"
    );
    expect(index).toContain(
      '<meta property="og:site_name" content="PracticePro Systems" />'
    );
  });
});
