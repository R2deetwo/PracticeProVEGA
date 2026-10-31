/**
 * Website-repositioning regression suite — W0–W11.
 *
 * Pins the PracticePro Systems brand architecture on the public website
 * (docs/brand-architecture.md), the same way corporateIdentity.test.ts pins
 * it in the legal documents:
 *
 *   - Company:  PracticePro Systems Limited ("PracticePro")
 *   - Products: Vega (legal), Atrium (property), Komplete (the bundle) —
 *               R47 (owner direction): the products speak their own
 *               names; PracticePro is the BUILDER ("built by
 *               PracticePro"), not a prefix on the product names
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
const hubMarquee = read("src", "sites", "hub", "sections", "MarqueeSection.tsx");
const hubPainMirror = ""; // R40: PainMirrorSection retired by owner direction
const hubWhatWeDo = read("src", "sites", "hub", "sections", "WhatWeDoSection.tsx");
const hubWork = read("src", "sites", "hub", "sections", "OurWorkSection.tsx");
const hubHowWeWork = read("src", "sites", "hub", "sections", "HowWeWorkSection.tsx");
const hubAbout = read("src", "sites", "hub", "sections", "AboutSection.tsx");
const hubFinalCTA = read("src", "sites", "hub", "sections", "HubFinalCTASection.tsx");
const hubShell = read("src", "sites", "hub", "HubShell.tsx");
const hubIndex = read("src", "sites", "hub", "index.tsx");
const hubHooks = read("src", "sites", "hub", "hooks.ts");
const hubScenes = read("src", "sites", "hub", "scenes", "SystemCoreScene.tsx");
const hub = [hubShell, hubIndex, hubHooks, hubScenes, hubHeroSection, hubMarquee,
  hubPainMirror, hubWhatWeDo, hubWork, hubHowWeWork, hubAbout, hubFinalCTA].join("\n");
const vegaSite = read("src", "sites", "vega", "index.tsx");
const vegaShell = read("src", "sites", "vega", "VegaShell.tsx");
const atriumSite = read("src", "sites", "atrium", "index.tsx");
const atriumShell = read("src", "sites", "atrium", "AtriumShell.tsx");
const productPages = vegaSite + "\n" + vegaShell + "\n" + atriumSite + "\n" + atriumShell;
const sharedChrome = read("src", "sites", "shared", "useSiteChrome.ts");
const surfaces = landing + "\n" + hub + "\n" + productPages;
const index = read("index.html");
const appIndex = read("src", "components", "App.tsx");
const tour = read("src", "components", "marketing", "SystemTour.tsx");
const css = read("src", "index.css");
// Vega Pass A — the page-specific rebuild files under marketing/vega/.
const vegaHero = read("src", "sites", "vega", "sections", "VegaHero.tsx");
const vegaAIDrafting = read("src", "sites", "vega", "sections", "VegaAIDrafting.tsx");
const vegaSuite = read("src", "sites", "vega", "sections", "VegaSuite.tsx");
const vegaProcedure = ""; // R40: VegaProcedure retired (page simplified)
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
    // R42→R46: the hero copy is the owner-supplied brief; the visual is
    // the ambient workspace photograph, STOPPED (R46: "you can use the
    // same image but stop it from moving about and being creepy").
    expect(hub).toContain("We design, build, and run custom business solutions.");
    expect(hub).toContain("End-to-End Digital Infrastructure");
    expect(hub).toContain("we build and manage the complete digital foundation");
    expect(hub).not.toContain("We build business software in Lagos");
    // The hero CTAs.
    expect(hub).toContain("Talk to Us");
    expect(hub).toContain("See what we&apos;ve built");
    // R45: no hero WebGL scene at all — the network (and its file) is
    // retired with the owner's verdict; the orb and diorama stay gone.
    expect(hub).not.toContain("NetworkScene");
    expect(hub).not.toContain("MorphScene");
    expect(hub).not.toContain("ScalingNoun");
    expect(hub).not.toContain("SCALE_NOUNS");
    // The system core (What we do) keeps its scene; the Phase C diorama
    // (HubScene) is retired with the owner's verdict.
    expect(hub).toContain("SystemCoreScene");
    expect(hub).not.toContain("HubScene");
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
    // hub-restore: the scenes are back; their colour contracts are the
    // W17+ green era (mint ignition, emerald fresnel) — never amber.
    // The hero's structural fallback cloud is mint too.
    expect(css).not.toContain("rgba(217, 119, 6, 0.15)");
    expect(css).not.toContain("linear-gradient(135deg, #F59E0B, #16A34A)");
    // Vega keeps its amber PRODUCT identity (product coding, not page
    // decoration) — that contract is untouched.
    expect(css).toContain("--color-amber: #D97706");
  });

  it("the hub positions the company broadly — we build systems, not 'a Lagos software company' (W7)", () => {
    // R42: the eyebrow is the owner-supplied brief's tag; the body copy
    // carries the systems message.
    expect(hub).toContain("End-to-End Digital Infrastructure");
    // R28: the Lagos line is retired with the Vega/Atrium enumeration —
    // the sub-copy now reads "software and custom systems for businesses
    // like yours" with no city and no product list. ("Built in Lagos."
    // legitimately remains in the About section — the pin targets the
    // hero, not the whole page.)
    expect(hubHeroSection).not.toContain("in Lagos");
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
    // hub-restore: the W18 bento card grid + iso shapes are back; C4 moved
    // the card titles to customer outcomes (see the Phase C test above).
    expect(hub).toContain("WHAT_WE_DO");
    expect(hub).toContain("Software shaped around how your business already runs");
    expect(hub).toContain("Your tools, wired into one workflow");
    expect(hub).toContain("Money recorded the moment it lands");
    expect(hub).toContain("Your system stays up and your data stays yours");
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

  it("the hero is the ambient workspace STILL — no canvas, no video, no motion (R45→R46)", () => {
    // R45 (owner direction): "get rid of the internet clusters" — the
    // NetworkScene canvas and its structural CSS fallback are retired
    // from the hero. R46 (owner direction): "stop it from moving about
    // and being creepy" — the video loop is retired too; the same
    // photograph stays, stopped. Nothing in the hero animates.
    expect(hubHeroSection).not.toContain("NetworkScene");
    expect(hubHeroSection).not.toContain("w8-scene-enter");
    expect(css).not.toContain(".r42-net-fallback");
    expect(hub).not.toContain("HubScene");
    // R46: no video element, no loop file, no cue bob left in the CSS.
    expect(hubHeroSection).not.toContain("<video");
    expect(hubHeroSection).not.toContain("ambient-loop");
    expect(hubHeroSection).not.toContain("autoPlay");
    expect(css).not.toContain("w7-cue-bob");
  });
});

describe("W8 — structured fluidity: the lattice system", () => {
  it("the hero shows structure that morphs — a converging network, not a blob (W8→R42)", () => {
    // R45: the network fallback is retired with the clusters; the card
    // entrance (r42-card-in) stays.
    expect(hub).not.toContain("r42-net-fallback");
    expect(hub).toContain("r42-card-in");
  });


  it("sections pour into each other through visible SVG waves that morph as you scroll (W10, restored)", () => {
    expect(hub).toContain("FluidSeam");
    // R42: the hero is daylight — it pours into the dark capabilities band
    // through its own seam (phase 0); the band then pours into the white
    // body. The final paper→dark close keeps phase 3.
    expect(hubIndex).toContain('<FluidSeam from="#FBFBF9" to="#0A101C" phase={0}');
    expect(hubIndex).toContain('<FluidSeam from="#0A101C" to="#FFFFFF" phase={1}');
    expect(hubIndex).toContain('<FluidSeam from="#FBFBF9" to="#0A101C" phase={3}');
  });


  it("the nav carries a fluid pill that morphs between sections (W8, restored)", () => {
    expect(hub).toContain("w8-nav-pill");
  });


  it("the hero is the ambient workspace alone, behind left-aligned copy, with a slimmer card (R42→R46)", () => {
    // R42: the orb retired. R44: ambient video + the internet map. R45:
    // the clusters are GONE. R46 (owner direction): "you can use the
    // same image but stop it from moving about and being creepy" — the
    // loop is retired; the SAME photograph stays as a still (the loop's
    // rest frame), full-bleed at lg+ and a calm framed 4:3 panel below
    // (the full-bleed crop on a 390px phone showed just 21% of the
    // frame — a giant looming face behind the copy: "enlarged and
    // shakey").
    // The featured-solutions card floats bottom-right, SLIMMER (330px),
    // telling OUR product story — Vega and Atrium, correctly named —
    // and an Explore affordance that scrolls DOWN to the products.
    expect(hubHeroSection).not.toContain("NetworkScene");
    expect(hubHeroSection).not.toContain("w8-scene-enter");
    expect(hubHeroSection).toContain("End-to-End Digital Infrastructure");
    expect(hubHeroSection).toContain("We design, build, and run custom business solutions.");
    // R46: the still — the same photograph, stopped. Desktop full-bleed
    // (the loop's rest frame, anchored at 60% so the subject stays
    // composed at every lg width); the framed panel below lg at a
    // natural photographic scale. Lazy + display:none scoping means
    // each breakpoint fetches only the composition it shows.
    expect(hubHeroSection).toContain("ambient-still.jpg");
    expect(hubHeroSection).toContain("ambient-still-panel.jpg");
    expect(hubHeroSection).toContain("object-[60%_center]");
    expect(hubHeroSection).toContain("aspect-[4/3]");
    // Nothing in the hero animates: no pinging badge dot, no bobbing
    // scroll cue (the chevron rests), no JS motion machinery at all.
    expect(hubHeroSection).not.toContain("animate-ping");
    expect(hubHeroSection).not.toContain("w7-scroll-cue");
    expect(hubHeroSection).not.toContain("IntersectionObserver");
    // The featured solutions: Vega + Atrium in their own names — R45:
    // a slimmer card (330px, tighter air).
    expect(hubHeroSection).toContain("FeaturedSolutionsCard");
    expect(hubHeroSection).toContain("w-[330px]");
    expect(hubHeroSection).not.toContain("w-[400px]");
    expect(hubHeroSection).toContain("<VegaMark");
    expect(hubHeroSection).toContain("<AtriumMark");
    expect(hubHeroSection).toContain("Legal Practice OS");
    expect(hubHeroSection).toContain("Property Management OS");
    expect(hubHeroSection).toContain("Explore both products");
    // Explore scrolls DOWN to the products (Our Work), never away.
    expect(hubHeroSection).toContain("onExplore={() => scrollTo('ourWork')}");
    expect(hubHeroSection).not.toContain("Vega Legal &amp; Property Suite");
    // R44 (owner: "ensure the font still matches across"): the hero
    // wears the site's own stacks — Space Grotesk display, IBM Plex
    // Mono labels, Figtree body — never the referenced site's fonts.
    expect(hubHeroSection).toContain("font-display");
    expect(hubHeroSection).toContain("font-mono");
    expect(hubHeroSection).not.toMatch(/font-(inter|geist)|Inter[, '"]|Geist/);
    // The diorama's stage machinery is gone with it. ("Money recorded" is
    // NOT asserted here — it is also a legitimate What-we-do capability
    // title: "Money recorded the moment it lands".)
    expect(hub).not.toContain("Order arrives");
    expect(hub).not.toContain("Nobody loses it");
    expect(hub).not.toContain("Receipt sent");
    expect(hub).not.toContain("HubScenePoster");
    // Performance + safety contract — now carried by the remaining
    // scene (SystemCoreScene) alone; the hero still needs no canvas.
    expect(hubScenes).toContain("Math.min(window.devicePixelRatio || 1");
    expect(hubScenes).toContain("prefers-reduced-motion");
    expect(hubScenes).toContain("renderer.dispose()");
  });

  it("Phase C — What we build speaks in outcomes, not technology (C4)", () => {
    expect(hub).toContain("Software shaped around how your business already runs");
    expect(hub).toContain("Your tools, wired into one workflow");
    expect(hub).toContain("Customers who help themselves, any hour, any phone");
    expect(hub).toContain("Money recorded the moment it lands");
    expect(hub).toContain("The repetitive work, done for you");
    expect(hub).toContain("Nothing slips, the right person is alerted on time");
    expect(hub).toContain("Your system stays up and your data stays yours");
    // Honest facts stay checkable against the repo.
    expect(hub).toContain("Paystack and bank transfer flows already in production");
    expect(hub).toContain("NDPA 2023-aligned data handling");
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
  it("the What-we-do visual is a real 3D system core (W13, restored)", () => {
    expect(hub).toContain("SystemCoreScene");
    expect(hub).toContain("w13-canvas");
  });


  it("each capability card carries a quiet, always-on icon chip (W13, restored)", () => {
    expect(hub).toContain("w14-chip");
  });


  it("everything renders INSIDE the canvas (W13, restored)", () => {
    expect(hub).toContain("w13-stage");
    expect(hub).toContain("w13-fallback");
    expect(hub).toContain("w13-caption");
  });


  it("the scene runs on the hero's engine contract (restored)", () => {
    // Same lazy-chunk + pause-offscreen contract the hero scene used.
    // R45: NetworkScene is deleted with the internet clusters; the
    // contract lives on in SystemCoreScene (What we do).
    expect(hubScenes).toContain("SystemCoreScene");
    expect(hubScenes).not.toContain("NetworkScene");
    expect(hubScenes).toContain("Math.min(window.devicePixelRatio || 1");
  });


  it("the riding-squares layer is retired — no stray floaters (W10)", () => {
    expect(hub).not.toContain("SystemSquares");
    expect(css).not.toContain(".w9-squares-canvas");
  });

  it("text settles in softly across the hub (w9 reveal machinery, restored)", () => {
    expect(hub).toContain("w9-reveal");
    expect(hub).toContain("w9-reveal-stagger");
    expect(hub).toContain("w9-step-node");
  });

  it("a workflow & notification capability joins the builder services", () => {
    expect(hub).toContain("Nothing slips, the right person is alerted on time");
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

  it("Woosh — a free tool we run — joins the portfolio as a fourth entry", () => {
    expect(hub).toContain("name: 'Woosh'");
    // R29: the possessive register is retired — 'A free tool', not 'Our tool'.
    expect(hub).toContain("A free tool");
    expect(hub).not.toContain("Our tool");
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
    // wordmark) and it navigates back to the hub; on the
    // hub the PracticePro logo scrolls to the top. The two are separate
    // buttons now — no conditional handler.
    // P0: the ternary is gone by design — each product shell carries its
    // own narrowed literal lockup aria-label.
    // R24 (owner, 2026-10-13): no visible "BY PRACTICEPRO" line in the
    // header lockup — the header is mark + wordmark only. The company
    // attribution lives in the footer brand column (one occurrence per
    // shell source).
    expect(vegaShell).toContain('aria-label="Vega — a PracticePro product, back to all products"');
    expect(atriumShell).toContain('aria-label="Atrium — a PracticePro product, back to all products"');
    expect(productPages).toContain("onClick={onBackToHub}");
    expect(hub).toContain("onClick={() => scrollTo('home')}");
    expect(productPages).toContain("pathname !== '/'");
    expect(productPages).toContain("navigate('/')");
    expect((vegaShell.match(/BY PRACTICEPRO/g) || []).length).toBe(1);
    expect((atriumShell.match(/BY PRACTICEPRO/g) || []).length).toBe(1);
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
    // R40: the pain-first hero description ("Spreadsheets, chat threads,
    // memory and paper will get a business started...") belonged to the
    // retired Sound-familiar? mirror; the hero now states what we do.
    // R42: the hero copy is the owner-supplied glassmorphic brief.
    expect(hub).not.toContain("Spreadsheets, chat threads, memory and paper");
    expect(hub).toContain("We design, build, and run custom business solutions.");
    expect(hub).toContain("From custom software and system integrations");
  });

  it("R40: the pain-mirror (\"Sound familiar?\") is retired — the hub leads with the work", () => {
    // Owner direction (R40): "get rid of the sound familiar? page all
    // together — I don't think we need it any more." Old expectation: the
    // hub carried PainMirrorSection between the marquee and What we do, with
    // four operator worlds (Ada Eze / Dr. Emeka Okoro / Chuka Obi / Tunde
    // Baku). New expectation: the section file is deleted and the hub index
    // mounts nothing between MarqueeStrip and the What-we-do seam — the
    // hub's pitch opens with what we do, not the visitor's pain.
    expect(hubIndex).not.toContain("PainMirrorSection");
    expect(hubIndex.indexOf("<MarqueeStrip />")).toBeGreaterThan(-1);
    expect(hubIndex.indexOf("<WhatWeDoSection")).toBeGreaterThan(hubIndex.indexOf("<MarqueeStrip />"));
  });

  it("the descent: shapes land in their cards, the Iso watermarks return (W14, restored)", () => {
    // The scroll-linked descent is back: useLandingCards lands each card's
    // wireframe shape; CARD_SHAPES are the iso watermarks.
    expect(hub).toContain("useLandingCards");
    expect(hub).toContain("w14-card");
    expect(hub).toContain("CARD_SHAPES");
    expect(hub).toContain("Iso");
  });
});

describe("W1/W2 — company-behind-products framing on the website", () => {
  it("the footer names the company's role and carries the Built-by mark", () => {
    expect(hub).toContain(
      "We design, build and run the systems businesses manage their affairs with"
    );
    expect(hub).toContain("From Lagos, for businesses anywhere");
    // hub-restore: the W18 footer attribution line (bottom bar).
    expect(hub).toContain("Vega &amp; Atrium · Built by PracticePro");
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

  it("R29 — 'a product', not 'our product'; and exactly two products", () => {
    // Owner direction: the site must stop saying "our product" — the
    // register is the indefinite "a product" — and it must be clear the
    // company has exactly TWO products, Vega and Atrium.
    expect(hubWork).toContain("badge: 'A product'");
    expect(hubWork).not.toContain("badge: 'Our product'");
    expect(hubWork).toContain("badge: 'A free tool'");
    // The closing CTA counts them and points at both.
    expect(hubFinalCTA).toContain("If one of the two products already fits");
    expect(hubFinalCTA).toContain("Explore both products");
    // All three footers (hub, vega, atrium) name the pair, not possess it.
    expect(hubShell).toContain("two products, Vega and Atrium");
    expect(vegaShell).toContain("two products, Vega and Atrium");
    expect(atriumShell).toContain("two products, Vega and Atrium");
    // No possessive product phrasing survives anywhere on the surfaces.
    expect(surfaces).not.toContain("our product");
    expect(surfaces).not.toContain("Our product");
    expect(surfaces).not.toContain("our products");
    expect(surfaces).not.toContain("Our products");
    // Komplete is framed as the two together, never a third product.
    expect(vegaFinalCTA).toContain("Vega and Atrium in one workspace");
  });

  it("R29 — logging out of the workspace lands on the user's own product page", () => {
    // Owner direction: sign-out from the app goes to the product's landing
    // page (/vega or /atrium), not the company hub. AuthContext consumes
    // the ProductProvider signal via the appProductSignal module bridge.
    const auth = read("src", "contexts", "AuthContext.tsx");
    const signal = read("src", "utils", "appProductSignal.ts");
    const productCtx = read("src", "contexts", "ProductContext.tsx");
    expect(signal).toContain("export function productLandingPath");
    expect(signal).toContain("return '/vega'");
    expect(signal).toContain("return '/atrium'");
    expect(auth).toContain("getActiveAppProduct()");
    expect(auth).toContain("productLandingPath(appProduct)");
    expect(productCtx).toContain("setActiveAppProduct");
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
    // The vega composition (R38 "The Reading Room"; simplified R40 —
    // owner: "we need to look at how we can simplify the vega site").
    // Old expectation: 12 bands including the mono index line, The Record's
    // scales and the three-step procedure schedule. New expectation: the
    // page folds to its load-bearing bands — the decorative exhibits are
    // retired; the real product captures carry the trust.
    const order = (body.match(/<(Vega[A-Za-z]+)/g) || []).map((t) =>
      t.slice(1)
    );
    expect(order).toEqual([
      "VegaHero",
      "VegaSuite",
      "VegaTeam",
      "VegaSegments",
      "VegaAIDrafting",
      "VegaCourtRules",
      "VegaScaleOfCharges",
      "VegaCredentials",
      "VegaFAQInk",
      "VegaFinalCTA",
    ]);
  });

  it("R43: the chambers band shows the team/collaborative side with live captures", () => {
    // Owner direction (R43): "there are no live shots of the app that show
    // multiple team members logged in at the same time... buyers need to
    // know it has a team/collaborative side to it." The band sits after
    // the Suite, carries two real captures (the per-counsel task board
    // and a matter's discussion thread) and honest multi-user copy.
    const vegaTeam = read("src", "sites", "vega", "sections", "VegaTeam.tsx");
    expect(vegaSite).toContain("<VegaTeam />");
    expect(vegaTeam).toContain('id="team"');
    expect(vegaTeam).toContain("The whole team");
    expect(vegaTeam).toContain("/assets/landing/app/tasks-team.jpg");
    expect(vegaTeam).toContain("/assets/landing/app/matter-notes.jpg");
    expect(vegaTeam).toContain("LIVE CAPTURE");
    // The honest register: no cards, no shadows (the ruled page).
    expect(vegaTeam).not.toContain("rounded-");
    expect(vegaTeam).not.toContain("shadow-");
  });

  it("the vega branch never imports an atrium component and vice versa", () => {
    // Cross-page isolation: vega files import no atrium components.
    for (const src of [vegaHero, vegaSuite, vegaProcedure, vegaCredentials, vegaFAQ, vegaFinalCTA]) {
      expect(src).not.toContain("sites/atrium/");
      expect(src).not.toContain("../../atrium/");
      expect(src).not.toContain("AtriumHero");
      expect(src).not.toContain("AtriumReceipt");
    }
  });

  it("the hero sells to real people — photographs of the practice, not a product mockup (R39)", () => {
    // R39 (owner direction: "take the mockup out of the hero — put real
    // people there; the mockup I like goes down into the Powered-by
    // band"): the right column is a cycling gallery of the practice at
    // work; the evening exchange moved to VegaAIDrafting (pinned below).
    expect(vegaHero).not.toContain("bg-clip-text");
    expect(vegaHero).not.toContain("text-transparent");
    expect(vegaHero).not.toContain("font-vega-italic font-medium text-vega-amber-deep");
    // The filing is GONE from the hero — no pleading paper, no court
    // caption, no execution block. The drafting-paper story lives in the
    // AI band's tracked-changes exhibit instead.
    expect(vegaHero).not.toContain("vg-pleading");
    expect(vegaHero).not.toContain("vg-doc__line");
    expect(vegaHero).not.toContain("In the High Court of Lagos State");
    // R39: the product mockup is GONE from the hero too — no chat rows,
    // no thread header. Real people instead.
    expect(vegaHero).not.toContain("ChatRow");
    expect(vegaHero).not.toContain("ALOA · Online");
    // The gallery: three real photographs of the practice at work,
    // cycling with pagination dots. R40: the exhibit chrome (frame,
    // "The practice, at work" header, mono caption) is gone — the
    // photographs stand alone.
    expect(vegaHero).toContain("/assets/landing/vega-hero-1.jpg");
    expect(vegaHero).toContain("/assets/landing/vega-hero-2.jpg");
    expect(vegaHero).toContain("/assets/landing/vega-hero-3.jpg");
    expect(vegaHero).toContain("View scene");
    expect(vegaHero).not.toContain("The practice, at work");
    expect(vegaHero).not.toContain("bg-vega-parchment");
    // The title-page devices: serif display + the gilt accent + the thin
    // gilt rule + the night atmosphere.
    expect(vegaHero).toContain("font-vega");
    expect(vegaHero).toContain("font-vega-italic text-vega-gilt-bright");
    expect(vegaHero).toContain("h-px w-24 bg-vega-gilt");
    expect(vegaHero).toContain("vg-hero-bg");
    expect(vegaHero).toContain("vg-grain");
  });

  it("R40: the fake ALOA chat mockup is retired — the band carries REAL captures (R40)", () => {
    // Owner direction (R40): "we don't need that fake version of ALOA —
    // let's have the actual live captures... ALOA can draw out... an
    // extra modal that slides out." Old expectation (R39): the evening
    // exchange chat card (ALOA · Online, IKD/1287/2026, "home for dinner
    // by 6:15") lived beside the live capture. New expectation: the
    // hand-built chat is gone; the band shows two screenshots of the
    // shipping app — ALOA over the workspace, and the draw-out (a tool
    // call opening the New Contact form drawer).
    expect(vegaAIDrafting).not.toContain("ALOA · Online");
    expect(vegaAIDrafting).not.toContain("IKD/1287/2026 — Okafor v Meridian Logistics");
    expect(vegaAIDrafting).not.toContain("EveningExchange");
    expect(vegaAIDrafting).not.toContain("home for dinner");
    // The two real captures.
    expect(vegaAIDrafting).toContain("/assets/landing/app/vega-aloa.jpg");
    expect(vegaAIDrafting).toContain("/assets/landing/app/vega-aloa-drawout.jpg");
    expect(vegaAIDrafting).toContain("LIVE CAPTURE — ALOA IN THE RUNNING WORKSPACE");
    expect(vegaAIDrafting).toContain("LIVE CAPTURE — THE DRAW-OUT");
    // The pullout demos stay — openable working forms, placed LOWER in
    // the band (owner: "the demos should appear a little further down"):
    // the deadline computer, the drafting studio, the 7·3·1 cadence, on
    // the shared ui primitives.
    expect(vegaAIDrafting).toContain("The Instruments, in Miniature");
    expect(vegaAIDrafting).toContain("The deadline computer");
    expect(vegaAIDrafting).toContain("The drafting studio");
    expect(vegaAIDrafting).toContain("7 · 3 · 1 cadence");
    expect(vegaAIDrafting).toContain("HCCPR 2019");
  });

  it("R40: the stat-chip row and the mono index line are both retired", () => {
    // Old expectation: VegaIndexLine replaced the shared stat-chip row.
    // New expectation (R40 simplification): the index line is retired
    // entirely — its claims (NDPA 2023, TLS 1.3) live in VegaCredentials
    // and the footer. No rounded stat cards on /vega either.
    expect(vegaSite).not.toContain("VegaIndexLine");
    expect(vegaSuite).not.toContain("VEGA_STATS");
  });

  it("the suite is a ruled, expandable instrument index with live captures (R38)", () => {
    // R38: the six-card grid, the dark matters ledger and the separate
    // workspace gallery are merged into ONE instrument — a ruled index on
    // the ivory ground (no cards, no shadows, square corners) whose rows
    // expand inline into capability entries + a LIVE CAPTURE (R28 owner
    // direction: "use stuff from the app so we are not showing false
    // images").
    expect(vegaSuite).toContain('id="suite"');
    expect(vegaSuite).not.toContain("rounded-");
    expect(vegaSuite).not.toContain("shadow-");
    expect(vegaSuite).toContain("INSTRUMENTS");
    // The daylight register: warm hairlines and espresso titles — never
    // the old dark-band language.
    expect(vegaSuite).toContain("border-b border-vega-night/10");
    expect(vegaSuite).toContain("text-vega-night");
    expect(vegaSuite).not.toContain("bg-vega-night");
    expect(vegaSuite).not.toContain("bg-vega-ink");
    // The captures are the real product, honestly captioned. R42: every
    // ENTRY carries its own capture — the matters ledger (not the generic
    // dashboard), the DraftPro editor, the chronology, both task-board
    // layouts, contacts, research, analytics and the bank-transfer
    // invoice.
    expect(vegaSuite).toContain("/assets/landing/app/matters-ledger.jpg");
    expect(vegaSuite).toContain("/assets/landing/app/tasks-status.jpg");
    expect(vegaSuite).toContain("/assets/landing/app/tasks-flat.jpg");
    expect(vegaSuite).toContain("/assets/landing/app/contacts.jpg");
    expect(vegaSuite).toContain("/assets/landing/app/editor.jpg");
    expect(vegaSuite).toContain("/assets/landing/app/research.jpg");
    expect(vegaSuite).toContain("/assets/landing/app/chronology.jpg");
    expect(vegaSuite).toContain("/assets/landing/app/aloa.jpg");
    expect(vegaSuite).toContain("/assets/landing/app/calendar.jpg");
    expect(vegaSuite).toContain("/assets/landing/app/billing.jpg");
    expect(vegaSuite).toContain("/assets/landing/app/analytics.jpg");
    expect(vegaSuite).toContain("/assets/landing/app/invoice-bank.jpg");
    expect(vegaSuite).toContain("LIVE CAPTURE");
    // R42: entries switch their capture on hover/tap; the task board
    // cycles its two real layouts; ALOA says locus classicus.
    expect(vegaSuite).toContain("onMouseEnter={onActivate}");
    expect(vegaSuite).toContain("swap:");
    expect(vegaSuite).toContain("locus classicus");
    expect(vegaSuite).not.toContain("intake to judgment");
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
    // R26 The Warm Chambers: pill CTAs (LawPavilion's capsule buttons),
    // rounded-2xl cross-sell cards — never the old square/radius-3 looks.
    expect(vegaFinalCTA).toContain("rounded-full");
    expect(vegaFinalCTA).toContain("rounded-2xl");
    expect(vegaFinalCTA).not.toContain("rounded-3xl");
    expect(vegaFinalCTA).not.toContain("rounded-sm");
  });

  it("R40: the procedure schedule is retired (page simplified)", () => {
    // Old expectation: VegaProcedure carried id="howItWorks", the Matter
    // Ingestion Wizard and DraftPro steps. New expectation (R40
    // simplification): the band and its nav item are gone; the suite and
    // the pullouts carry the how-it-works story.
    expect(vegaSite).not.toContain("VegaProcedure");
    expect(vegaSite).not.toContain("howItWorks");
  });

  it("the FAQ is a ruled interrogatory accordion on the page's paper (R38)", () => {
    expect(vegaFAQ).toContain("Questions? Answered.");
    // R38: the FAQ leaves the raised-ink band — same ivory paper as the
    // rest of the page, warm hairlines, claret numerals.
    expect(vegaFAQ).not.toContain("bg-vega-ink");
    expect(vegaFAQ).toContain("border-b border-vega-night/10");
    expect(vegaFAQ).toContain("Vega for law firms");
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
    expect(atriumFAQ).toContain("Atrium for property managers");
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
    // R47: the apps are named Vega and Atrium; the company is the
    // publisher. The product names carry no company prefix.
    expect(index).toContain('"name": "Vega"');
    expect(index).toContain('"name": "Atrium"');
    expect(index).not.toContain('"PracticePro Vega"');
    expect(index).not.toContain('"PracticePro Atrium"');
    expect(index).toContain('"url": "https://practicepro.ng/vega"');
    expect(index).toContain('"url": "https://practicepro.ng/atrium"');
    expect(index).toContain(
      '"publisher": { "@id": "https://practicepro.ng/#organization" }'
    );
  });

  it("R47 — the resources pages belong to the products; PracticePro is the builder", () => {
    // Owner: "in the resources page for Atrium, what I'm seeing is Practice
    // Pro. We need to be removing this Practice Pro from the Atrium product
    // unless it's where it's necessary... in the resources page, we should
    // have the brand Atrium. But where we're going to have the Practice Pro
    // is inside, at the bottom... I say built by Practice Pro." And: "the
    // resources should not be inside Practice Pro anymore... the Atrium one
    // should be in Atrium, the Vega one should be in Vega."
    const resources = read("src", "components", "ResourcesPage.tsx");
    // The header carries the PRODUCT's mark and name — not the company's.
    expect(resources).toContain("<ProductMark product={activeProduct}");
    expect(resources).toContain("{productDisplay}");
    // The document identity (favicon + title) follows the product.
    // Mount-gated identity child (never clobbers the in-app shell
    // identity when the flag is absent).
    expect(resources).toContain("useProductBranding(product, true)");
    expect(resources).toContain("applyDocumentIdentity && <ProductIdentity");
    // Switching product navigates to that product's own resources page.
    expect(resources).toContain("onSwitchProduct");
    expect(appIndex).toContain("'/vega/resources'");
    expect(appIndex).toContain("'/atrium/resources'");
    // PracticePro appears exactly where the owner puts it: the builder's
    // credit at the bottom — never as the product's name.
    expect(resources).toContain("is built by PracticePro Systems Ltd");
    expect(resources).not.toContain("PracticePro Vega");
    expect(resources).not.toContain("PracticePro Atrium");
    expect(resources).not.toContain("PracticePro VEGA");
    expect(resources).not.toContain("PracticePro ATRIUM");
    // The company (hub) page no longer routes to a company resources page —
    // resources live with the products.
    expect(hubShell).not.toContain("onResources");
    expect(hubIndex).not.toContain("'/resources'");
    // The product shells keep their own Resources links.
    expect(vegaShell).toContain("Resources");
    expect(atriumShell).toContain("Resources");
    // The portal + receipt print documents speak the product's name, with
    // the builder's credit at the bottom.
    const tenantDocs = read("src", "components", "tenant", "TenantPortal", "DocumentsTab.tsx");
    expect(tenantDocs).not.toContain("PracticePro Atrium ·");
    expect(tenantDocs).toContain("Built by PracticePro Systems Ltd");
    const clientDash = read("src", "components", "client", "ClientDashboard.tsx");
    expect(clientDash).not.toContain("PracticePro VEGA ·");
  });

  it("R47 — the Atrium mark is the Big A, in the PracticePro favicon's formula", () => {
    // Owner: "I don't like the favicon or even the icon for Atrium. For
    // Atrium, I think it would look better if you look at the Practice Pro
    // favicon. It looks much clearer. You can see what it is. There's a
    // big P." The Coin of the Courtyard is retired; the estate tile says
    // "A" the way the company tile says "P": a big, clear letterform.
    const marks = read("src", "components", "marketing", "brand", "ProductMarks.tsx");
    expect(marks).toContain("THE BIG A");
    expect(marks).not.toContain("Coin of the Courtyard");
    expect(marks).not.toContain("Coin of the House");
    // The letter is white on the filled emerald tile (the P formula).
    expect(marks).toMatch(/AtriumMark[\s\S]*?fill="#FFFFFF"/);
    // The standalone favicon SVG carries the same geometry.
    const atriumFavicon = read("public", "brand", "atrium", "favicon.svg");
    expect(atriumFavicon).toContain("THE BIG A");
    expect(atriumFavicon).not.toContain("Coin of the Courtyard");
    // The AI assistants speak the product's name too.
    const guardrails = read("src", "constants", "identityGuardrails.ts");
    expect(guardrails).not.toContain("within PracticePro Atrium");
    expect(guardrails).not.toContain("within PracticePro Vega");
    const aloaPrompt = read("ai", "prompts", "03a-aloa-identity-guardrail.md");
    const ariaPrompt = read("ai", "prompts", "03b-aria-identity-guardrail.md");
    expect(aloaPrompt).not.toContain("powering PracticePro Vega");
    expect(ariaPrompt).not.toContain("powering PracticePro Atrium");
    expect(aloaPrompt).toContain("by PracticePro");
    expect(ariaPrompt).toContain("by PracticePro");
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
