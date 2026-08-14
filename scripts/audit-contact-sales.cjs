// Quick audit: Check ContactSalesDrawer CSS rendering on the live site
const https = require('https');

const URL = 'https://practice-pro-vega.vercel.app/';

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

(async () => {
  const html = await fetch(URL);
  
  // Check if ContactSalesDrawer is in the bundle
  const hasContactSales = html.includes('Contact Sales') || html.includes('contactSales') || html.includes('ContactSales');
  console.log('Contact Sales text in HTML:', hasContactSales);
  
  // Check for z-index conflicts
  const zIndices = html.match(/z-\[(\d+)\]/g) || [];
  console.log('Z-indices found in HTML:', [...new Set(zIndices)].sort());
  
  // Check for fixed positioning context issues
  const hasTransform = html.includes('transform') || html.includes('translate');
  console.log('Has transform/translate CSS:', hasTransform);
  
  // Check if the drawer is rendered server-side or client-side
  const hasDrawerDiv = html.includes('ContactSalesDrawer') || html.includes('contact-sales');
  console.log('Has drawer div in SSR HTML:', hasDrawerDiv);
  
  // Check the CSS classes on the backdrop
  const backdropMatch = html.match(/fixed inset-0[^"]*flex[^"]*items-center/);
  console.log('Backdrop flex centering in HTML:', backdropMatch ? 'YES' : 'NO (likely client-rendered)');
  
  console.log('\n--- DIAGNOSIS ---');
  console.log('The ContactSalesDrawer is client-rendered (React), so the HTML');
  console.log('wont show it until JS runs. The CSS uses:');
  console.log('  Backdrop: fixed inset-0 z-[9500] flex items-center justify-center');
  console.log('  Panel: relative z-[9600]');
  console.log('');
  console.log('Potential issues:');
  console.log('1. If a parent element has transform/filter/perspective,');
  console.log('   "fixed" positioning is relative to that parent, not viewport.');
  console.log('2. The landing page might have a wrapper with transform.');
  console.log('3. The backdrop might not be portaled to document.body.');
})();
