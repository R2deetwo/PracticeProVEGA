/**
 * Test the production Convex AI proxy (public action) — does the demo key
 * still serve generateContent without a client key?
 */
const { ConvexHttpClient } = require('convex/browser');

async function main() {
  const client = new ConvexHttpClient('https://gregarious-malamute-537.convex.cloud');
  try {
    const res = await client.action('ai:generateContent', {
      contents: [{ role: 'user', parts: [{ text: 'Reply with exactly: OK' }] }],
      modelName: 'gemini-2.5-flash',
    });
    const text = res?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
    console.log('PROXY OK — reply:', JSON.stringify(text.slice(0, 80)));
  } catch (e) {
    console.log('PROXY FAIL:', String(e.message || e).slice(0, 300));
  }
}
main();
