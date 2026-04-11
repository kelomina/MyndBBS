const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/backend/src/controllers/message.ts');
let content = fs.readFileSync(filePath, 'utf8');

const target = `  if (canHardDelete) {
    await prisma.privateMessage.delete({ where: { id: messageId } });
  } else {
    if (!message.deletedBy.includes(userId)) {
      const newDeletedBy = [...message.deletedBy, userId];
      if (newDeletedBy.includes(message.senderId) && newDeletedBy.includes(message.receiverId)) {
        await prisma.privateMessage.delete({ where: { id: messageId } });
      } else {
        await prisma.privateMessage.update({
          where: { id: messageId },
          data: { deletedBy: { push: userId } }
        });
      }
    }
  }`;

const replacement = `  if (canHardDelete) {
    await prisma.privateMessage.delete({ where: { id: messageId } });
  } else {
    if (!message.deletedBy?.includes(userId)) {
      const newDeletedBy = [...(message.deletedBy || []), userId];
      if (newDeletedBy.includes(message.senderId) && newDeletedBy.includes(message.receiverId)) {
        await prisma.privateMessage.delete({ where: { id: messageId } });
      } else {
        await prisma.privateMessage.update({
          where: { id: messageId },
          data: { deletedBy: { push: userId } }
        });
      }
    }
  }`;

content = content.replace(target, replacement);

const target2 = `    for (const msg of messages) {
      if (canHardDelete && msg.senderId === userId) {
        await prisma.privateMessage.delete({ where: { id: msg.id } });
      } else {
        const newDeletedBy = [...msg.deletedBy, userId];
        if (newDeletedBy.includes(msg.senderId) && newDeletedBy.includes(msg.receiverId)) {
          await prisma.privateMessage.delete({ where: { id: msg.id } });
        } else {
          await prisma.privateMessage.update({
            where: { id: msg.id },
            data: { deletedBy: { push: userId } }
          });
        }
      }
    }`;

const replacement2 = `    for (const msg of messages) {
      if (canHardDelete && msg.senderId === userId) {
        await prisma.privateMessage.delete({ where: { id: msg.id } });
      } else {
        const newDeletedBy = [...(msg.deletedBy || []), userId];
        if (newDeletedBy.includes(msg.senderId) && newDeletedBy.includes(msg.receiverId)) {
          await prisma.privateMessage.delete({ where: { id: msg.id } });
        } else {
          await prisma.privateMessage.update({
            where: { id: msg.id },
            data: { deletedBy: { push: userId } }
          });
        }
      }
    }`;

content = content.replace(target2, replacement2);

fs.writeFileSync(filePath, content);
console.log('Fixed message deletion backend logic to handle missing deletedBy array gracefully');
