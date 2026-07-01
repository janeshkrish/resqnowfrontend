const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // Fix Blue -> Red (safely replacing the color name in tailwind classes)
      // e.g. text-blue-600 -> text-red-600
      let newContent = content.replace(/\b(text|bg|border|from|to|via|fill|stroke|shadow)-blue-(\d{2,3})\b/g, '$1-red-$2');
      
      // Fix specific EnterpriseDesktopHome bg-slate-900 uses for the desktop components
      const desktopSpecificFiles = [
        'EnterpriseDesktopHome.tsx',
        'Header.tsx',
        'About.tsx',
        'WhyResQNow.tsx',
        'CitiesPage.tsx',
        'ServicesPage.tsx',
        'Contact.tsx'
      ];
      
      if (desktopSpecificFiles.some(f => fullPath.endsWith(f))) {
          newContent = newContent.replace(/\bbg-slate-900\b/g, 'bg-gradient-to-r from-slate-900 to-red-950');
          newContent = newContent.replace(/\bhover:bg-slate-800\b/g, 'hover:from-slate-800 hover:to-red-900');
      }

      if (content !== newContent) {
        fs.writeFileSync(fullPath, newContent);
      }
    }
  }
}

processDir('d:/resqnow-production-code/resqnowfrontend/src/pages');
processDir('d:/resqnow-production-code/resqnowfrontend/src/components');
