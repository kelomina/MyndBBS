const fs = require('fs');
const path = require('path');

const filesToFix = [
  'packages/frontend/src/app/admin/categories/page.tsx',
  'packages/frontend/src/app/admin/users/page.tsx',
  'packages/frontend/src/components/LanguageSwitcher.tsx',
  'packages/frontend/src/components/ProfileSettings.tsx',
  'packages/frontend/src/components/SecuritySettings.tsx',
  'packages/frontend/src/components/SessionManagement.tsx',
  'packages/frontend/src/components/ThemeToggle.tsx'
];

for (const relPath of filesToFix) {
  const fullPath = path.join(__dirname, relPath);
  if (!fs.existsSync(fullPath)) continue;
  
  let content = fs.readFileSync(fullPath, 'utf8');
  let lines = content.split('\n');
  let newLines = [];
  let seenUseTranslationImport = false;
  let seenDict = false;
  let hasUseClient = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.includes("'use client'") || line.includes('"use client"')) {
      hasUseClient = true;
      continue; // we will put it at the very top
    }
    
    if (line.includes('import { useTranslation } from')) {
      if (seenUseTranslationImport) continue;
      seenUseTranslationImport = true;
    }
    
    if (line.match(/^\s*const dict = useTranslation\(\);/)) {
      if (seenDict) continue;
      seenDict = true;
    }

    newLines.push(line);
  }
  
  if (hasUseClient) {
    newLines.unshift("'use client';");
  }
  
  fs.writeFileSync(fullPath, newLines.join('\n'), 'utf8');
  console.log(`Fixed ${relPath}`);
}
