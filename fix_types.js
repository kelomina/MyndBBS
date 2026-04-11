const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/backend/src/controllers/message.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Cast req.params to string
content = content.replace(/const partnerId = req\.params\.partnerId;/g, 'const partnerId = req.params.partnerId as string;');
content = content.replace(/const messageId = req\.params\.id;/g, 'const messageId = req.params.id as string;');
content = content.replace(/const withUserId = req\.params\.withUserId;/g, 'const withUserId = req.params.withUserId as string;');

fs.writeFileSync(filePath, content);
console.log('Fixed message.ts types');
