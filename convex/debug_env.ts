
import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireFounderCaller } from "./callerAuth";

/**
 * V1-B (SEC-16): the old PUBLIC `debug_env:checkEnv` query — which reported
 * which secrets are configured on the production deployment (mailer keys,
 * Brevo, Chakra, FCM service-account shape) to ANY anonymous internet
 * caller, and which the production-deploy workflow even probed as its
 * liveness check — is REMOVED. Its diagnostics now live inside
 * `getEnvStatus`, a founder-only query derived from a verified session
 * (the Founder App's Settings → Environment panel). The workflow probe now
 * uses the public `myFunctions:ping` liveness query.
 *
 * (An internal-twin + ctx.runQuery wrapper was tried first: a public
 * function referencing a same-module internal function through the
 * generated api types creates a type circularity — TS7022 — that leaked
 * `any`/`{}` inference into unrelated modules. Inlined here instead.)
 */
export const getEnvStatus = query({
  args: { sessionToken: v.optional(v.string()), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireFounderCaller(ctx, { sessionToken: args.sessionToken, userEmail: args.userEmail });

    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    let fcmProjectId: string | null = null;
    let fcmValidShape = false;
    if (serviceAccount) {
      try {
        const parsed = JSON.parse(serviceAccount);
        fcmProjectId = parsed.project_id || null;
        fcmValidShape = !!(parsed.project_id && parsed.client_email && parsed.private_key);
      } catch {
        fcmValidShape = false;
      }
    }
    return {
      hasPracticeProMailer: !!process.env.PracticePro_Vega_Mailer,
      mailerPrefix: process.env.PracticePro_Vega_Mailer ? process.env.PracticePro_Vega_Mailer.substring(0, 5) : null,
      hasBrevoApiKey: !!process.env.BREVO_API_KEY,
      hasBrevoSenderEmail: !!process.env.BREVO_SENDER_EMAIL,
      hasChakraToken: !!process.env.CHAKRA_ACCESS_TOKEN,
      hasChakraPluginId: !!process.env.CHAKRA_PLUGIN_ID,
      hasChakraPhoneId: !!process.env.CHAKRA_PHONE_NUMBER_ID,
      // ─── Push notifications (Sept 2026 fix) ────────────────────────────
      // FCM_SERVER_KEY is intentionally NOT reported as usable: Google shut
      // down the legacy FCM API in June 2024 — only the service account works.
      hasFcmServiceAccount: fcmValidShape,
      fcmProjectId,
      hasLegacyFcmServerKey: !!process.env.FCM_SERVER_KEY,
    };
  },
});
