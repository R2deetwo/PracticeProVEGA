/**
 * Vercel Edge Middleware — Dynamic Open Graph metadata per route
 *
 * PROBLEM:
 *   The app is a Vite SPA, so all routes serve the same index.html with
 *   static OG meta tags. When a user shares a link to /portal/tenant/login
 *   (Atrium resident portal) or /portal/client/login (Vega client portal)
 *   via WhatsApp/Telegram/iMessage, the link preview shows the generic
 *   "PracticePro" metadata — not product-specific info.
 *
 *   The user explicitly requested:
 *     - Main link → PracticePro (the parent company)
 *     - /portal/tenant/* → Atrium (residents' portal)
 *     - /portal/client/* → Vega (client portal)
 *
 * SOLUTION:
 *   This Edge Middleware intercepts every request and checks the User-Agent.
 *   For social media crawlers (WhatsApp, Telegram, Facebook, Twitter, Slack,
 *   Discord, LinkedIn, iMessage, Skype, Snapchat, Pinterest, etc.), it
 *   returns a custom HTML response with dynamic OG meta tags based on the
 *   URL path.
 *
 *   For regular browser requests, it passes through to the SPA (index.html)
 *   with zero added latency — the middleware returns NextResponse.next().
 *
 * HOW IT WORKS:
 *   - Social media crawlers don't execute JavaScript — they only read the
 *     static HTML returned by the server.
 *   - By returning custom HTML for crawlers, the link preview shows the
 *     right metadata for each route.
 *   - The custom HTML includes a redirect to the actual SPA URL, so if a
 *     real user somehow ends up on the crawler response (rare), they get
 *     redirected to the SPA.
 *
 * PERFORMANCE:
 *   - Edge Middleware runs at the edge (close to the user)
 *   - For non-crawler requests, the overhead is ~1ms (just a User-Agent
 *     header check)
 *   - For crawler requests, the response is a small HTML payload (~2KB)
 */

import { NextResponse } from '@vercel/edge';

// Social media crawler User-Agent patterns.
// These are the bots that scrape OG meta tags for link previews.
const CRAWLER_PATTERN = new RegExp(
  [
    'whatsapp',                    // WhatsApp link previews
    'facebookexternalhit',         // Facebook / Messenger
    'Twitterbot',                  // X / Twitter
    'Slackbot',                    // Slack link unfurling
    'LinkedInBot',                 // LinkedIn
    'Discordbot',                  // Discord
    'telegrambot',                 // Telegram
    'ia_archiver',                 // Alexa / Amazon
    'googlebot',                   // Google search
    'bingbot',                     // Bing search
    'skypeuripreviewer',           // Skype
    'snapchat',                    // Snapchat
    'pinterestbot',                // Pinterest
    'vkshare',                     // VK
    'w3c_validator',               // W3C
    'linkedin',                    // LinkedIn (alternate)
    'slack-signature',             // Slack (alternate)
    'iframely',                    // Iframely embeds
    'embedly',                     // Embedly embeds
    'heedily',                     // Heedily
    'plinion',                     // Plinion
    'quora-link-preview',          // Quora
    'redditbot',                   // Reddit
    'slack-token',                 // Slack token validation
    'tumblr',                      // Tumblr
    'vkImageProxy',                // VK image proxy
    ' YahooLinkPreview',           // Yahoo
    'Yahoo:Slurp',                 // Yahoo search
  ].join('|'),
  'i'
);

// Matcher: run middleware on all routes EXCEPT static assets and API routes.
// This prevents unnecessary overhead on static file requests.
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public static assets (files with extensions like .css, .js, .png, etc.)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
};

interface OGMetadata {
  title: string;
  description: string;
  siteName: string;
  themeColor: string;
}

/**
 * Returns the appropriate OG metadata for a given URL path.
 *
 * Routing rules:
 *   /portal/tenant/* → Atrium (residents' portal) — green theme
 *   /portal/client/* → Vega (client portal) — blue theme
 *   / (root) and everything else → PracticePro (parent company)
 */
function getOGForPath(pathname: string): OGMetadata {
  // Atrium — Residents' Portal
  if (pathname.startsWith('/portal/tenant')) {
    return {
      title: 'Atrium Residents Portal — PracticePro',
      description: 'Access your Atrium Residents Portal by PracticePro. View notices, ledger, receipts, maintenance requests, and message your property manager — all in one secure place.',
      siteName: 'PracticePro Atrium',
      themeColor: '#16A34A', // emerald-600
    };
  }

  // Vega — Client Portal
  if (pathname.startsWith('/portal/client')) {
    return {
      title: 'Vega Client Portal — PracticePro',
      description: 'Access your Vega Client Portal by PracticePro. View case updates, share documents, and message your legal team — all in one secure place.',
      siteName: 'PracticePro Vega',
      themeColor: '#0D8ABC', // vega blue
    };
  }

  // Default — PracticePro parent company
  return {
    title: 'PracticePro — Operating Systems for Modern Organizations',
    description: 'PracticePro builds dedicated operating systems for the organizations that run modern Africa. Atrium for property managers. Vega for Nigerian law firms. One platform, two specialized products.',
    siteName: 'PracticePro',
    themeColor: '#16A34A',
  };
}

/**
 * Generates a minimal HTML document with the appropriate OG meta tags.
 *
 * The HTML includes:
 *   - All standard OG (Open Graph) tags
 *   - Twitter Card tags
 *   - A canonical URL
 *   - A redirect to the actual SPA URL (in case a real user lands here)
 *
 * The HTML is intentionally minimal (~2KB) so crawlers can fetch it quickly.
 */
function generateOGHtml(og: OGMetadata, requestUrl: string): string {
  const escapedTitle = og.title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const escapedDesc = og.description.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const escapedSite = og.siteName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapedTitle}</title>
  <meta name="description" content="${escapedDesc}">
  <meta name="theme-color" content="${og.themeColor}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapedTitle}">
  <meta property="og:description" content="${escapedDesc}">
  <meta property="og:site_name" content="${escapedSite}">
  <meta property="og:url" content="${requestUrl}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapedTitle}">
  <meta name="twitter:description" content="${escapedDesc}">
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='14 8 36 28'%3E%3Cpath d='M14 34C14 35.1046 14.8954 36 16 36H48C49.1046 36 50 35.1046 50 34V10C50 8.89543 49.1046 8 48 8H16C14.8954 8 14 8.89543 14 10V34Z' fill='%2316A34A'/%3E%3Cpath d='M20 12V34H26V26H38C42 26 44 23 44 18C44 13 42 10 38 10H20Z' fill='white'/%3E%3Cpath d='M26 16H38C39.5 16 40 17.5 40 18C40 18.5 39.5 20 38 20H26V16Z' fill='%2316A34A'/%3E%3C/svg%3E" type="image/svg+xml">
</head>
<body>
  <noscript>
    <p>${escapedTitle}</p>
    <p>${escapedDesc}</p>
    <p><a href="${requestUrl}">Continue to ${escapedSite} →</a></p>
  </noscript>
  <script>window.location.replace(${JSON.stringify(requestUrl)});</script>
</body>
</html>`;
}

export default function middleware(req: Request): Response {
  const userAgent = req.headers.get('user-agent') || '';

  // Pass through non-crawler requests with zero overhead
  if (!CRAWLER_PATTERN.test(userAgent)) {
    return NextResponse.next();
  }

  const url = new URL(req.url);
  const og = getOGForPath(url.pathname);
  const html = generateOGHtml(og, req.url);

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      // Allow crawlers to index this content
      'X-Robots-Tag': 'index, follow',
    },
  });
}
