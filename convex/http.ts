import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { handleChakraWebhook } from "./sentryWebhook";

const http = httpRouter();

// Webhook endpoint to receive replies from tenants via Chakra Chat
http.route({
  path: "/chakra/webhook",
  method: "POST",
  handler: handleChakraWebhook,
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
    const fallbackDemoKey = 'AIzaSyDd5ib2A1562gO2PY1FQElSVzwyIaeBAN8';
    const envKey = process.env.GEMINI_API_KEY || process.env.GEMINI_DEMO_KEY;
    
    // Priority: Request Key -> Environment Key -> Demo Key
    const apiKey = providedApiKey || envKey || fallbackDemoKey;

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
