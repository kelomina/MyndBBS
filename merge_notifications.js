const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/backend/src/lib/notification.ts');

const newContent = `import { prisma } from '../db';
import { NotificationType } from '@prisma/client';

interface SendNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  content: string;
  relatedId?: string;
}

export const sendNotification = async (params: SendNotificationParams) => {
  const systemUser = await prisma.user.findUnique({ where: { username: 'system' } });
  
  if (systemUser) {
    const payload = {
      title: params.title,
      content: params.content,
      relatedId: params.relatedId,
      type: params.type
    };

    return prisma.privateMessage.create({
      data: {
        senderId: systemUser.id,
        receiverId: params.userId,
        ephemeralPublicKey: 'system',
        encryptedContent: JSON.stringify(payload),
        isSystem: true
      }
    });
  }

  // Fallback if system user is not seeded
  return prisma.notification.create({
    data: params
  });
};
`;

fs.writeFileSync(filePath, newContent);
console.log('Merged notifications to private messages');
