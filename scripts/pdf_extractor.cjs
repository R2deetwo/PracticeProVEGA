const fs = require('fs');
const pdf = require('pdf-parse');

console.log(typeof pdf);

const dataBuffer = fs.readFileSync('C:\\Users\\USER\\Desktop\\pp\\public\\1746367810.pdf');

pdf(dataBuffer).then(function(data) {
    fs.writeFileSync('C:\\Users\\USER\\Desktop\\pp\\pdf_extracted.txt', data.text);
    console.log('PDF extracted successfully. Total pages:', data.numpages);
}).catch(err => {
    console.error('Error parsing PDF:', err);
});
