/**
 * Web Fetcher — server-side Convex action that fetches and parses
 * the content of a URL for the AI to analyze.
 *
 * This bypasses the text-only limits of the chat by allowing the AI
 * to "read" external web pages (client websites, legal blogs, court
 * dockets, etc.) directly.
 *
 * The action:
 * 1. Fetches the URL server-side (avoids CORS issues)
 * 2. Extracts the main text content (strips nav, scripts, styles)
 * 3. Returns cleaned text + metadata (title, description)
 *
 * If the page is behind a paywall, CAPTCHA, or login, the action
 * returns a structured error so the UI can prompt the user to paste
 * the text manually.
 */
import { action } from "./_generated/server";
import { v } from "convex/values";

export const fetchUrlContent = action({
  args: {
    url: v.string(),
  },
  handler: async (_ctx, args) => {
    const { url } = args;

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      if (!parsedUrl.protocol.startsWith("http")) {
        return {
          success: false,
          error: "INVALID_URL",
          message: "Please provide a valid HTTP or HTTPS URL.",
        };
      }
    } catch {
      return {
        success: false,
        error: "INVALID_URL",
        message: "Could not parse the URL. Please check and try again.",
      };
    }

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; PracticePro/1.0; +https://practicepro.ng/bot)",
          Accept: "text/html,application/xhtml+xml,application/xml,text/plain",
          "Accept-Language": "en-US,en;q=0.9",
        },
        signal: AbortSignal.timeout(15000), // 15s timeout
        redirect: "follow",
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          return {
            success: false,
            error: "AUTH_REQUIRED",
            message:
              "This page requires authentication (login or paywall). Please paste the relevant text directly into the chat.",
          };
        }
        if (response.status === 404) {
          return {
            success: false,
            error: "NOT_FOUND",
            message: "The page was not found. Please check the URL.",
          };
        }
        return {
          success: false,
          error: "HTTP_ERROR",
          message: `The server returned an error (HTTP ${response.status}).`,
        };
      }

      const contentType = response.headers.get("content-type") || "";

      // If it's already plain text or JSON, return as-is
      if (contentType.includes("text/plain") || contentType.includes("application/json")) {
        const text = await response.text();
        return {
          success: true,
          title: parsedUrl.hostname,
          url: url,
          content: text.substring(0, 50000), // Cap at 50k chars
          contentType,
        };
      }

      // For HTML, extract the main text content
      if (contentType.includes("text/html") || contentType.includes("application/xhtml")) {
        const html = await response.text();

        // Extract title
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim() : parsedUrl.hostname;

        // Extract meta description
        const descMatch = html.match(
          /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i
        );
        const description = descMatch ? descMatch[1].trim() : "";

        // Extract main text content — strip scripts, styles, nav, etc.
        let text = html;

        // Remove script and style tags + content
        text = text.replace(/<script[\s\S]*?<\/script>/gi, "");
        text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
        text = text.replace(/<noscript[\s\S]*?<\/noscript>/gi, "");
        text = text.replace(/<iframe[\s\S]*?<\/iframe>/gi, "");
        text = text.replace(/<svg[\s\S]*?<\/svg>/gi, "");

        // Remove HTML comments
        text = text.replace(/<!--[\s\S]*?-->/g, "");

        // Remove nav, header, footer, aside tags (often boilerplate)
        text = text.replace(/<nav[\s\S]*?<\/nav>/gi, "");
        text = text.replace(/<aside[\s\S]*?<\/aside>/gi, "");

        // Convert remaining HTML to text
        // Replace block-level tags with newlines
        text = text.replace(/<(p|div|h[1-6]|li|tr|br|hr)[^>]*>/gi, "\n");
        text = text.replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n");

        // Remove all remaining tags
        text = text.replace(/<[^>]+>/g, "");

        // Decode HTML entities
        text = text
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&nbsp;/g, " ")
          .replace(/&hellip;/g, "…")
          .replace(/&mdash;/g, "—")
          .replace(/&ndash;/g, "–")
          .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num)))
          .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
            String.fromCharCode(parseInt(hex, 16))
          );

        // Clean up whitespace
        text = text
          .replace(/\r\n/g, "\n")
          .replace(/\r/g, "\n")
          .replace(/[ \t]+/g, " ")
          .replace(/\n{3,}/g, "\n\n")
          .trim();

        // Cap at 50k characters (roughly 10k tokens)
        if (text.length > 50000) {
          text = text.substring(0, 50000) + "\n\n[Content truncated — page was too long]";
        }

        return {
          success: true,
          title,
          description,
          url: url,
          content: text,
          contentType,
        };
      }

      // Unsupported content type
      return {
        success: false,
        error: "UNSUPPORTED_CONTENT",
        message: `Cannot parse ${contentType} content. Please paste the text directly.`,
      };
    } catch (err: any) {
      if (err.name === "TimeoutError" || err.name === "AbortError") {
        return {
          success: false,
          error: "TIMEOUT",
          message: "The page took too long to load. Please try again or paste the text directly.",
        };
      }
      return {
        success: false,
        error: "FETCH_ERROR",
        message: `Could not fetch the URL: ${err.message || "Unknown error"}`,
      };
    }
  },
});
