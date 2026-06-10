import { getDocument } from 'pdfjs-dist/build/pdf.min.mjs';
import fs from 'fs';

const pdfPath = "C:\\Users\\USER\\Desktop\\pp\\public\\1746367810.pdf";

async function run() {
    console.log("Loading PDF...");
    const data = new Uint8Array(fs.readFileSync(pdfPath));
    const loadingTask = getDocument({ data });
    const pdfDoc = await loadingTask.promise;

    console.log(`Loaded ${pdfDoc.numPages} pages.`);
    let allText = "";
    const pagesToRead = Math.min(20, pdfDoc.numPages);
    
    for (let i = 1; i <= pagesToRead; i++) {
        const page = await pdfDoc.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item) => item.str).join(" ");
        allText += `--- PAGE ${i} ---\n${pageText}\n\n`;
    }

    fs.writeFileSync("output_text.txt", allText);
    console.log("Written to output_text.txt");
}

run().catch(console.error);
