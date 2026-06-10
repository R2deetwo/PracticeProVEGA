
import { query } from "./_generated/server";

export const checkEnv = query({
  handler: async (ctx) => {
    return {
      hasMailer: !!process.env.PracticePro_Vega_Mailer,
      mailerPrefix: process.env.PracticePro_Vega_Mailer ? process.env.PracticePro_Vega_Mailer.substring(0, 5) : null
    };
  }
});
