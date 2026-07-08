/**
 * Vercel Edge Middleware — Dynamic Open Graph metadata per route
 *
 * Rewritten to use standard Web APIs only (no @vercel/edge import).
 * Vercel's Edge Runtime supports Request/Response natively.
 *
 * PROBLEM:
 *   The app is a Vite SPA, so all routes serve the same index.html with
 *   static OG meta tags. When a user shares a link to /portal/tenant/login
 *   (Atrium resident portal) or /portal/client/login (Vega client portal)
 *   via WhatsApp/Telegram/iMessage, the link preview shows the generic
 *   "PracticePro" metadata — not product-specific info.
 *
 * SOLUTION:
 *   This Edge Middleware intercepts every request and checks the User-Agent.
 *   For social media crawlers, it returns a custom HTML response with
 *   dynamic OG meta tags based on the URL path.
 *   For regular browser requests, it passes through to the SPA.
 */

// Social media crawler User-Agent patterns.
const CRAWLER_PATTERN = new RegExp(
  [
    'whatsapp', 'facebookexternalhit', 'Twitterbot', 'Slackbot',
    'LinkedInBot', 'Discordbot', 'telegrambot', 'ia_archiver',
    'googlebot', 'bingbot', 'skypeuripreviewer', 'snapchat',
    'pinterestbot', 'vkshare', 'w3c_validator', 'linkedin',
    'slack-signature', 'iframely', 'embedly', 'heedily', 'plinion',
    'quora-link-preview', 'redditbot', 'slack-token', 'tumblr',
    'vkImageProxy', 'YahooLinkPreview', 'Yahoo:Slurp',
  ].join('|'),
  'i'
);

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};

interface OGMetadata {
  title: string;
  description: string;
  siteName: string;
  themeColor: string;
}

function getOGForPath(pathname: string): OGMetadata {
  if (pathname.startsWith('/portal/tenant')) {
    return {
      title: 'Atrium Residents Portal — PracticePro',
      description: 'Access your Atrium Residents Portal by PracticePro. View notices, ledger, receipts, maintenance requests, and message your property manager — all in one secure place.',
      siteName: 'PracticePro Atrium',
      themeColor: '#16A34A',
    };
  }
  if (pathname.startsWith('/portal/client')) {
    return {
      title: 'Vega Client Portal — PracticePro',
      description: 'Access your Vega Client Portal by PracticePro. View case updates, share documents, and message your legal team — all in one secure place.',
      siteName: 'PracticePro Vega',
      themeColor: '#0D8ABC',
    };
  }
  return {
    title: 'PracticePro — Operating Systems for Modern Organizations',
    description: 'PracticePro builds dedicated operating systems for the organizations that run modern Africa. Atrium for property managers. Vega for Nigerian law firms. One platform, two specialized products.',
    siteName: 'PracticePro',
    themeColor: '#16A34A',
  };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function generateOGHtml(og: OGMetadata, requestUrl: string): string {
  const t = escapeHtml(og.title);
  const d = escapeHtml(og.description);
  const sn = escapeHtml(og.siteName);
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${t}</title><meta name="description" content="${d}"><meta name="theme-color" content="${og.themeColor}"><meta property="og:type" content="website"><meta property="og:title" content="${t}"><meta property="og:description" content="${d}"><meta property="og:site_name" content="${sn}"><meta property="og:url" content="${requestUrl}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${t}"><meta name="twitter:description" content="${d}"></head><body><noscript><p>${t}</p><p>${d}</p><p><a href="${requestUrl}">Continue to ${sn} →</a></p></noscript><script>window.location.replace(${JSON.stringify(requestUrl)});</script></body></html>`;
}

export default function middleware(req: Request): Response {
  const userAgent = req.headers.get('user-agent') || '';
  if (!CRAWLER_PATTERN.test(userAgent)) {
    // Pass through to SPA — return undefined to let Vercel continue normally
    return new Response(null, { status: 200 });
  }
  const url = new URL(req.url);
  const og = getOGForPath(url.pathname);
  const html = generateOGHtml(og, req.url);
  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      'X-Robots-Tag': 'index, follow',
    },
  });
}
