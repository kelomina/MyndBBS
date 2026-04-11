const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/frontend/next.config.ts');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
  "destination: 'http://localhost:3001/api/:path*',",
  "destination: 'http://localhost:3001/api/:path*',\n      },\n      {\n        source: '/uploads/:path*',\n        destination: 'http://localhost:3001/uploads/:path*',\n      },"
);

fs.writeFileSync(filePath, content);
console.log('Updated next.config.ts with uploads proxy');
