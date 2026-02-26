const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

const replacements = [
    // Backgrounds
    { regex: /\bbg-white\b/g, replacement: 'bg-card dark:bg-slate-900' },
    { regex: /\bbg-slate-50\b/g, replacement: 'bg-muted' },
    { regex: /\bbg-slate-100\b/g, replacement: 'bg-muted/50' },
    { regex: /\bbg-slate-200\b/g, replacement: 'bg-border' },
    { regex: /\bbg-gray-50\b/g, replacement: 'bg-muted' },
    { regex: /\bbg-gray-100\b/g, replacement: 'bg-muted/50' },
    { regex: /\bbg-gray-200\b/g, replacement: 'bg-border' },

    // Text Colors
    { regex: /\btext-slate-900\b/g, replacement: 'text-foreground' },
    { regex: /\btext-slate-800\b/g, replacement: 'text-foreground' },
    { regex: /\btext-slate-700\b/g, replacement: 'text-muted-foreground' },
    { regex: /\btext-slate-600\b/g, replacement: 'text-muted-foreground' },
    { regex: /\btext-slate-500\b/g, replacement: 'text-muted-foreground\/80' },

    { regex: /\btext-gray-900\b/g, replacement: 'text-foreground' },
    { regex: /\btext-gray-800\b/g, replacement: 'text-foreground' },
    { regex: /\btext-gray-700\b/g, replacement: 'text-muted-foreground' },
    { regex: /\btext-gray-600\b/g, replacement: 'text-muted-foreground' },
    { regex: /\btext-gray-500\b/g, replacement: 'text-muted-foreground\/80' },
    { regex: /\btext-gray-400\b/g, replacement: 'text-muted-foreground\/60' },

    // Borders
    { regex: /\bborder-slate-100\b/g, replacement: 'border-border' },
    { regex: /\bborder-slate-200\b/g, replacement: 'border-border' },
    { regex: /\bborder-gray-100\b/g, replacement: 'border-border' },
    { regex: /\bborder-gray-200\b/g, replacement: 'border-border' }
];

function processDirectory(dir) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            processDirectory(filePath);
        } else if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
            let content = fs.readFileSync(filePath, 'utf8');
            let originalContent = content;

            for (const { regex, replacement } of replacements) {
                content = content.replace(regex, replacement);
            }

            if (content !== originalContent) {
                fs.writeFileSync(filePath, content, 'utf8');
                console.log(`Updated: ${filePath.replace(__dirname, '')}`);
            }
        }
    }
}

console.log('Starting dark mode class migration...');
processDirectory(srcDir);
console.log('Migration complete!');
