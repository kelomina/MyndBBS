const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/frontend/src/app/messages/[username]/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const target = `                        className={\`absolute top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-background/80 text-destructive opacity-0 group-hover:opacity-100 transition-opacity \${
                          isMine ? '-left-10' : '-right-10'
                        }\`}`;

const replacement = `                        className={\`absolute top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-muted text-muted-foreground hover:bg-destructive hover:text-destructive-foreground shadow-sm opacity-0 group-hover:opacity-100 transition-all duration-200 \${
                          isMine ? '-left-10' : '-right-10'
                        }\`}`;

content = content.replace(target, replacement);
fs.writeFileSync(filePath, content);
console.log('Fixed trash icon contrast');
