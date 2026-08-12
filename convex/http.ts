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

// ─── Agent Inspection API ────────────────────────────────────────────────────
// Secure endpoint for automated AI agents to audit the app's data layer.
// Gated by AGENT_INSPECT_SECRET env var — returns 403 without it.
http.route({
  path: "/api/agent/inspect",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    // CORS
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, x-agent-inspect-key",
        },
      });
    }

    // Auth check
    const secret = process.env.AGENT_INSPECT_SECRET;
    if (secret) {
      const providedKey = request.headers.get("x-agent-inspect-key");
      if (providedKey !== secret) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    const url = new URL(request.url);
    const queryType = url.searchParams.get("query_type") || "routes";
    const entity = url.searchParams.get("entity");

    let result: any = {};

    if (queryType === "routes") {
      // Return all known client-side routes
      result = {
        routes: [
          { path: "/", name: "Dashboard", auth: true },
          { path: "/?view=matters", name: "Matters", auth: true },
          { path: "/?view=properties", name: "Properties", auth: true },
          { path: "/?view=tasks", name: "Tasks", auth: true },
          { path: "/?view=calendar", name: "Calendar", auth: true },
          { path: "/?view=billing", name: "Billing", auth: true },
          { path: "/?view=documents", name: "Documents", auth: true },
          { path: "/?view=messaging", name: "Messaging", auth: true },
          { path: "/?view=notes", name: "Notes", auth: true },
          { path: "/?view=reporting", name: "Reporting", auth: true },
          { path: "/?view=settings", name: "Settings", auth: true },
          { path: "/?view=help", name: "Help", auth: true },
          { path: "/portal/tenant", name: "Resident Portal", auth: "portal" },
          { path: "/portal/tenant/login", name: "Resident Login", auth: false },
          { path: "/portal/client", name: "Client Portal", auth: "portal" },
          { path: "/portal/client/login", name: "Client Login", auth: false },
          { path: "/gatehouse", name: "Gatehouse", auth: false },
          { path: "/privacy-policy", name: "Privacy Policy", auth: false },
          { path: "/terms-of-service", name: "Terms of Service", auth: false },
        ],
        total: 18,
      };
    } else if (queryType === "schema_audit") {
      // Return schema info for a specific entity
      const schemas: Record<string, any> = {
        unit: {
          table: "properties",
          expectedFields: ["id", "firmId", "name", "address", "rentalDetails", "automationSettings", "images", "amenities"],
          notes: "Units are stored in the 'properties' table. Multi-unit buildings have an embedded 'units' array.",
        },
        tenant: {
          table: "users",
          expectedFields: ["_id", "email", "name", "role", "firmId", "tokenIdentifier"],
          notes: "Tenants are users with role='Tenant'. Their property/unit assignment is on the property record's rentalDetails.tenantEmail.",
        },
        task: {
          table: "tasks",
          expectedFields: ["id", "firmId", "title", "status", "priority", "assignedUsers", "dueDate"],
          notes: "Tasks can be linked to matters or properties via matterId/propertyId.",
        },
        matter: {
          table: "matters",
          expectedFields: ["id", "firmId", "title", "status", "stage", "clientId", "billingModel"],
          notes: "Legal matters (Vega only).",
        },
        property: {
          table: "properties",
          expectedFields: ["id", "firmId", "name", "address", "rentalDetails", "automationSettings"],
          notes: "Properties can be standalone or multi-unit buildings.",
        },
      };

      result = {
        entity: entity || "unknown",
        schema: schemas[entity || ""] || { error: `Unknown entity: ${entity}. Valid: ${Object.keys(schemas).join(", ")}` },
        validEntities: Object.keys(schemas),
      };
    } else if (queryType === "dead_ends") {
      // This would require DOM analysis — return guidance for the crawler
      result = {
        message: "Dead-end detection requires browser-side DOM analysis. Use the Playwright audit script (npm run audit:app) which checks for buttons without onClick handlers.",
        knownDeadEnds: [],
      };
    } else if (queryType === "data_health") {
      // Note: httpAction doesn't have ctx.db access for queries.
      // Data health checks are done via the Playwright crawler + Convex queries
      // in the founder app instead.
      result = {
        message: "Data health checks require Convex query context. Use the founder app's Analytics view or the Playwright crawler for data health auditing.",
        availableChecks: ["users_without_firm", "portal_users_with_firm", "orphaned_records"],
      };
    } else {
      result = { error: `Unknown query_type: ${queryType}. Valid: routes, schema_audit, dead_ends, data_health` };
    }

    return new Response(JSON.stringify(result, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }),
});
