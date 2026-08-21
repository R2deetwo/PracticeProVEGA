# PRACTICEPRO — RESOURCES & DOCUMENTATION PAGE
## Master Implementation Spec for App Builder
## Version 1.0 | August 2026

---

## OVERVIEW

Rebuild the Resources/Documentation page from scratch. The current page has weak content, and the "What's New" toggle does not actually filter by product (Vega/Atrium/Komplete) despite the UI suggesting it does.

**Your job:** Build a proper Resources hub with rich content, functional product filtering, and a content architecture that scales.

**What the AI has provided:**
- White papers (fully written, ready to publish)
- What's New changelog content (fully written, tagged by product)
- Content strategy for all other sections

**What you must build:**
- All UI components, routing, filtering logic, and layout
- Integration with the existing design system (React + Tailwind + shadcn/ui)
- Responsive layout, animations, and interactions

---

## PAGE ARCHITECTURE

The Resources page is a single-page hub with tabbed navigation. URL: `/resources`

```
/resources
├── Hero Section
├── Navigation Tabs
│   ├── What's New (default active)
│   ├── Documentation
│   ├── White Papers
│   ├── Video Guides
│   ├── Blog
│   └── Help Center
├── Active Tab Content
└── CTA Footer
```

---

## 1. HERO SECTION

### Layout
- Full width, `bg-slate-900` or brand primary
- `py-20` padding
- Centered text

### Copy
**Headline:** "Resources for Nigerian Professionals"  
`text-4xl md:text-5xl font-bold text-white`

**Subheadline:** "Documentation, guides, white papers, and product updates — everything you need to get the most from PracticePro."  
`text-lg text-white/70 max-w-2xl mx-auto mt-4`

**Search Bar:**  
- Centered, max-width `max-w-xl`
- Placeholder: "Search documentation, guides, and updates..."
- Icon: `Search` (Lucide)
- Styled: `bg-white/10 border-white/20 text-white placeholder:text-white/50`
- Functional: filters all tab content in real-time

---

## 2. TAB NAVIGATION

### Layout
- Sticky below hero, `bg-white border-b border-slate-200`
- Horizontal scroll on mobile
- Active tab: `border-b-2 border-primary text-primary font-semibold`
- Inactive tab: `text-slate-500 hover:text-slate-700`

### Tabs
| Tab | Icon | Route Anchor | Description |
|-----|------|-------------|-------------|
| What's New | `Bell` | `#whats-new` | Product changelog |
| Documentation | `BookOpen` | `#docs` | Product guides & API |
| White Papers | `FileText` | `#white-papers` | Industry reports |
| Video Guides | `PlayCircle` | `#videos` | Tutorial videos |
| Blog | `Newspaper` | `#blog` | Articles & insights |
| Help Center | `HelpCircle` | `#help` | FAQs & support |

### Deep Linking
- `/resources#whats-new` → opens What's New tab
- `/resources#docs` → opens Documentation tab
- Each tab updates URL hash without page reload

---

## 3. WHAT'S NEW TAB (CRITICAL FIX)

### The Problem
The current "What's New" has a toggle for Vega/Atrium/Komplete but the content is not actually filtered by product. All entries show regardless of toggle state.

### The Fix
Each changelog entry must have a `products` array: `["vega"]`, `["atrium"]`, `["komplete"]`, or `["vega", "atrium", "komplete"]`.

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Filter: [All] [Vega] [Atrium] [Komplete]                   │
│                                                             │
│  ┌──────────┐                                               │
│  │ AUG 2026 │  [Vega] [Atrium]                              │
│  │          │  v2.4.0 — AI Drafting & Resident Portal        │
│  │    14    │  DraftPro now supports inline citations...      │
│  └──────────┘                                               │
│                                                             │
│  ┌──────────┐                                               │
│  │ JUL 2026 │  [Atrium]                                     │
│  │          │  v1.2.0 — Sentry Pass Gatehouse Terminal      │
│  │    28    │  Gatekeepers can now verify visitor codes...    │
│  └──────────┘                                               │
└─────────────────────────────────────────────────────────────┘
```

### Filter Buttons
- Pill-style buttons: `All`, `Vega`, `Atrium`, `Komplete`
- Active: `bg-primary text-white`
- Inactive: `bg-slate-100 text-slate-600 hover:bg-slate-200`
- Only show entries where `entry.products.includes(selectedFilter)`
- "All" shows everything

### Changelog Entry Card

```
┌────────────────────────────────────────────────────────────┐
│  ┌──────────┐                                              │
│  │   AUG    │  [Vega] [Atrium]          ← Product badges   │
│  │   14     │                                              │
│  │  2026    │  v2.4.0 — AI Drafting & Resident Portal     │
│  └──────────┘                                              │
│                                                            │
│  DraftPro now supports inline citations with source       │
│  verification. The Resident Portal gets a new payment     │
│  history view. Plus: 6 bug fixes.                         │
│                                                            │
│  [Read More →]                                             │
└────────────────────────────────────────────────────────────┘
```

**Card specs:**
- `rounded-xl border border-slate-200 p-6`
- Date badge: `bg-slate-100 rounded-lg p-3 text-center min-w-[70px]`
- Product badges: small pills, color-coded:
  - Vega: `bg-blue-100 text-blue-700`
  - Atrium: `bg-emerald-100 text-emerald-700`
  - Komplete: `bg-purple-100 text-purple-700`
- Category tag (optional): `Feature`, `Improvement`, `Fix`, `Security`

### Entry Detail Modal/Drawer
Clicking "Read More" opens a side drawer or modal with:
- Full version notes
- Screenshots/GIFs if available
- Related documentation links
- "Was this helpful?" thumbs up/down

### Content Source
The AI has provided 12 months of changelog content in `PracticePro_Whats_New_Content.md`. Use this as the initial dataset. Store as a JSON array in your codebase or fetch from Convex.

**Convex schema suggestion:**
```typescript
// convex/whatsNew.ts
export const changelogEntries = defineTable({
  version: v.string(),
  date: v.number(), // timestamp
  title: v.string(),
  summary: v.string(),
  details: v.string(),
  products: v.array(v.union(v.literal("vega"), v.literal("atrium"), v.literal("komplete"))),
  category: v.union(v.literal("feature"), v.literal("improvement"), v.literal("fix"), v.literal("security")),
  published: v.boolean(),
});
```

---

## 4. DOCUMENTATION TAB

### Layout
- Two-column on desktop: sidebar (left) + content (right)
- Single column on mobile: collapsible sidebar

### Sidebar Navigation

**Vega Documentation**
- Getting Started
  - Creating Your First Matter
  - Setting Up Your Team
  - Importing Client Data
- Matter Management
  - Creating & Editing Matters
  - Court Date Reminders
  - Document Linking
- DraftPro
  - Using the Editor
  - ALOA AI Copilot
  - Placeholder Guardrails
- Billing
  - Creating Invoices
  - Retainer Management
  - Payment Tracking
- Client Portal
  - Setting Up Client Access
  - KYC Uploads
  - Milestone Sharing

**Atrium Documentation**
- Getting Started
  - Adding Your First Property
  - Setting Up Units & Tenants
  - Configuring Payment Methods
- Rent Collection
  - Paystack Setup
  - Manual Bank Transfer
  - Receipt Generation
- Revenue Monitor
  - Reading the Dashboard
  - Defaulter Tracking
  - Exporting Reports
- Resident Portal
  - Tenant Onboarding
  - Maintenance Tickets
  - Payment History
- Sentry Pass
  - Generating Visitor Codes
  - Gatehouse Terminal Setup
  - QR Code Verification
- Service Charges
  - Creating SC Categories
  - Electricity & Internet Tracking
  - Bulk Billing

**Komplete Documentation**
- Unified Workspace Setup
- Cross-Product Navigation
- Shared Storage & Billing
- Enterprise Features

### Content Pages
Each doc page should have:
- Breadcrumb: `Docs > Vega > Matter Management > Creating Matters`
- Last updated date
- "Was this helpful?" feedback
- "Next: [Topic]" navigation at bottom
- Copy code button for any code snippets
- Anchor links for H2/H3 headings

### Search
- The global search bar filters documentation titles and summaries
- Highlight matching terms in results
- Keyboard shortcut: `Cmd/Ctrl + K` opens search modal

---

## 5. WHITE PAPERS TAB

### Layout
- Grid of white paper cards (2 columns on desktop, 1 on mobile)
- Each card: cover image, title, description, read time, download button

### White Papers (Fully Written — See `PracticePro_White_Papers.md`)

| # | Title | Pages | Description |
|---|-------|-------|-------------|
| 1 | The State of Legal Practice Management in Nigeria | 12 | Market size, pain points, technology adoption among Nigerian law firms |
| 2 | Property Management Technology: A Nigerian Market Analysis | 10 | Rental market trends, digital payment adoption, prop-tech opportunities |
| 3 | NDPA 2023 Compliance for Professional Service Firms | 8 | Practical guide to Nigeria's Data Protection Act for law firms and property managers |
| 4 | AI in Legal Practice: Opportunities and Risks for Nigerian Law Firms | 10 | Gemini, ChatGPT, and the future of legal drafting in Nigeria |

### Card Design
```
┌─────────────────────────────┐
│  [Cover Image]              │
│                             │
│  The State of Legal...      │
│  12 pages • PDF             │
│                             │
│  A comprehensive look at   │
│  how Nigerian law firms...  │
│                             │
│  [Download PDF]              │
└─────────────────────────────┘
```

- Cover: gradient background with title text (auto-generated, no image asset needed)
- Download: opens PDF in new tab or triggers download
- Gated: email capture before download (optional, for lead gen)

---

## 6. VIDEO GUIDES TAB

### Layout
- Grid of video cards (3 columns desktop, 2 tablet, 1 mobile)
- Filter by product: `All`, `Vega`, `Atrium`, `Komplete`

### Video Content Structure
Each video card:
- Thumbnail (16:9, auto-generated from title + play button overlay)
- Duration badge
- Title
- Description (1 line)
- Product badge
- "Watch" button → opens modal with embedded player

### Video Topics (You create these — AI cannot produce video)

**Vega Videos:**
1. "Getting Started with Vega" (5 min)
2. "Creating Your First Matter" (3 min)
3. "Using DraftPro for Legal Documents" (8 min)
4. "ALOA AI Copilot Walkthrough" (6 min)
5. "Setting Up Court Date Reminders" (4 min)
6. "Client Portal Demo" (5 min)
7. "Billing & Invoicing in Vega" (7 min)

**Atrium Videos:**
1. "Getting Started with Atrium" (5 min)
2. "Adding Properties & Units" (4 min)
3. "Revenue Monitor Dashboard" (6 min)
4. "Collecting Rent with Paystack" (5 min)
5. "Resident Portal Walkthrough" (7 min)
6. "Sentry Pass: Visitor Management" (6 min)
7. "Service Charge Tracking" (5 min)

**Komplete Videos:**
1. "Unified Workspace Overview" (6 min)
2. "Managing Both Legal & Property" (8 min)

### Video Modal
- Backdrop blur
- Centered player (YouTube embed or self-hosted)
- Related videos sidebar
- Transcript accordion (if available)

---

## 7. BLOG TAB

### Layout
- Featured post (large, top)
- Grid of recent posts below (3 columns desktop)
- Filter by category: `Product`, `Industry`, `Tutorial`, `Company`

### Blog Post Structure
Each post:
- Cover image
- Category badge
- Title
- Excerpt (2 lines)
- Author + date + read time
- "Read More" → full article page

### Blog Content (AI has provided starter topics — you write the articles)

**Product Posts:**
- "What's New in Vega v2.4: AI Drafting & Inline Citations"
- "Atrium's 60-Day Trial: Why We Changed It"
- "How Sentry Pass Works: A Technical Deep Dive"
- "Komplete: Why We Built a Unified Platform"

**Industry Posts:**
- "Why Nigerian Law Firms Are Moving to Cloud Practice Management"
- "The Hidden Cost of Excel-Based Property Management"
- "NDPA 2023: What Every Nigerian Professional Needs to Know"
- "WhatsApp vs Email: Why Nigerian Tenants Prefer WhatsApp"

**Tutorial Posts:**
- "How to Set Up Paystack for Rent Collection"
- "Creating Your First Legal Document with DraftPro"
- "5 Ways to Reduce Rent Defaults Using Atrium"
- "Organizing Matters by Court and Jurisdiction"

**Company Posts:**
- "Building PracticePro: A Founder's Journey"
- "Why We Chose Convex for Real-Time Data"
- "PracticePro Joins NIESV as Technology Partner"

### Blog Post Page
- Hero image (full width)
- Title + meta (author, date, category, read time)
- Body content (rich text, images, code blocks)
- Share buttons (LinkedIn, Twitter/X, WhatsApp, copy link)
- "Related Articles" at bottom
- Author bio card

---

## 8. HELP CENTER TAB

### Layout
- Search bar (prominent)
- Category cards (2x3 grid)
- Popular articles list
- "Still need help?" CTA

### Categories

| Category | Icon | Articles |
|----------|------|----------|
| Getting Started | `Rocket` | 8 articles |
| Account & Billing | `CreditCard` | 6 articles |
| Vega | `Scale` | 12 articles |
| Atrium | `Building2` | 12 articles |
| Security & Privacy | `Shield` | 5 articles |
| API & Integrations | `Code` | 4 articles |

### Popular Articles (Starter List)
1. "How do I reset my password?"
2. "How do I upgrade my subscription?"
3. "How do I add team members?"
4. "How do I connect Paystack?"
5. "How do I generate a Sentry Pass?"
6. "What happens when I hit my storage limit?"
7. "How do I export my data?"
8. "Is my data backed up?"

### Article Page
- Breadcrumb navigation
- Last updated date
- "Was this helpful?" thumbs + comment box
- Related articles
- "Contact Support" button

---

## 9. CTA FOOTER

### Layout
- `bg-primary text-white py-16`
- Centered

**Headline:** "Can't find what you're looking for?"  
**Subheadline:** "Our support team is available on WhatsApp and email. Average response time: under 4 hours."

**CTAs:**
- Primary: "Chat on WhatsApp" → `wa.me/234...` (opens WhatsApp)
- Secondary: "Email Support" → `mailto:support@practicepro.ng`
- Tertiary: "Schedule a Call" → Calendly link

---

## DESIGN TOKENS & COMPONENTS

### Reuse from Existing Design System
- Buttons, cards, badges, accordions from shadcn/ui
- Color palette from Brand.md
- Typography: Inter (headings), Inter (body)

### New Components Needed
1. `ChangelogCard` — date badge + product badges + title + summary
2. `ChangelogFilter` — pill buttons for product filtering
3. `DocSidebar` — collapsible navigation tree
4. `DocContent` — markdown renderer with anchor links
5. `WhitePaperCard` — cover + metadata + download CTA
6. `VideoCard` — thumbnail + duration + play button
7. `BlogCard` — cover + category + title + excerpt + meta
8. `HelpCategoryCard` — icon + title + article count
9. `SearchModal` — global search across all content

### Animations
- Tab switch: fade + slight translate-y (20px → 0), 200ms
- Changelog filter: cards fade out/in with stagger (50ms each)
- Search results: instant filter, no page reload
- Card hover: `-translate-y-1 shadow-lg`, 150ms ease-out

---

## RESPONSIVE BREAKPOINTS

| Breakpoint | Layout Changes |
|-----------|---------------|
| Mobile (< 640px) | Single column, hamburger sidebar, stacked cards |
| Tablet (640–1024px) | 2-column grids, collapsible sidebar |
| Desktop (> 1024px) | Full layout, sticky sidebar, 3-column grids |

---

## SEO REQUIREMENTS

- Page title: "Resources & Documentation — PracticePro"
- Meta description: "Documentation, guides, white papers, and product updates for PracticePro. Learn how to use Vega, Atrium, and Komplete."
- OG image: branded resource hub graphic
- Structured data: `FAQPage` for Help Center, `Article` for blog posts
- Sitemap: include all doc pages, blog posts, white papers

---

## PERFORMANCE REQUIREMENTS

- Lazy load video thumbnails (use `loading="lazy"`)
- Code-split each tab (dynamic imports)
- White paper PDFs: host on CDN, not in app bundle
- Search: debounce at 300ms, index built at build time
- Target: First Contentful Paint < 1.5s on desktop, < 2.5s on mobile

---

## CONTENT FILES PROVIDED BY AI

| File | Description |
|------|-------------|
| `PracticePro_Whats_New_Content.md` | 12 months of changelog entries, tagged by product |
| `PracticePro_White_Papers.md` | 4 fully written white papers (PDF-ready) |
| `PracticePro_Blog_Starter_Topics.md` | 16 blog post outlines with titles and angles |
| `PracticePro_Help_Center_Articles.md` | 47 help articles with full content |

---

## IMPLEMENTATION CHECKLIST

### Phase 1: Structure (Day 1)
- [ ] Create `/resources` route
- [ ] Build tab navigation with URL hash sync
- [ ] Build hero section with search bar
- [ ] Set up content data structures (JSON or Convex)

### Phase 2: What's New (Day 1-2)
- [ ] Build ChangelogCard component
- [ ] Build product filter (All/Vega/Atrium/Komplete) — **must actually filter content**
- [ ] Populate with changelog data from AI content file
- [ ] Build entry detail modal/drawer
- [ ] Test filtering: toggle Vega, only Vega entries show

### Phase 3: Documentation (Day 2-3)
- [ ] Build DocSidebar with collapsible sections
- [ ] Build DocContent renderer (Markdown → HTML)
- [ ] Create all doc pages (use AI-provided outlines, write content)
- [ ] Add anchor links and copy-code buttons
- [ ] Add "Was this helpful?" feedback

### Phase 4: White Papers (Day 3)
- [ ] Build WhitePaperCard component
- [ ] Style and format the 4 AI-written white papers as PDFs
- [ ] Add download flow (direct or gated)
- [ ] Add cover images (auto-generated gradients)

### Phase 5: Video Guides (Day 3-4)
- [ ] Build VideoCard component
- [ ] Build video modal with player
- [ ] Create video topic list (AI provided, you produce videos)
- [ ] Add product filter

### Phase 6: Blog (Day 4-5)
- [ ] Build BlogCard and BlogPost components
- [ ] Create blog index page
- [ ] Create individual blog post pages
- [ ] Add share buttons and author bios
- [ ] Write first 4 blog posts (use AI outlines)

### Phase 7: Help Center (Day 5)
- [ ] Build HelpCategoryCard component
- [ ] Build article list and article detail views
- [ ] Populate with AI-written help articles
- [ ] Add search functionality
- [ ] Add "Contact Support" CTAs

### Phase 8: Polish (Day 6)
- [ ] Global search across all tabs
- [ ] Responsive testing
- [ ] SEO meta tags and structured data
- [ ] Performance optimization (lazy loading, code splitting)
- [ ] Animation polish

---

*Master Spec v1.0 — PracticePro Resources Page*
*For AI App Builder Implementation*
*Last updated: August 2026*
