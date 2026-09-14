# Security Policy

## Supported surfaces

| Surface | Location | Supported |
|---------|----------|-----------|
| Production web app | `https://practice-pro-vega.vercel.app` (+ Cloudflare Worker alias) | ✅ latest |
| Main Android APK | `com.practicepro.app` — GitHub Releases (sideloaded, in-app updater) | ✅ latest version only |
| Founder Android APK | `com.practicepro.admin` — GitHub Releases | ✅ latest version only |
| Convex backend | Production deployment (`gregarious-malamute-537`) | ✅ latest |

Older APK versions do not receive patches — the in-app updater prompts users to the current build.

## Reporting a vulnerability

**Email: `dpo@practicepro.ng`** (the Data Protection contact — security reports are handled by the same channel).

Please include:

1. The affected surface (web / main APK / founder APK / backend) and where you found it.
2. Step-by-step reproduction or a proof of concept.
3. Impact: what data or function an attacker could reach.

We aim to acknowledge reports within **72 hours** and will keep reporters updated on remediation progress. Please avoid public disclosure until a fix is shipped. Reports that follow coordinated disclosure are credited in the changelog on request.

## Scope

**In scope:**

- The production web application and the Android APKs listed above.
- The Convex backend: public mutations/queries/actions (identity spoofing, broken tenant/firm isolation, privilege escalation to founder, unsafe file storage access).
- HTTP routes (`convex/http.ts`): webhook signature verification, the unsubscribe token flow, portal endpoints.
- Authentication and session handling: login codes, password reset links, bearer tokens, session fixation/revocation, founder account recovery.
- Push-notification plumbing: token registration ownership, FCM payload handling.
- Payment flows: Paystack webhook processing, reference validation, proof verification.
- Sensitive data exposure: privilege work product, tenant financials, visitor logs (NDPA 2023 personal data).

**Out of scope:**

- Vulnerabilities in outdated builds no longer served by the updater.
- Self-inflicted issues on a developer's own deployment (e.g. committed debug keystores are known and deliberate — see `.gitignore` notes on `debug.keystore`).
- Social engineering, phishing, or physical attacks against users.
- Volume/rate abuse of the WhatsApp/email gateways within provider limits.
- Best-effort informational findings with no realistic impact (missing cookies on static assets, etc.).
- Reports from automated scanners without a demonstrated impact.

## Disclosure timeline

1. Report received and acknowledged (≤ 72 h).
2. Triage + severity assessment; fix developed on main behind the CI quality gate.
3. Fix deployed (web is continuous; APK fixes ship with the next build, typically within days).
4. Reporter notified; public note in `CHANGELOG.md` if user-visible.

## Known security properties (for reviewers)

- All Convex public functions resolve caller identity server-side (`resolveCaller` / `requireFounderCaller`) — client-supplied identity fields are not trusted (see `scripts/audit-identity.py`, enforced in CI).
- Debug keystores are intentionally committed: the distribution channel is sideloaded debug-signed APKs with a stable signature; a release keystore path exists for Play Store submission if ever pursued, and `release.keystore` is gitignored.
- Backend secrets (Paystack, Brevo, Chakra, Gemini, FCM service account) live only as Convex environment variables.
- Error events recorded by the backend (`error_events`) are founder-only readable.
