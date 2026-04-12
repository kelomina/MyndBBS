const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/frontend/src/proxy.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Update isPublicPath to explicitly allow '/' 
content = content.replace(
  "const isPublicPath = pathname === '/login' || pathname === '/register' || pathname === '/403' || pathname.startsWith('/_next') || pathname.startsWith('/api');",
  "const isPublicPath = pathname === '/' || pathname === '/login' || pathname === '/register' || pathname === '/403' || pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.startsWith('/uploads');"
);

fs.writeFileSync(filePath, content);
console.log('Fixed public path');
