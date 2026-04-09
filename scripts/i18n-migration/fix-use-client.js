const fs = require('fs');
const path = require('path');

const filesToFix = [
  'packages/frontend/src/app/p/[id]/CommentItem.tsx',
  'packages/frontend/src/app/p/[id]/PostActions.tsx'
];

for (const relPath of filesToFix) {
  const fullPath = path.join(__dirname, relPath);
  if (!fs.existsSync(fullPath)) continue;
  
  let content = fs.readFileSync(fullPath, 'utf8');
  let lines = content.split('\n');
  let newLines = [];
  let hasUseClient = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.includes("'use client'") || line.includes('"use client"')) {
      hasUseClient = true;
      continue; // put it at the very top
    }

    newLines.push(line);
  }
  
  if (hasUseClient) {
    newLines.unshift("'use client';");
  }
  
  fs.writeFileSync(fullPath, newLines.join('\n'), 'utf8');
  console.log(`Fixed ${relPath}`);
}
