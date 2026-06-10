const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const fp = path.join(dir, file);
        const stat = fs.statSync(fp);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(fp));
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
            results.push(fp);
        }
    });
    return results;
}

const files = walk('c:/Users/USER/Desktop/pp/src');
let changedCount = 0;
files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let mod = content.split('.toLocaleDateString()').join(".toLocaleDateString('en-GB')");
    mod = mod.split(".toLocaleDateString('default'").join(".toLocaleDateString('en-GB'");
    if (content !== mod) {
        fs.writeFileSync(file, mod, 'utf8');
        console.log('Fixed', file);
        changedCount++;
    }
});
console.log('Fixed dates in', changedCount, 'files');
