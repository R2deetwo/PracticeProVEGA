# Two Distinct Apps — UI Separation Strategy (R27)

Owner direction (2026-10-16): *"lets start here [the auth modals] then come
up with ensuring that we can carry the ui changes to the app so that we have
two distinct apps. i really like the way it looks at the moment so let us
ensure we dont touch it until we have a clean and clear way for having
proper and separate uis for the apps."*

This is that clean and clear way. **Nothing in the app shell changes until
Stage 4 is approved.** The app's current look is the baseline every step
below is measured against.

---

## 1. Where we already are (proof the pattern works)

| Surface | Status |
|---|---|
| Marketing sites (/vega, /atrium, hub) | Fully separated since P0 — `src/sites/{vega,atrium,hub}`, zero shared marketing sections |
| Product marks & favicons | Per-product since R26/R27 (the Seal; the Coin of the Arch) |
| Per-product page chrome | `useProductBranding` swaps favicons/spa meta per page |
| **Auth modals (login/signup)** | **Separated THIS round (R27)** — `authTheme.tsx` resolves the product from the modal context and themes the modal chrome + CTAs. The hub/native/portal login stays pixel-identical. This is the template every later stage copies. |
| Portal login pages | Already separate routes (`/portal/*/login`) with per-product styling |

## 2. The architecture — one codebase, variant table, no forks

**Never** fork components per product (`VegaSidebar` + `AtriumSidebar` is
the trap: they drift, double the bug surface and double the ratchet). The
strategy is a **variant table** at every layer:

1. **Token layer** (exists): `.theme-vega` / `.theme-atrium` CSS scopes +
   the Tailwind `vega.*` / `atrium.*` palettes. The app shell gets the same
   scopes from a `ProductUIScope` context (product already known from the
   firm/user record — `product === 'legal'` → vega, `'property'` → atrium,
   `'unified'` → hub-neutral).
2. **Primitive layer**: shared components keep their current classes as the
   DEFAULT (this is the "don't touch it" guarantee). A skin adds only
   overrides that win by Tailwind order (see Button.tsx's documented
   lexicographic rule) or via CSS scope specificity — never by editing the
   default in place.
3. **Resolver layer** (the pattern shipped in R27): one
   `resolve<Thing>Theme(context)` → theme object with `chrome: null` for
   the hub/default. **`chrome: null` means the shipped surface is used
   untouched** — that is the mechanism that protects the current app look
   while a product skin exists alongside it.

## 3. Rollout stages (each gated, each independently revertable)

- **Stage 1 — DONE (R27).** Auth modals + signup chooser identity
  (authTheme). Zero app-shell changes.
- **Stage 2 — Portals.** Portal login/dashboard headers adopt the same
  resolver. Small, contained, user-facing surfaces only.
- **Stage 3 — In-app accents (flagged).** A `PRACTICEPRO_PRODUCT_SKINS`
  feature flag (firm-level setting, default OFF) allows *tint-level* change
  inside the app: nav rail tint, active-tab color, FAB color — drawn from
  the existing token palettes. With the flag off, the app is byte-identical
  to today. No layout changes, no typography changes, no component swaps.
- **Stage 4 — Full product skins (owner sign-off required).** Real per-app
  look-and-feel for Vega and Atrium shells (spacing rhythm, type accents,
  motion). **This stage starts with a design prototype on STAGING, reviewed
  by the owner, before any production app code changes.** The current app
  look remains the default until the owner says ship.

## 4. Guardrails

1. **The baseline is frozen.** Every stage's diff must show the default
   (flag off / hub) path is untouched — enforced by the existing token gate,
   the ADR-0004 ratchet, and a new pin in `websiteRepositioning.test.ts` per
   surface that adopts the pattern (the R27 auth pins:
   `resolveAuthThemeId` maps unknown context → hub).
2. **One resolver per surface family** (auth, portals, nav, editor) — no
   per-component theme lookups scattered through the tree.
3. **Komplete/unified is always hub-neutral** in the app shell — the same
   rule the auth resolver already follows.
4. **Never resolve from the URL inside the app.** The app's product comes
   from the user/firm record; the URL only decides marketing pages.
5. **Visual changes ship behind review, not by default.** Stage 3+ requires
   the staging prototype + owner sign-off recorded in this file before the
   promote is dispatched.

## 5. What NOT to do (the failure modes this strategy exists to prevent)

- No `VegaX`/`AtriumX` component forks (see §2).
- No editing of current app component classes in place to "make them
  themeable" — overrides come from outside (variants/scopes), so the
  default always remains intact.
- No product theming of business logic (permissions, billing, deadlines) —
  skin is presentation only, per ADR-0004's spirit.
- No stage skipping: the app shell (Stage 3/4) does not move until the
  owner has seen the staging prototype and said yes.
