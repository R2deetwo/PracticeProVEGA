import { httpRouter } from "convex/server";
import { handleChakraWebhook } from "./sentryWebhook";

const http = httpRouter();

// Webhook endpoint to receive replies from tenants via Chakra Chat
http.route({
  path: "/chakra/webhook",
  method: "POST",
  handler: handleChakraWebhook,
});

export default http;
