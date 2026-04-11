const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/backend/src/controllers/message.ts');
let content = fs.readFileSync(filePath, 'utf8');

const target = `  const resultMessages = messages.filter((m: any) => !m.deletedBy.includes(userId)).reverse();`;
const replacement = `  const resultMessages = messages.filter((m: any) => !m.deletedBy?.includes(userId)).reverse();`;

content = content.replace(target, replacement);

fs.writeFileSync(filePath, content);
console.log('Added safe check for deletedBy');
