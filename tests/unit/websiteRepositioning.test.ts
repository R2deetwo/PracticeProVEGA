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
const index = read("index.html");
const scene = read("src", "components", "marketing", "MorphScene.tsx");
const coreScene = read("src", "components", "marketing", "SystemCoreScene.tsx");
const tour = read("src", "components", "marketing", "SystemTour.tsx");
const css = read("src", "index.css");

describe("W6/W7 — the root page is the company's corporate home", () => {
  it("the hero sells what the company does, value-first", () => {
    expect(landing).toContain("Build systems that help");
    // W17: the promise is “Build systems that help scale your X”. X is a
    // single noun the owner recognises, and ONLY the noun ever changes.
    // W16 padded every noun into a box as wide as “organization” — a dead
    // gap after every shorter word. W17 MEASURES each noun in the live
    // headline font and glides the slot to exactly the live word: no
    // reserve, no trailing gap, no full stop, and the line count is
    // locked (below sm the noun owns its own line; from sm up the final
    // line is sized for the widest noun).
    expect(landing).toContain("scale your");
    expect(landing).toContain("SCALE_NOUNS");
    expect(landing).not.toContain("SCALE_NOUN_RESERVE");
    expect(landing).toContain("getBoundingClientRect().width");
    expect(landing).toContain("ResizeObserver");
    expect(landing).toContain("document.fonts.ready");
    // No full stop riding the cycling word.
    expect(landing).not.toContain("{SCALE_NOUNS[i]}.");
    // The noun owns its line below sm — no noun can change the wrap.
    expect(landing).not.toContain("scale your{' '}<ScalingNoun />");
    expect(landing).toContain('<br className="sm:hidden" />');
    expect(landing).toContain("'business'");
    expect(landing).toContain("'practice'");
    expect(landing).toContain("'firm'");
    expect(landing).toContain("'clinic'");
    expect(landing).toContain("'pharmacy'");
    expect(landing).toContain("'school'");
    expect(landing).toContain("'restaurant'");
    expect(landing).toContain("'organization'");
    expect(landing).not.toContain("scale with.");
    expect(landing).not.toContain("SCALE_VERTICALS");
    expect(landing).not.toContain("businesses run on.");
  });

  it("W17 — the page decorates in the brand's green, not amber (owner: “quite a cry from my colors”)", () => {
    // Gradient type: mint → emerald → green, never amber-led.
    expect(landing).toContain("linear-gradient(to right, #6EE7B7, #34D399, #4ADE80)");
    expect(landing).not.toContain("#F59E0B");
    // The clouds/aurora glows are green.
    expect(landing).not.toContain("bg-amber-500/10 blur-[110px]");
    expect(landing).not.toContain("bg-amber-500/[0.07]");
    expect(landing).not.toContain("bg-amber-400/70");
    // The 3D scenes kiss their crests and rims in mint, not amber.
    expect(scene).not.toContain("#D97706");
    expect(scene).toContain("#6EE7B7");
    expect(coreScene).not.toContain("#D97706");
    expect(coreScene).toContain("#6EE7B7");
    // The hero's structural fallback cloud is mint too.
    expect(css).not.toContain("rgba(217, 119, 6, 0.15)");
    expect(css).not.toContain("linear-gradient(135deg, #F59E0B, #16A34A)");
    // Vega keeps its amber PRODUCT identity (product coding, not page
    // decoration) — that contract is untouched.
    expect(css).toContain("--color-amber: #D97706");
  });

  it("the hero positions the company broadly — we build systems, not 'a Lagos software company' (W7)", () => {
    expect(landing).toContain("PracticePro Systems designs, builds and runs");
    expect(landing).not.toContain("is a Lagos software company");
  });

  it("the company-and-location eyebrow is retired from the top of the page", () => {
    expect(landing).not.toContain("PracticePro Systems · Lagos, Nigeria");
  });

  it("the corporate nav walks the company sections", () => {
    expect(landing).toContain("What We Do");
    expect(landing).toContain("Our Work");
    expect(landing).toContain("How We Work");
    expect(landing).toContain("About");
  });

  it("the services section presents builder capabilities", () => {
    expect(landing).toContain("WHAT_WE_DO");
    expect(landing).toContain("What we can build for you");
    expect(landing).toContain("Custom business systems");
    expect(landing).toContain("Custom integrations");
    expect(landing).toContain("Payments & revenue operations");
    expect(landing).toContain("Hosting, security & compliance");
  });

  it("the engagement process is presented", () => {
    expect(landing).toContain("HOW_WE_WORK");
    expect(landing).toContain("From first conversation to a system you scale with");
    expect(landing).toContain("Understand your operations");
    expect(landing).toContain("Launch, train & run with you");
  });

  it("the about section grounds the company in Lagos honestly", () => {
    expect(landing).toContain("Run in production.");
    expect(landing).toContain(
      "PracticePro Systems is a software company based in Lagos, Nigeria."
    );
  });
});

describe("W6 — the portfolio: products + client commissions", () => {
  it("presents the systems the company has built", () => {
    expect(landing).toContain("OUR_WORK");
    expect(landing).toContain("Systems we&apos;ve built");
  });

  it("Vega and Atrium link to their product pages", () => {
    expect(landing).toContain("Vega — Legal Practice OS");
    expect(landing).toContain("Atrium — Property Management OS");
    expect(landing).toContain('href="/vega"');
    expect(landing).toContain('href="/atrium"');
  });

  it("Kozy Care is presented as a client commission, live at kozycare.ng", () => {
    expect(landing).toContain("Kozy Care");
    expect(landing).toContain("Built for a client");
    expect(landing).toContain("https://kozycare.ng");
  });

  it("every work card carries the Built-by mark", () => {
    expect(landing).toContain("Built by PracticePro");
  });

  it("the hub footer sells the custom-systems line of business", () => {
    expect(landing).toContain("Custom systems — built to order");
    expect(landing).toContain("Kozy Care — a client build");
  });
});

describe("W7 — the wow site: real screens, stack, and the preview system", () => {
  it("the capabilities marquee carries the builder vocabulary", () => {
    expect(landing).toContain("MARQUEE_ITEMS");
    expect(landing).toContain("Custom Integrations");
    expect(landing).toContain("AI & Automation");
  });

  it("every project showcases REAL SCREENS captured from the live systems", () => {
    // Vega — product page + real mobile-app screens + client portal
    expect(landing).toContain("/assets/landing/work/vega-page.jpg");
    expect(landing).toContain("/assets/landing/work/vega-calendar.jpg");
    expect(landing).toContain("/assets/landing/work/vega-messages.jpg");
    expect(landing).toContain("/assets/landing/work/vega-portal.jpg");
    // Atrium — product page + the financials app screen + residents' portal
    expect(landing).toContain("/assets/landing/work/atrium-page.jpg");
    expect(landing).toContain("/assets/landing/work/atrium-financials.jpg");
    expect(landing).toContain("/assets/landing/work/atrium-portal.jpg");
    // Kozy Care — the client's live customer-facing system
    expect(landing).toContain("/assets/landing/work/kozy-home.jpg");
    expect(landing).toContain("/assets/landing/work/kozy-services.jpg");
    expect(landing).toContain("/assets/landing/work/kozy-memberships.jpg");
  });

  it("each project presents its stack and what's inside it", () => {
    expect(landing).toContain("Built with");
    expect(landing).toContain("Inside the system");
    // Stack chips for all three systems (honest — verified against the repos)
    expect(landing).toContain("'React + TypeScript', 'Convex'");
    expect(landing).toContain("'Gemini AI'");
    expect(landing).toContain("'Next.js', 'Prisma + Supabase'");
    expect(landing).toContain("'Paystack'");
    // What's inside
    expect(landing).toContain("'AI drafting — DraftPro & ALOA'");
    expect(landing).toContain("'GPS rider dispatch — 12 zones'");
  });

  it("the preview modal opens per project and offers the live system + contact", () => {
    expect(landing).toContain("WorkDetailModal");
    expect(landing).toContain("Preview the system");
    expect(landing).toContain("Ask us about a system like this");
  });

  it("the hero carries the morphing system with a structural CSS fallback", () => {
    expect(landing).toContain("MorphScene");
    expect(landing).toContain("w8-lattice-fallback");
    expect(landing).toContain("w8-scene-enter");
  });
});

describe("W8 — structured fluidity: the lattice system", () => {
  it("the hero shows structure that morphs — a system lattice, not a blob", () => {
    // The crystal lattice: faceted core + wireframe + nodes + rings + network.
    expect(scene).toContain("structured fluidity");
    expect(scene).toContain("IcosahedronGeometry");
    expect(scene).toContain("LineSegments");
    expect(scene).toContain("constellation network");
    // The structural CSS fallback lives in the stylesheet.
    expect(css).toContain(".w8-lattice-fallback");
  });

  it("sections pour into each other through visible SVG waves that morph as you scroll (W10)", () => {
    expect(landing).toContain("FluidSeam");
    // W10: the seam is a true SVG wave — the curve reshapes with scroll.
    expect(landing).toContain("w10-seam");
    expect(landing).toContain("path.setAttribute");
    expect(css).toContain(".w10-seam");
    // Each seam carries its own phase so no two curves match.
    expect(landing).toContain("phase={0}");
    expect(landing).toContain("phase={1}");
    expect(landing).toContain("phase={2}");
    expect(landing).toContain("phase={3}");
    // Every tonal shift on the hub is seamed: dark→light, light→dark,
    // dark→light again, and paper→dark into the closing CTA.
    expect(landing).toContain('<FluidSeam from="#0A101C" to="#FFFFFF"');
    expect(landing).toContain('<FluidSeam from="#FFFFFF" to="#0A101C"');
    expect(landing).toContain('<FluidSeam from="#0A101C" to="#FFFFFF"');
    expect(landing).toContain('<FluidSeam from="#FBFBF9" to="#0A101C"');
  });

  it("the nav carries a fluid pill that morphs between sections", () => {
    expect(landing).toContain("w8-nav-pill");
    expect(landing).toContain("data-nav-id");
    expect(css).toContain(".w8-nav-pill");
  });

  it("auth lives with the products, not on the company page", () => {
    // The hub hero no longer offers a sign-in…
    expect(landing).not.toContain("Already have an account?");
    // …the NavBar gates Log In / Start Free Trial behind productChosen and
    // offers a quiet conversation on the company page instead.
    expect(landing).toContain("auth lives with the products");
    expect(landing).toContain("Talk to us");
    expect(landing).toContain("Talk to us about your system");
    // The product pages keep their conversion machinery.
    expect(landing).toContain("Start Free Trial");
    expect(landing).toContain("Log In");
  });
});

describe("W9/W10/W13 — the living page, then the system core", () => {
  it("the What-we-do visual is a real 3D system core — and the mark is nowhere in it (W13)", () => {
    expect(landing).toContain('<SystemCoreScene className="w13-canvas" />');
    // The old mark-in-a-box scene is gone from the page for good.
    expect(landing).not.toContain("LogoScene");
    expect(landing).not.toContain("w10-logo-box");
    // Seven modules — one per capability card below.
    expect(coreScene).toContain("MODULE_COUNT = 7");
    // The mark may never be disassembled (W10/W12 standing rule), and the
    // owner has now removed it from this section altogether: the scene
    // carries no mark geometry at all.
    expect(coreScene).not.toContain("shard");
    expect(coreScene).not.toContain("LOGO_");
    expect(coreScene).not.toContain("disassembl");
    expect(coreScene).not.toContain("w10-logo");
    expect(coreScene).not.toContain("P_PATH");
    expect(landing).not.toContain("LOGO_SHARDS");
    // The old facet machinery stays gone from the page for good (W10).
    expect(landing).not.toContain("data-shard");
    expect(landing).not.toContain("shard-socket");
    expect(css).not.toContain(".shard-socket");
    expect(css).not.toContain(".w10-shard-overlay");
  });

  it("each capability card carries a quiet, always-on icon chip (W13)", () => {
    // The orbiting modules above carry the motion now; the cards stay calm
    // and legible — no dashed ports waiting for a trace that no longer
    // exists. Each card shows its own icon (briefcase, link, payments…).
    expect(landing).toContain('<c.Icon className="w-6 h-6" />');
    expect(landing).toContain("rounded-xl bg-emerald-50 border border-emerald-100");
  });

  it("everything renders INSIDE the canvas — no line may ever cross the text (W13)", () => {
    // The W12 overlay was fixed, viewport-sized, and portaled to body —
    // its traces struck through the section's headings. The system core
    // is a plain block in the document flow: no portal, no fixed layer,
    // no measured-DOM routing, so text can never be overlapped.
    expect(coreScene).not.toContain("createPortal");
    expect(coreScene).not.toContain("position: fixed");
    expect(coreScene).not.toContain("getPointAtLength");
    expect(landing).not.toContain("data-trace-grid");
    expect(landing).not.toContain("data-trace-slot");
    expect(landing).not.toContain("data-trace-socket");
    expect(landing).not.toContain("trace-port");
    expect(css).not.toContain(".w12-trace-overlay");
    expect(css).not.toContain(".trace-port");
    // The scene still arrives with craft: a stage, an ambient CSS fallback
    // if WebGL is missing, and a caption that ties it to the cards.
    expect(landing).toContain('className="w13-stage"');
    expect(landing).toContain('className="w13-canvas"');
    // W14: the owner's own words replace the jargon — "seven modules" never
    // meant anything to a layman; "making your systems one" is the promise.
    expect(landing).toContain("Making your systems one.");
    expect(landing).not.toContain("Seven modules. One system.");
    expect(css).toContain(".w13-stage");
    expect(css).toContain(".w13-fallback");
    expect(css).toContain(".w13-caption");
  });

  it("the scene runs on the hero's engine contract — lazy, pausable, disposable", () => {
    expect(coreScene).toContain("await import('three')");
    expect(coreScene).toContain("IntersectionObserver");
    expect(coreScene).toContain("prefers-reduced-motion");
    expect(coreScene).toContain("renderer.dispose()");
  });

  it("the riding-squares layer is retired — no stray floaters (W10)", () => {
    expect(landing).not.toContain("SystemSquares");
    expect(css).not.toContain(".w9-squares-canvas");
  });

  it("text settles in softly across the hub — never a hard cut", () => {
    expect(css).toContain(".w9-reveal");
    expect(css).toContain(".w9-reveal-stagger");
    expect(landing).toContain("w9-reveal text-center");
    expect(landing).toContain("w9-reveal-stagger grid");
  });

  it("the process walks itself — steps light up in sequence", () => {
    expect(landing).toContain("w9-step-node");
    expect(landing).toContain("w9-step-card");
    expect(landing).toContain("w9-spine-pulse");
    expect(landing).toContain("WALKS ITSELF");
    expect(css).toContain(".w9-step-node.is-active");
  });

  it("a workflow & notification capability joins the builder services", () => {
    expect(landing).toContain("Workflow & notification engines");
    expect(landing).toContain("Workflow Automation");
  });

  it("the preview goes INSIDE with REAL captures — no mocked-up UI (W10, W15)", () => {
    expect(landing).toContain("SystemTour");
    expect(landing).toContain("tourSystem: 'vega'");
    expect(landing).toContain("tourSystem: 'atrium'");
    expect(landing).toContain("tourSystem: 'kozy'");
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
    expect(landing).toContain("/assets/landing/work/kozy-book.jpg");
    expect(landing).toContain("/assets/landing/work/kozy-login.jpg");
    expect(landing).toContain("/assets/landing/work/kozy-partners.jpg");
    expect(landing).toContain("Payments, receipts & invoices — Paystack");
  });
});

describe("W11 — the interiors go real, and our own tool joins the portfolio", () => {
  it("Kozy Care quotes its real tagline on the card", () => {
    expect(landing).toContain("Uncompromising care. Exceptional convenience.");
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
    expect(landing).toContain("/assets/landing/work/kozy-order-service.jpg");
    expect(landing).toContain("/assets/landing/work/kozy-portal-order.jpg");
    expect(landing).toContain("/assets/landing/work/kozy-invoice.jpg");
    expect(landing).toContain("/assets/landing/work/kozy-admin-crm.jpg");
  });

  it("Woosh — our own free tool — joins the portfolio as a fourth entry", () => {
    expect(landing).toContain("name: 'Woosh'");
    expect(landing).toContain("Our tool");
    expect(landing).toContain("https://woosh.dpdns.org");
    expect(landing).toContain("tourSystem: 'woosh'");
    // The stack story is capability-honest (no invented framework).
    expect(landing).toContain("REST API + webhooks");
    expect(landing).toContain("Verification-code extraction");
  });

  it("the Woosh tour shows the real tool in action, including Kozy mail", () => {
    expect(tour).toContain("woosh-home.jpg");
    expect(tour).toContain("woosh-inbox.jpg");
    expect(tour).toContain("woosh-message.jpg");
    expect(tour).toContain("woosh-dark.jpg");
    expect(tour).toContain("woosh-api.jpg");
  });

  it("the footer lists Woosh alongside the products and the client build", () => {
    expect(landing).toContain("Woosh — free temp email");
  });
});

describe("W14 — navigation truth, the pulse, the descent and the pitch", () => {
  it("the logo and All Products carry you home from any product page", () => {
    // The logo navigates back to the hub (the morphing-crystal company page)
    // instead of scrolling the product page to its own top.
    expect(landing).toContain("if (productChosen) onBackToHub(); else scrollTo('home')");
    expect(landing).toContain("pathname !== '/'");
    expect(landing).toContain("navigate('/')");
  });

  it("the Products menu navigates to the real product pages", () => {
    expect(landing).toContain("const target = p === 'vega' ? '/vega' : '/atrium';");
    expect(landing).toContain("navigate(target)");
    // The footer's product entries are real anchors now — right-click,
    // open-in-new-tab and shared links all work.
    expect(landing).toContain('href="/vega"');
    expect(landing).toContain('href="/atrium"');
  });

  it("the hero sells the problem, not the product catalogue", () => {
    // The "Our products" quick-links are gone from the hero — too early.
    expect(landing).not.toContain("Our products</span>");
    // The description plants the pain instead of listing the portfolio.
    expect(landing).toContain("arrive on WhatsApp to the receipts that leave with every job");
  });

  it("a mirror before the pitch: Sound familiar? names the visitor's friction", () => {
    expect(landing).toContain("PAIN_MIRROR");
    expect(landing).toContain("Sound familiar?");
    expect(landing).toContain("just not software");
    expect(landing).toContain("You need a system");
    expect(landing).toContain("Tell us what runs your business today");
    expect(landing).toContain('<PainMirrorSection onContactSales');
  });

  it("the orb zips a point toward the pointer — wave out, echo back (MorphScene)", () => {
    expect(scene).toContain("uPulseDir");
    expect(scene).toContain("uAntiAmp");
    expect(scene).toContain("firePulse");
    // Two damped springs: the near zip and the far-side echo.
    expect(scene).toContain("SPRING_K");
    expect(scene).toContain("ANTI_K");
  });

  it("the system core morphs its shapes and they descend into the cards", () => {
    // The superellipsoid engine: one formula, every form the owner asked for.
    expect(coreScene).toContain("SUPERELLIPSOID");
    expect(coreScene).toContain("const SHAPES: ShapeDef[]");
    expect(coreScene).toContain("applyShape");
    // Cubes are no longer the only citizens — pyramids, prisms, octahedra.
    expect(coreScene).toContain("pyramid");
    expect(coreScene).toContain("prism");
    expect(coreScene).toContain("octahedron");
    // The scroll-linked descent: shapes leave the canvas toward the cards.
    expect(coreScene).toContain("descentProgress");
    // Vertical pointer authority matches the horizontal.
    expect(coreScene).toContain("curY * 0.24");
  });

  it("each capability card receives its own shape on landing", () => {
    expect(landing).toContain("useLandingCards");
    expect(landing).toContain("w14-card");
    expect(landing).toContain("w14-shape");
    expect(landing).toContain("w14-chip");
    expect(landing).toContain('id="whatWeDoGrid"');
    expect(landing).toContain("CARD_SHAPES");
    expect(css).toContain(".w14-card.w14-landed .w14-shape");
    expect(css).toContain(".w14-card.w14-landed .w14-chip::after");
    // The cue under the scene continues the descent to the cards.
    expect(landing).toContain("scrollTo('whatWeDoGrid')");
  });
});

describe("W1/W2 — company-behind-products framing on the website", () => {
  it("the footer names the company's role and carries the Built-by mark", () => {
    expect(landing).toContain(
      "We design, build and run the systems businesses manage their affairs with"
    );
    expect(landing).toContain("From Lagos, for businesses anywhere");
    expect(landing).toContain("Vega &amp; Atrium · Built by PracticePro");
  });

  it("product heroes carry the Built-by attribution eyebrow", () => {
    expect(landing).toContain("'Vega · Built by PracticePro'");
    expect(landing).toContain("'Atrium · Built by PracticePro'");
  });

  it("sections name the product, never 'run on PracticePro'", () => {
    expect(landing).toContain("'Why firms run on Vega'");
    expect(landing).toContain("'Why portfolios run on Atrium'");
    expect(landing).not.toContain("run on PracticePro");
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
      expect(landing).not.toContain(name);
    }
  });

  it("no five-star testimonial markup; capability cards instead", () => {
    expect(landing).not.toContain("Star rating");
    expect(landing).not.toContain("M9.049 2.927"); // the deleted star SVG path
    expect(landing).toContain("WHY_RUN_ON");
    expect(landing).toContain("Drafted for Nigerian courts");
    expect(landing).toContain("Every state's tenancy law, applied");
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
