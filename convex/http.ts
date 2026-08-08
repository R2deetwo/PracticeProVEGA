import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { handleChakraWebhook } from "./sentryWebhook";
import { handlePaystackWebhook } from "./paystack";

const http = httpRouter();

// Webhook endpoint to receive replies from tenants via Chakra Chat
http.route({
  path: "/chakra/webhook",
  method: "POST",
  handler: handleChakraWebhook,
});

// Paystack webhook — receives payment confirmation events.
// DORMANT until PAYSTACK_ENABLED=true AND PAYSTACK_SECRET_KEY are set.
// When active, this is the ONLY path that sets invoice status to 'Paid'
// for Paystack transactions (not the client-side auto-flip).
http.route({
  path: "/paystack/webhook",
  method: "POST",
  handler: handlePaystackWebhook,
});

http.route({
  path: "/ai/stream",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }
    const { model, contents, systemInstruction, apiKey: providedApiKey } = await request.json();
    // CRO AUDIT FIX (Track D — D5): removed hard-coded fallback Gemini API key.
    // Hard-coding API keys in source is a security issue — anyone with repo
    // access can extract and abuse the key. Now requires either:
    //   1. The client to pass `apiKey` in the request body (per-user key), OR
    //   2. The GEMINI_API_KEY / GEMINI_DEMO_KEY env var to be set in Convex.
    // If neither is present, returns a clear 503 error instead of silently
    // using a compromised demo key.
    const envKey = process.env.GEMINI_API_KEY || process.env.GEMINI_DEMO_KEY;

    // Priority: Request Key -> Environment Key
    const apiKey = providedApiKey || envKey;

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: "GEMINI_API_KEY not configured. Set it in Convex env or pass apiKey in the request body.",
        }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

    const body: any = { contents };
    if (systemInstruction) body.systemInstruction = { parts: [{ text: systemInstruction }] };

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
        return new Response(`AI Stream Error: ${response.statusText}`, { 
          status: response.status,
          headers: { "Access-Control-Allow-Origin": "*" }
        });
    }

    return new Response(response.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
      }
    });
  }),
});

export default http;
