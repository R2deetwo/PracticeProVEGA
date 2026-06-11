
import { query } from "./_generated/server";

export const checkEnv = query({
  handler: async (ctx) => {
    return {
      hasPracticeProMailer: !!process.env.PracticePro_Vega_Mailer,
      mailerPrefix: process.env.PracticePro_Vega_Mailer ? process.env.PracticePro_Vega_Mailer.substring(0, 5) : null,
      hasBrevoApiKey: !!process.env.BREVO_API_KEY,
      hasBrevoSenderEmail: !!process.env.BREVO_SENDER_EMAIL,
      hasChakraToken: !!process.env.CHAKRA_ACCESS_TOKEN,
      hasChakraPluginId: !!process.env.CHAKRA_PLUGIN_ID,
      hasChakraPhoneId: !!process.env.CHAKRA_PHONE_NUMBER_ID,
    };
  }
});
