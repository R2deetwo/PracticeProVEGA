
import { query } from "./_generated/server";

export const checkEnv = query({
  handler: async (ctx) => {
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
