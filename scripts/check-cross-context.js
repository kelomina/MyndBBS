const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.ts')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('/workspace/packages/backend/src/application');
for (const file of files) {
  const content = fs.readFileSync(file, 'utf-8');
  const lines = content.split('\n');
  const contextMatch = file.match(/src\/application\/([^\/]+)\//);
  if (!contextMatch) continue;
  const currentContext = contextMatch[1];
  
  lines.forEach((line, idx) => {
    const importMatch = line.match(/import\s+.*from\s+['"]\.\.\/\.\.\/domain\/([^\/]+)\/.*['"]/);
    if (importMatch) {
      const importedContext = importMatch[1];
      if (importedContext !== currentContext && importedContext !== 'shared' && importedContext !== 'provisioning') {
        console.log(`${file}:${idx + 1}: ${line.trim()} (Context: ${currentContext}, Imported: ${importedContext})`);
      }
    }
  });
}
