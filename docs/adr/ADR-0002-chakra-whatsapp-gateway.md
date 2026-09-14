# ADR-0002: ChakraHQ as the WhatsApp gateway (with Brevo for email, Paystack for payments)

**Status:** Accepted (2026-08 messaging build; reaffirmed 2026-09 template fixes)
**Date:** retroactively recorded 2026-09-14

## Context

PracticePro sends resident/client notifications over three channels: email, WhatsApp, and push. For the Nigerian market WhatsApp is the channel that actually gets read. Requirements: Meta-approved template sends (rent reminders, notices, visitor passes), per-firm template mappings, delivery-truth (a "200 OK" from a gateway is not proof of delivery), plan-gated quotas, and an upgrade path when the gateway bills per message. Email needs a cheap transactional API; payments need local NGN rails with webhooks.

## Decision

- **WhatsApp: ChakraHQ ("Chakra")** — a WhatsApp API pass-through gateway on top of the Meta Cloud API. All sends flow through `convex/communications.ts` (`sendWhatsAppInternal` / `sendWhatsApp`), which enforces template mapping per firm, strict success verification (a send is successful **only** when Meta's `messages[0].id` comes back), error classification (e.g. 402 = Chakra plan gate → in-app upgrade banner), and gateway-health bookkeeping.
- **Email: Brevo** via the `PracticePro_Vega_Mailer` env var, with the shared branded footer + unsubscribe token flow (`convex/emailBranding.ts`).
- **Payments: Paystack** with webhook-driven state (`convex/paystack.ts`), refunds observed (never auto-applied) via `refund.processed`.

## Consequences

- Chakra is a third-party dependency for the most-used channel — outages there surface as classified `sendFailed` error events (P6 logging) rather than silent drops.
- Template governance is two-layered (Meta approval + per-firm mapping), which is exactly what the 2026-09 template-failure investigation required; sends now log the raw gateway round-trip for diagnosis.
- Strict "no Meta message id = failure" contract prevents the historical false-"sent" bug class (messages marked delivered when nothing went out).
- Swapping the gateway later means re-implementing one module (`communications.ts` WhatsApp section) behind the same result contract.

## Alternatives considered

- **Direct Meta Cloud API per firm**: requires every firm to bring and manage its own Meta business verification — a non-starter for small Nigerian firms.
- **Twilio WhatsApp**: stronger API, but materially more expensive per message at this volume and weaker local presence.
