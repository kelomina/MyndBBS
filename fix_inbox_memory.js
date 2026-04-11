const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/backend/src/controllers/message.ts');
let content = fs.readFileSync(filePath, 'utf8');

const target = `  const resultMessages = messages.reverse();

  res.json({
    messages: resultMessages,`;

const replacement = `  const resultMessages = messages.filter((m: any) => !m.deletedBy.includes(userId)).reverse();

  res.json({
    messages: resultMessages,`;

content = content.replace(target, replacement);

fs.writeFileSync(filePath, content);
console.log('Added in-memory filter for deletedBy');
