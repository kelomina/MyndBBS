const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/backend/src/controllers/message.ts');
let content = fs.readFileSync(filePath, 'utf8');

const target = `  const msg = await prisma.privateMessage.create({
    data: { senderId, receiverId, ephemeralPublicKey, ephemeralMlKemCiphertext, encryptedContent, senderEncryptedContent, expiresAt }
  });`;

const replacement = `  const msg = await prisma.privateMessage.create({
    data: { senderId, receiverId, ephemeralPublicKey, ephemeralMlKemCiphertext, encryptedContent, senderEncryptedContent, expiresAt, deletedBy: [] }
  });`;

content = content.replace(target, replacement);

fs.writeFileSync(filePath, content);
console.log('Fixed message create to explicitly include deletedBy: []');
