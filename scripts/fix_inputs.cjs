const fs = require('fs');
const path = require('path');

function processDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDir(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            if (fullPath.includes('Login.tsx') || fullPath.includes('LockScreen.tsx')) {
                continue;
            }
            let content = fs.readFileSync(fullPath, 'utf8');
            let modified = false;

            // Simple regex to find <input ... > and ensure it doesn't already have autoComplete="off"
            // We'll replace <input with <input autoComplete="off" data-lpignore="true" 
            const regex = /<input(?=\s|>)(?![\s\S]*?autoComplete=)/g;
            if (regex.test(content)) {
                content = content.replace(regex, '<input autoComplete="off" data-lpignore="true" ');
                modified = true;
            }

            // Also handle <Input from the toolkit
            const regexInput = /<Input(?=\s|>)(?![\s\S]*?autoComplete=)/g;
            if (regexInput.test(content)) {
                content = content.replace(regexInput, '<Input autoComplete="off" data-lpignore="true" ');
                modified = true;
            }

            if (modified) {
                fs.writeFileSync(fullPath, content);
                console.log('Modified', fullPath);
            }
        }
    }
}

processDir(path.join(__dirname, 'src', 'components'));
console.log('Done');
