import { prisma } from '../db';
import { NotificationType } from '@prisma/client';

interface SendNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  content: string;
  relatedId?: string;
}

let systemUserIdCache: string | null = null;

const getSystemUserId = async () => {
  if (systemUserIdCache) return systemUserIdCache;
  const sysUser = await prisma.user.findUnique({ where: { username: 'system' } });
  if (sysUser) {
    systemUserIdCache = sysUser.id;
    return sysUser.id;
  }
  throw new Error('System user not found');
};

export const sendNotification = async (params: SendNotificationParams) => {
  try {
    const systemUserId = await getSystemUserId();
    
    const payload = JSON.stringify({
      type: params.type,
      title: params.title,
      content: params.content,
      relatedId: params.relatedId
    });

    return await prisma.privateMessage.create({
      data: {
        senderId: systemUserId,
        receiverId: params.userId,
        ephemeralPublicKey: 'system',
        encryptedContent: payload,
        isSystem: true
      }
    });
  } catch (error) {
    console.error('Failed to send system message notification:', error);
  }
};