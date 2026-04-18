const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.resolve(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else { 
      if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        results.push(file);
      }
    }
  });
  return results;
}

const backendFiles = walk('/workspace/packages/backend/src');
const frontendFiles = walk('/workspace/packages/frontend/src');
const allFiles = [...backendFiles, ...frontendFiles];

let removedCount = 0;

allFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  // Match /** ... auto-annotated ... */ including optional following newline
  const regex = /\/\*\*[\s\S]*?auto-annotated[\s\S]*?\*\/\n?/g;
  if (regex.test(content)) {
    const newContent = content.replace(regex, '');
    fs.writeFileSync(file, newContent, 'utf8');
    removedCount++;
    console.log(`Removed from: ${file}`);
  }
});

console.log(`Removed comments from ${removedCount} files.`);
