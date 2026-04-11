const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/frontend/src/app/messages/[username]/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
  'className="text-xs bg-transparent border-none text-muted-foreground focus:ring-0 cursor-pointer outline-none"',
  'className="text-xs bg-background border border-border rounded text-muted-foreground focus:ring-1 focus:ring-primary cursor-pointer outline-none px-2 py-1"'
);

fs.writeFileSync(filePath, content);
console.log('Fixed select styling');
