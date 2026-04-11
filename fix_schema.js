const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/backend/prisma/schema.prisma');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace('deletedBy                String[]', 'deletedBy                String[] @default([])');

fs.writeFileSync(filePath, content);
console.log('Added @default([]) to deletedBy in schema');
