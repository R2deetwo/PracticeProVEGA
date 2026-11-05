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
// R56: the ALOA content folded into VegaWhyNigeria; the credentials into
// VegaTrust; the FAQ into VegaPricing. The vars keep their names so the
// pin blocks below read as the same subjects.
const vegaAIDrafting = read("src", "sites", "vega", "sections", "VegaWhyNigeria.tsx");
const vegaSuite = read("src", "sites", "vega", "sections", "VegaSuite.tsx");
const vegaProcedure = ""; // R40: VegaProcedure retired (page simplified)
const vegaCredentials = read("src", "sites", "vega", "sections", "VegaTrust.tsx");
const vegaFAQ = read("src", "sites", "vega", "sections", "VegaPricing.tsx");
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

  it("Kozy Care joins the portfolio, live at kozycare.ng", () => {
    expect(hub).toContain("Kozy Care");
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

describe("R62 — the portfolio folds into a hover-expand list; the about copy stops over-flogging the products", () => {
  it("Our Work is a LIST of trigger rows that expand on hover and fold on leave — smooth both ways", () => {
    // Owner: "rather than having a situation where all the things i have
    // built show all at once, we have a list of sorts or sections and
    // when the user hovers over it it opens up to how it looks right now
    // and when the user moves the mouse away from the trigger section, it
    // closes back and both processes should be smooth."
    expect(hubWork).toContain("onMouseEnter");
    expect(hubWork).toContain("onMouseLeave");
    // the smooth open/close: grid-rows 0fr→1fr with a transition (no
    // fixed heights, no JS height math)
    expect(hubWork).toContain("grid-rows-[1fr]");
    expect(hubWork).toContain("grid-rows-[0fr]");
    expect(hubWork).toContain("transition-[grid-template-rows]");
    // the row is a real button with the accessibility contract
    expect(hubWork).toContain("aria-expanded={isOpen}");
    expect(hubWork).toContain("aria-controls={`work-exhibit-${i}`}");
    // touch has no hover: a tap toggles (and keyboard Enter/Space via
    // the detail-0 click)
    expect(hubWork).toContain("if (!canHover || e.detail === 0)");
    // the first row ships open so the affordance is obvious
    expect(hubWork).toContain("useState<number | null>(0)");
    // the always-open card grid is gone — no more every-card-at-once
    expect(hubWork).not.toContain("md:gap-10 max-w-6xl mx-auto\">\n                    {OUR_WORK.map");
  });

  it("the about section drops the product roll-call and the 3-systems enumeration", () => {
    // Owner: "the second and third paragraphs are not necessary i dont
    // think or could be better worded. i certainly dont want to have the
    // issue of vega and atrium over flogged it seems desparate" and
    // "please get rid of that thing where you said 3 systems live in
    // production and then lists them."
    expect(hubAbout).not.toContain("3 systems live in production");
    expect(hubAbout).not.toContain("Kozy Care");
    expect(hubAbout).not.toContain("Vega serves Nigerian law firms");
    expect(hubAbout).not.toContain("vendor and a software partner");
    // the credibility point survives, product-name-free
    expect(hubAbout).toContain("We run our own systems in production every working day");
    expect(hubAbout).toContain("we build that too");
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
    // R55: the hairline-ribbon hero — the R53 WebGL2 contour-field shader
    // is RETIRED (owner: "NO topographic / contour-map look. NO noise,
    // NO fbm… NO WebGL, NO shaders… Plain 2D canvas only") and replaced
    // by two 64-line silk ribbons on the RIGHT of the hero — PracticePro
    // green (--color-primary-500) on the unchanged navy ground, additive
    // blend, slow ~11s sway. No photo, no overlay: the ground colour is
    // the hero's own background, unchanged since R53. The entrance
    // staggers remain one-time arrivals; the ribbons are the only thing
    // that animates after arrival.
    expect(hubHeroSection).toContain("<HeroRibbons");
    expect(hubHeroSection).not.toContain("BandsBackground");
    expect(hubHeroSection).toContain("HUB_HERO_GROUND");
    expect(hubHeroSection).not.toContain("ambient-still");
    expect(hubHeroSection).not.toContain("ambient-still-panel.jpg");
    expect(hubHeroSection).not.toContain("object-[72%_center]");
    expect(hubHeroSection).not.toContain("<SwirlBands");
    expect(hubHeroSection).toContain("min-h-[100dvh]");
    // Nothing in the hero itself animates after arrival: no pinging badge
    // dot, no bobbing scroll cue (the chevron rests).
    expect(hubHeroSection).not.toContain("animate-ping");
    expect(hubHeroSection).not.toContain("w7-scroll-cue");
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
    expect(hub).toContain("https://woosh.dpdns.org");
    expect(hub).toContain("tourSystem: 'woosh'");
    // The stack story is capability-honest (no invented framework).
    expect(hub).toContain("REST API + webhooks");
    expect(hub).toContain("Verification-code extraction");
  });

  it("R54 — the work cards carry just the names, no badge taxonomy", () => {
    // Owner direction (Prompt 4): "There's no need to add a product…
    // Let's not put a free tool. Let's not put built for a client.
    // Let's not put a product… Let's just have the names of the
    // things." The category pills and their icon chips are retired;
    // the intro no longer enumerates the taxonomy either.
    expect(hubWork).not.toContain("badge: 'A product'");
    expect(hubWork).not.toContain("badge: 'A free tool'");
    expect(hubWork).not.toContain("badge: 'Built for a client'");
    expect(hubWork).not.toContain("badgeClass");
    expect(hubWork).not.toContain("iconClass");
    // The four systems keep their names and taglines.
    expect(hubWork).toContain("name: 'Vega'");
    expect(hubWork).toContain("name: 'Atrium'");
    expect(hubWork).toContain("name: 'Kozy Care'");
    expect(hubWork).toContain("name: 'Woosh'");
    // The intro's taxonomy sentence is gone with the pills.
    expect(hub).not.toContain("Two products we run ourselves");
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

  it("the attribution eyebrow survives on Atrium's hero; Vega's is retired (R69)", () => {
    // R56: both product heroes carried a Built-by attribution eyebrow.
    // R69 (owner direction): "Remove the small pill badge at the top of
    // the hero section that currently reads 'LEGAL WORKFLOW AUTOMATION –
    // BUILT BY PRACTICEPRO'" — Vega's is gone (the attribution itself
    // survives on the Vega footer's 'A PracticePro product', D8, and on
    // the hub). Atrium's eyebrow is untouched.
    expect(vegaSite).not.toContain("Legal Workflow Automation — Built by PracticePro");
    expect(vegaHero).not.toContain("{eyebrow}");
    expect(atriumSite).toContain("'Atrium · Built by PracticePro'");
  });

  it("sections name the product, never 'run on PracticePro'", () => {
    // Pass B: both attestations live in the product-owned files.
    expect(vegaCredentials).toContain("Why firms run on Vega");
    expect(atriumWhyRunOn).toContain("Why portfolios run on Atrium");
    expect(surfaces).not.toContain("run on PracticePro");
  });

  it("R29 — the possessive register is retired; exactly two products", () => {
    // Owner direction: the site must stop saying "our product" — and it
    // must be clear the company has exactly TWO products, Vega and
    // Atrium. R54 retires the badge taxonomy itself; the two-products
    // framing survives in the closing CTA and the three footers.
    expect(hubWork).not.toContain("badge: 'Our product'");
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

describe("Vega rebrand — the R56 light-enterprise page", () => {
  it("R56: /vega renders ONLY Vega-owned sections — SIX core bands, consolidated", () => {
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
    // The R56 consolidation (owner: "a lot of pages and a lot on there
    // that isn't necessary" → "compress the landing page down to 6 core,
    // highly engaging sections"): twelve bands fold to six — the hero,
    // the tabbed Core Suite hub, the Nigeria differentiators, the
    // trust/segments band, pricing (with the folded FAQ), the final CTA.
    const order = (body.match(/<(Vega[A-Za-z]+)/g) || []).map((t) =>
      t.slice(1)
    );
    expect(order).toEqual([
      "VegaHero",
      "VegaSuite",
      "VegaWhyNigeria",
      "VegaTrust",
      "VegaPricing",
      "VegaFinalCTA",
    ]);
  });

  it("R56: the team/collaborative side rides the Suite's Team Workflows tab", () => {
    // R43 (kept in substance): buyers still need to know it has a
    // team/collaborative side — real captures (the per-counsel task
    // board and a matter's discussion thread) and honest multi-user
    // copy, now inside the tabbed hub instead of a standalone band.
    expect(vegaSuite).toContain("Team Workflows");
    expect(vegaSuite).toContain("The whole team");
    expect(vegaSuite).toContain("/assets/landing/app/tasks-team.jpg");
    expect(vegaSuite).toContain("/assets/landing/app/matter-notes.jpg");
    expect(vegaSuite).toContain("LIVE CAPTURE");
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

  it("R56: the hero is the light-enterprise register — white ground, dashboard preview (R39 kept honest)", () => {
    // R56 (owner: "a clean, modern, light-themed, enterprise-grade landing
    // page"): the full-screen photograph and its dark gradient are
    // RETIRED; the hero is white with a subtle grid + pastel ribbon, a
    // crisp headline on legal workflow automation, dual CTAs (navy Get
    // Started + outline View Live Demo), and the REAL dashboard capture
    // in a light browser container (R28 kept: "use stuff from the app so
    // we are not showing false images").
    expect(vegaHero).not.toContain("bg-clip-text");
    expect(vegaHero).not.toContain("text-transparent");
    expect(vegaHero).not.toContain("vg-pleading");
    expect(vegaHero).not.toContain("vg-doc__line");
    expect(vegaHero).not.toContain("In the High Court of Lagos State");
    expect(vegaHero).not.toContain("ChatRow");
    expect(vegaHero).not.toContain("ALOA · Online");
    // The photograph hero and its dark gradient are retired.
    expect(vegaHero).not.toContain("vega-hero-");
    expect(vegaHero).not.toContain("from-slate-950");
    expect(vegaHero).not.toContain("View scene");
    expect(vegaHero).not.toContain("setInterval");
    expect(vegaHero).not.toContain("<SwirlBands");
    expect(vegaHero).not.toContain("BandsBackground");
    // The light register: white ground, the lifestyle-video hero (R65/R67:
    // the R56 hairline grid + pastel ribbon are retired — the clip is the
    // ground now), the crisp slate headline, the navy accent.
    expect(vegaHero).toContain('className="relative overflow-hidden bg-white"');
    expect(vegaHero).toContain("HeroVideo");
    expect(vegaHero).not.toContain("backgroundImage"); // the R56 grid, retired R66
    expect(vegaHero).not.toContain("rgb(79 70 229 / 0.07)"); // the pastel ribbon, retired R66
    expect(vegaHero).toContain("font-display");
    expect(vegaHero).not.toContain("font-vega");
    expect(vegaHero).toContain("text-slate-900");
    expect(vegaHero).toContain("text-[#1E3A8A]");
    expect(vegaHero).not.toContain("bg-vega-parchment");
    expect(vegaHero).not.toContain("h-px w-24 bg-vega-gilt");
    expect(vegaHero).not.toContain("vg-hero-bg");
    expect(vegaHero).not.toContain("vg-grain");
    // The dashboard preview: the real capture in the light browser frame.
    expect(vegaHero).toContain("/assets/landing/app/dashboard.jpg");
    expect(vegaHero).toContain("rounded-2xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-900/10");
    expect(vegaHero).toContain("LIVE CAPTURE");
    // The headline sells legal workflow automation in Nigeria.
    expect(vegaHero).toContain("Legal workflow automation");
    expect(vegaHero).toContain("Nigerian law firms");
    expect(vegaHero).toContain("NO CREDIT CARD · 30-DAY TRIAL · DRAFTPRO INCLUDED");
    // The dual CTAs are wired by the site index: Get Started (signup) +
    // View Live Demo (R64: opens the demo-access modal — the Vega | Atrium
    // toggle — pre-toggled to Vega; the suite showcase keeps the captures
    // and stays reachable from the nav's "The Suite", which holds the
    // scrollTo('suite') wiring in VegaShell).
    expect(vegaSite).toContain("Get Started");
    expect(vegaSite).toContain("View Live Demo");
    expect(vegaShell).toContain("scrollTo('suite')");
  });

  it("R70: the band is the landing-page background again at EVERY width — the under-2xl card retires; the de-shove, the zero-crop and the clip playlist hold", () => {
    // R70 (owner, verbatim shape): "it is supposed to be on the
    // landingpage background — put it back there." R68 had demoted the
    // clip to a framed card below the copy for every width under 2xl
    // (only >=1536px kept the band); the owner rejected that on seeing
    // it live. R68's own de-shove ("i dont like the manner the vidoe is
    // shoved to the top of the screen") and the seamless playlist ("i
    // have a new set of videos... it should cycle between the videos
    // seamlessly. lets keep this current one. then we use the one with
    // the man next") hold unchanged.
    const heroVideo = read("src", "components", "HeroVideo.tsx");
    // THE PLAYLIST: clip 1 (the typist, R66's assets, kept first) and
    // clip 2 (the cufflink man) cycle with a dissolve; single-clip
    // looping still works while the owner's remaining uploads land.
    expect(heroVideo).toContain("/video/vega-hero.webm");
    expect(heroVideo).toContain("/video/vega-hero-2.webm");
    expect(heroVideo).toContain("/video/vega-hero-2.mp4");
    expect(heroVideo).toContain("ADVANCE_AT");
    expect(heroVideo).toContain("PREFETCH_AT");
    expect(heroVideo).toContain("loop={CLIPS.length === 1}");
    // The cycle is a crossfade over a held frame, never a dip to white.
    expect(heroVideo).toContain("setLast");
    expect(heroVideo).toContain("zIndex: i === active ? 30 : i === last ? 20 : 10");
    // Zero-crop contract (R67) survives: the exact-16:9 band.
    expect(heroVideo).toContain("aspect-video");
    // THE BACKGROUND AT EVERY WIDTH: one presentation, unprefixed — the
    // band is the landing-page background at every viewport, lifted off
    // the navbar (top-24, never back to top-0), and the R68 card
    // variant is retired entirely.
    expect(heroVideo).toContain("absolute inset-x-0 top-24 z-0");
    expect(heroVideo).not.toContain("2xl:top-0");
    expect(heroVideo).not.toContain("rounded-3xl");
    expect(heroVideo).not.toContain("ring-1 ring-slate-900/10");
    // THE STACKING PIN: the band must be its own stacking context below
    // the copy — without z-0 the layer z-indexes escape and the video
    // paints OVER the copy wrapper's z-10 (the R68 acceptance VLM
    // caught the headline invisible under the clip).
    expect(heroVideo).toContain("z-0");
    // THE VEIL LADDER (R70, measured): one rung per width range, each
    // holding its plateau just past that range's measured copy tail
    // (2xl <=57%, xl <=64.3%, lg <=75.3%, below lg to ~88%) — the veils
    // ride at EVERY width now, and the action zone below the copy stays
    // clear on every rung.
    expect(heroVideo).toContain("hidden 2xl:block absolute inset-0");
    expect(heroVideo).toContain("xl:block 2xl:hidden absolute inset-0");
    expect(heroVideo).toContain("lg:block xl:hidden absolute inset-0");
    expect(heroVideo).toContain("lg:hidden absolute inset-0");
    // THE COPY RIDES THE BAND: the copy wrapper precedes the HeroVideo
    // in the section, is min-h'd to the band's box (6rem offset +
    // 56.25vw band height — min-h, not h, because at narrow widths the
    // copy is taller than the band and runs past the foot onto white)
    // and anchors the copy at 11.5vw — R69's measured seat.
    const heroOrder = vegaHero.indexOf('className="relative z-10');
    const clipOrder = vegaHero.indexOf("<HeroVideo />");
    expect(heroOrder).toBeGreaterThan(-1);
    expect(clipOrder).toBeGreaterThan(heroOrder);
    expect(vegaHero).toContain("pt-[calc(6rem+11.5vw)]");
    expect(vegaHero).toContain("min-h-[calc(6rem+56.25vw)]");
    expect(vegaHero).not.toContain("2xl:h-[calc(6rem+56.25vw)]");
    expect(vegaHero).not.toContain("56.25vw_-_39.875rem");
  });

  it("R69: the hero eyebrow retires and the live captures gain presence + the lightbox gallery", () => {
    // Owner direction (verbatim shape): remove the hero's pill badge; on
    // the live captures display overlapping team avatars with a +5
    // overflow badge between the bell and the profile, clickable to a
    // Send-Direct-Message menu; click-to-expand opens a lightbox that
    // walks ALL app views without closing, each view prominently
    // labeled.
    const collab = read("src", "sites", "vega", "sections", "CollabPresence.tsx");
    const lightbox = read("src", "sites", "vega", "sections", "AppShotLightbox.tsx");
    const appShot = read("src", "sites", "vega", "sections", "VegaAppShot.tsx");
    // The eyebrow pill is gone and the anchor absorbs its block.
    expect(vegaHero).not.toContain("LEGAL WORKFLOW");
    expect(vegaHero).not.toContain("bg-indigo-50 px-4 py-1.5");
    // THE PRESENCE OVERLAY: overlapping initials + the +5 overflow chip,
    // pinned into the measured bell→profile gap (cqw geometry), the
    // dropdown with Send-Direct-Message + the honest demo note, and the
    // roster visible on hero + suite captures and inside the lightbox.
    expect(collab).toContain("+5");
    expect(collab).toContain("Send direct message to");
    expect(collab).toContain("Direct messages open inside Vega");
    expect(collab).toContain("8.55cqw");
    expect(collab).toContain("COLLAB_ROSTER");
    expect(vegaHero).toContain("CollabPresence");
    expect(vegaSuite).toContain("CollabPresence");
    expect(lightbox).toContain("CollabPresence");
    // The editor capture (DraftPro toolbar, no app header) opts out.
    expect(vegaSuite).toContain("collab={exhibit.src !== '/assets/landing/app/editor.jpg'}");
    // THE LIGHTBOX: shared gallery — the hero's Dashboard plus every
    // suite exhibit; labeled with the exhibit + group vocabulary;
    // ←/→/Escape; the pill strip walks everything.
    expect(vegaHero).toContain("AppShotLightbox");
    expect(vegaHero).toContain("SUITE_GROUPS");
    expect(vegaSuite).toContain("AppShotLightbox");
    expect(lightbox).toContain("ArrowRight");
    expect(lightbox).toContain("ArrowLeft");
    expect(lightbox).toContain("'Escape'");
    expect(lightbox).toContain("aria-modal");
    // Click-to-expand on the captures (the hover hint + touch chip).
    expect(appShot).toContain("onExpand");
    expect(appShot).toContain("ExpandHint");
    expect(vegaHero).toContain("ExpandHint");
    // The suite keeps its R42 exhibit selector (aria-pressed) — the
    // lightbox is additive, not a replacement.
    expect(vegaSuite).toContain("aria-pressed={shot === i}");
  });

  it("R64: the vega/atrium toggle reaches the vega site — View Live Demo opens the demo-access modal", () => {
    // Owner direction (R64): "the vega/atrium toggle" belongs where the
    // demo is chosen. The R61 header switcher stays retired (a real firm
    // never sees one); the site's "View Live Demo" CTA opens the
    // LeadCaptureModal — which carries the Vega | Atrium product toggle —
    // pre-toggled to the page's product.
    expect(vegaSite).toContain("openModal('leadCapture', null, { demoProduct: 'vega' })");
    expect(vegaSite).not.toContain("scrollTo('suite')}\" tone=\"vega\" className=\"text-base px-8 py-4\">\n                            View Live Demo");
    const modal = read("src", "components", "modals", "LeadCaptureModal.tsx");
    // The toggle, in the family registers: Vega indigo, Atrium yellow,
    // both marks at toggle scale.
    expect(modal).toContain("VegaMark");
    expect(modal).toContain("AtriumMark");
    expect(modal).toContain("Vega — Legal OS");
    expect(modal).toContain("Atrium — Property OS");
    expect(modal).toContain("text-indigo-700");
    expect(modal).toContain("text-yellow-700");
    expect(modal).toContain("role=\"radiogroup\"");
    // The retired pre-rebrand registers are gone: no green primary pills,
    // no emerald Atrium, no green→emerald gradient CTA.
    expect(modal).not.toContain("to-emerald-600");
    expect(modal).not.toContain("from-primary-600 to-emerald-600");
    expect(modal).not.toContain("text-emerald-600");
    // The CTA is the executive navy.
    expect(modal).toContain("bg-[#1E3A8A]");
    // Honest in production: the demo is dev-gated, so the email capture
    // hands off to signup with the CHOSEN product preselected.
    expect(modal).toContain("openModal('signup', null, { selectedProduct })");
  });

  it("R64: the portal logins follow the rebrand — Vega indigo, Atrium yellow", () => {
    // The portal captures on the tour show these surfaces; they wore the
    // pre-rebrand registers (an amber VEGA badge, a violet ATRIUM badge,
    // green/amber CTAs). Now: the product marks at badge scale, the
    // product registers for links/focus/CTAs.
    const clientPortal = read("src", "components", "portal", "ClientPortalLogin.tsx");
    expect(clientPortal).toContain("VegaMark");
    expect(clientPortal).toContain("text-indigo-300");
    // the amber VEGA badge is retired (the remaining amber uses are the
    // functional invite/inactive banners, not brand)
    expect(clientPortal).not.toContain("uppercase tracking-tight text-amber-500");
    expect(clientPortal).toContain("bg-indigo-500/10"); // the ambient glow
    expect(clientPortal).toContain("to-[#1E3A8A]"); // the sign-in CTA
    const tenantPortal = read("src", "components", "portal", "TenantPortalLogin.tsx");
    expect(tenantPortal).toContain("AtriumMark");
    expect(tenantPortal).toContain("text-yellow-400");
    expect(tenantPortal).not.toContain("text-violet-400");
    expect(tenantPortal).toContain("bg-yellow-500/10"); // the ambient glow
    expect(tenantPortal).toContain("from-yellow-400 to-yellow-500"); // the CTA
  });

  it("R64: the SystemTour accents follow the rebrand — Vega indigo, Atrium yellow, Woosh sky", () => {
    // The tour player still carried the retired registers (amber for
    // Vega, emerald for Atrium, a near-Vega indigo for Woosh). The R60
    // registers: Vega indigo #4F46E5, Atrium yellow #EAB308 (the Stepped
    // Stack's tile), Woosh sky (matching the portfolio rows), Kozy green.
    expect(tour).toContain("vega: { hex: '#4F46E5'");
    expect(tour).toContain("atrium: { hex: '#EAB308'");
    expect(tour).toContain("woosh: { hex: '#0EA5E9'");
    expect(tour).toContain("kozy: { hex: '#16A34A'");
    expect(tour).not.toContain("vega: { hex: '#D97706'");
    expect(tour).not.toContain("atrium: { hex: '#059669'");
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
    // The pullout demos stay (owner: "the demos should appear a little
    // further down"): the deadline computer, the drafting studio, the
    // 7·3·1 cadence — the instruments, in miniature.
    expect(vegaAIDrafting).toContain("the instruments, in miniature");
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

  it("R56: the suite is ONE consolidated interactive hub — four tabs, live captures (R38/R42 kept)", () => {
    // Owner direction: "Combine Matter Management, Smart Document/DraftPro
    // Drafting, Time & Billing, and Team Workflows into a single
    // interactive hub." The R42 per-entry index folds into a tabbed
    // surface: four tabs, each with REAL captures (R28 kept: "use stuff
    // from the app so we are not showing false images") and a capture
    // selector so a visitor can page the exhibits.
    expect(vegaSuite).toContain('id="suite"');
    expect(vegaSuite).toContain("The Core Suite");
    expect(vegaSuite).toContain("Matter Management");
    expect(vegaSuite).toContain("Smart Documents & DraftPro");
    expect(vegaSuite).toContain("Time & Billing");
    expect(vegaSuite).toContain("Team Workflows");
    // The light register: slate-50 ground, white exhibits, indigo active
    // tabs — never the old espresso language.
    expect(vegaSuite).toContain("bg-slate-50");
    expect(vegaSuite).toContain("text-slate-900");
    expect(vegaSuite).toContain("bg-indigo-600");
    expect(vegaSuite).not.toContain("bg-vega-night");
    expect(vegaSuite).not.toContain("bg-vega-ink");
    expect(vegaSuite).not.toContain("text-vega-night");
    // The captures are the real product, honestly captioned — the
    // matters ledger, both task-board layouts, contacts, the editor, the
    // vault, research, the team board, the calendar, matter notes,
    // billing, analytics and the bank-transfer invoice.
    expect(vegaSuite).toContain("/assets/landing/app/matters-ledger.jpg");
    expect(vegaSuite).toContain("/assets/landing/app/tasks-status.jpg");
    expect(vegaSuite).toContain("/assets/landing/app/tasks-flat.jpg");
    expect(vegaSuite).toContain("/assets/landing/app/contacts.jpg");
    expect(vegaSuite).toContain("/assets/landing/app/editor.jpg");
    expect(vegaSuite).toContain("/assets/landing/app/research.jpg");
    expect(vegaSuite).toContain("/assets/landing/app/tasks-team.jpg");
    expect(vegaSuite).toContain("/assets/landing/app/calendar.jpg");
    expect(vegaSuite).toContain("/assets/landing/app/matter-notes.jpg");
    expect(vegaSuite).toContain("/assets/landing/app/billing.jpg");
    expect(vegaSuite).toContain("/assets/landing/app/analytics.jpg");
    expect(vegaSuite).toContain("/assets/landing/app/invoice-bank.jpg");
    expect(vegaSuite).toContain("LIVE CAPTURE");
    // R42 kept: tabs switch on hover/tap and the exhibits page through a
    // selector (aria-pressed) — the swap story survives.
    expect(vegaSuite).toContain("onMouseEnter={() => onActivate(i)}");
    expect(vegaSuite).toContain("aria-pressed={shot === i}");
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

  it("R56: the FAQ folds into the pricing band as a compact accordion", () => {
    // The standalone FAQ band is retired in the consolidation; the
    // load-bearing answers ride the pricing band (the cost answer keeps
    // the refund promise — pinned by refunds.test.ts too).
    expect(vegaFAQ).toContain("Questions? Answered.");
    expect(vegaFAQ).not.toContain("bg-vega-ink");
    expect(vegaFAQ).toContain("divide-y divide-slate-200/80");
    expect(vegaFAQ).toContain("Vega for law firms");
    // R21 (kept, scoped to the FAQ copy): no tier names in the answers
    // (the tier CARDS above them legitimately carry the tier labels).
    const faqBlock = vegaFAQ.slice(vegaFAQ.indexOf("const FAQS"), vegaFAQ.indexOf("const CARD_BASE"));
    expect(faqBlock).not.toContain("Growth");
    expect(faqBlock).not.toContain("all tiers");
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

  it("R57/R60 — the Atrium mark is the Stepped Stack, the company logo's formula in yellow", () => {
    // Owner (R57): "the atrium favicon and logo, they are too chunky. i
    // think we ought to use a different color as well please. it should
    // look like the style of the practicepro logo but it should be a
    // different color that works well." Owner (R60): "make atrium
    // yellow instead of the current colour." So the mark IS the company
    // logo's construction (public/logo.svg): a FLAT YELLOW tile, three
    // stepped translucent white blocks (100/80/60%) and the letter cut
    // in negative space from the top block. The R57 indigo retires with
    // the emerald and the Coin before it.
    const marks = read("src", "components", "marketing", "brand", "ProductMarks.tsx");
    expect(marks).toContain("THE STEPPED STACK");
    expect(marks).not.toContain("Coin of the Courtyard");
    expect(marks).not.toContain("Coin of the House");
    // The tile is flat yellow, from the colour-agnostic tile token — no
    // gradient, no emerald, no indigo.
    expect(marks).toContain("rgb(var(--color-atrium-tile))");
    expect(marks).not.toMatch(/AtriumMark[\s\S]*?--color-atrium-jade/);
    expect(marks).not.toContain("--color-atrium-indigo");
    // The stepped white blocks at 100/80/60% — the company logo's own
    // three blocks.
    expect(marks).toMatch(/AtriumMark[\s\S]*?fill="#FFFFFF" fillOpacity="0\.8"/);
    expect(marks).toMatch(/AtriumMark[\s\S]*?fill="#FFFFFF" fillOpacity="0\.6"/);
    // The token is registered in index.css as the resolved yellow.
    const css = read("src", "index.css");
    expect(css).toContain("--color-atrium-tile: 234 179 8");
    // The standalone favicon SVG carries the same construction in
    // resolved hex.
    const atriumFavicon = read("public", "brand", "atrium", "favicon.svg");
    expect(atriumFavicon).toContain("THE STEPPED STACK");
    expect(atriumFavicon).toContain("#EAB308");
    expect(atriumFavicon).not.toContain("#10B981");
    expect(atriumFavicon).not.toContain("#4F46E5");
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

  it("R51/R57 — the A is a BOX letter: flat top, vertical stems, no slants", () => {
    // Owner, R51: "make the 'A' have a flat top it looks too pointed
    // please. it should be a box 'A' not with slants." The R47 A had a
    // narrow apex and splayed legs (L-commands climbing to y 4.5). The
    // letterform is orthogonal end to end: flat top across the full
    // letter width, two vertical stems, a rectangular counter and a
    // squared foot notch — every drawing command is H or V. R57 keeps
    // the register but re-fits the letter inside the top block at the
    // company P's own stroke ratio (stems 4.5 of an 18-wide letter,
    // 25% — the P's exact proportion) and cuts it in negative space.
    const marks = read("src", "components", "marketing", "brand", "ProductMarks.tsx");
    const boxPath = "M15 7.5 H33 V25.5 H28.5 V19.5 H19.5 V25.5 H15 Z";
    const counterPath = "M19.5 10.5 H28.5 V16.5 H19.5 Z";
    expect(marks).toContain(boxPath);
    expect(marks).toContain(counterPath);
    // The pointed/slanted R47 silhouette is gone.
    expect(marks).not.toContain("M6 43.5 L21.5 4.5");
    expect(marks).not.toContain("L31.1 37.5");
    // The chunky R51 full-tile letter is retired too.
    expect(marks).not.toContain("M6 4.5 H42 V43.5");
    // The standalone favicon SVG carries the identical geometry.
    const atriumFavicon = read("public", "brand", "atrium", "favicon.svg");
    expect(atriumFavicon).toContain(boxPath);
    expect(atriumFavicon).toContain(counterPath);
    expect(atriumFavicon).not.toContain("M6 43.5 L21.5 4.5");
  });

  it("R60 — the Vega mark wears the light-enterprise navy + white star", () => {
    // Owner (R60): "please make the vega favicon/icon match the new
    // brand colours" — the R56 light rebrand's executive navy +
    // vibrant indigo register. The mark keeps the Seal construction but
    // the tile is NAVY (#1E3A8A → the deep-navy corner) and the star is
    // WHITE lit toward indigo (#C7D2FE) — the page's own
    // navy-buttons-with-white-text pairing. The R54 burnt-orange and
    // R37 claret registers both retire.
    const marks = read("src", "components", "marketing", "brand", "ProductMarks.tsx");
    expect(marks).toContain("rgb(var(--color-vega-seal))");
    expect(marks).toContain("rgb(var(--color-vega-seal-bright))");
    expect(marks).toContain("rgb(var(--color-vega-seal-ground))");
    // The claret/navy accent tokens never paint the mark's star.
    expect(marks).not.toMatch(/VegaMark[\s\S]*?--color-vega-gilt\)/);
    // The tokens carry the new brand's exact resolved hex.
    const css = read("src", "index.css");
    expect(css).toContain("--color-vega-seal: 255 255 255;");         /* #FFFFFF */
    expect(css).toContain("--color-vega-seal-bright: 199 210 254;");  /* #C7D2FE */
    expect(css).toContain("--color-vega-seal-ground: 30 58 138;");    /* #1E3A8A */
    // The whole vega page register follows the new brand.
    expect(css).toContain("--color-vega-gilt: 30 58 138;");           /* #1E3A8A */
    expect(css).toContain("--color-vega-parchment: 255 255 255;");    /* #FFFFFF */
    expect(css).not.toContain("224 122 63");
    const vegaFavicon = read("public", "brand", "vega", "favicon.svg");
    expect(vegaFavicon).toContain("#1E3A8A");
    expect(vegaFavicon).toContain("#C7D2FE");
    expect(vegaFavicon).not.toContain("#E07A3F");
    expect(vegaFavicon).not.toContain("#2E2015");
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
