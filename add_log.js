const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/backend/src/controllers/message.ts');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
  'const { receiverId, ephemeralPublicKey, ephemeralMlKemCiphertext, encryptedContent, senderEncryptedContent, expiresIn } = req.body;',
  `const { receiverId, ephemeralPublicKey, ephemeralMlKemCiphertext, encryptedContent, senderEncryptedContent, expiresIn } = req.body;
  console.log('Sending message:', { senderId, receiverId, expiresIn });`
);

content = content.replace(
  `    const msg = await prisma.privateMessage.create({
      data: { senderId, receiverId, ephemeralPublicKey, ephemeralMlKemCiphertext, encryptedContent, senderEncryptedContent, expiresAt }
    });`,
  `    let msg;
    try {
      msg = await prisma.privateMessage.create({
        data: { senderId, receiverId, ephemeralPublicKey, ephemeralMlKemCiphertext, encryptedContent, senderEncryptedContent, expiresAt }
      });
    } catch (e) {
      console.error('Error creating message:', e);
      res.status(500).json({ error: 'DB_ERROR', details: e.message });
      return;
    }`
);

fs.writeFileSync(filePath, content);
