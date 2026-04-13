import { Response } from 'express';
import { prisma } from '../db';
import { AuthRequest } from '../middleware/auth';
import { MessagingApplicationService } from '../application/messaging/MessagingApplicationService';
import { PrismaFriendshipRepository } from '../infrastructure/repositories/PrismaFriendshipRepository';
import { PrismaPrivateMessageRepository } from '../infrastructure/repositories/PrismaPrivateMessageRepository';

import { PrismaUserKeyRepository } from '../infrastructure/repositories/PrismaUserKeyRepository';
import { PrismaConversationSettingRepository } from '../infrastructure/repositories/PrismaConversationSettingRepository';

const messagingApplicationService = new MessagingApplicationService(
  new PrismaFriendshipRepository(),
  new PrismaPrivateMessageRepository(),
  new PrismaUserKeyRepository(),
  new PrismaConversationSettingRepository()
);


/**
 * Callers: []
 * Callees: [json, status, findUnique, upsert]
 * Description: Handles the upload keys logic for the application.
 * Keywords: uploadkeys, upload, keys, auto-annotated
 */
export const uploadKeys = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) { res.status(401).json({ error: 'ERR_UNAUTHORIZED' }); return; }

  const { scheme, publicKey, encryptedPrivateKey, mlKemPublicKey, encryptedMlKemPrivateKey } = req.body;
  if (!publicKey || !encryptedPrivateKey) { res.status(400).json({ error: 'ERR_MISSING_KEYS' }); return; }

  try {
    await messagingApplicationService.uploadKeys(userId, scheme, publicKey, encryptedPrivateKey, mlKemPublicKey, encryptedMlKemPrivateKey);
    res.json({ success: true });
  } catch (error: any) {
    res.status(403).json({ error: error.message });
  }
};

/**
 * Callers: []
 * Callees: [json, status, findUnique]
 * Description: Handles the get my key logic for the application.
 * Keywords: getmykey, get, my, key, auto-annotated
 */
export const getMyKey = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) { res.status(401).json({ error: 'ERR_UNAUTHORIZED' }); return; }

  const key = await prisma.userKey.findUnique({ where: { userId } });
  res.json({ key });
};

/**
 * Callers: []
 * Callees: [findUnique, json, status]
 * Description: Handles the get user public key logic for the application.
 * Keywords: getuserpublickey, get, user, public, key, auto-annotated
 */
export const getUserPublicKey = async (req: AuthRequest, res: Response): Promise<void> => {
  const username = req.params.username as string;
  const user = await prisma.user.findUnique({ where: { username }, include: { userKey: true } });
  
  if (!user || !user.userKey) { res.status(404).json({ error: 'ERR_USER_OR_KEY_NOT_FOUND' }); return; }
  res.json({ publicKey: user.userKey.publicKey, userId: user.id });
};

/**
 * Callers: []
 * Callees: [json, status, log, now, findUnique, findFirst, count, create]
 * Description: Handles the send message logic for the application.
 * Keywords: sendmessage, send, message, auto-annotated
 */
export const sendMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  const senderId = req.user?.userId;
  if (!senderId) { res.status(401).json({ error: 'ERR_UNAUTHORIZED' }); return; }

  const { receiverId, ephemeralPublicKey, ephemeralMlKemCiphertext, encryptedContent, senderEncryptedContent, expiresIn } = req.body;

  try {
    const msg = await messagingApplicationService.sendMessage(
      senderId,
      receiverId,
      ephemeralPublicKey,
      ephemeralMlKemCiphertext,
      encryptedContent,
      senderEncryptedContent,
      expiresIn
    );
    res.json({ success: true, message: msg });
  } catch (error: any) {
    res.status(403).json({ error: error.message });
  }
};


/**
 * Callers: []
 * Callees: [json, status, findUnique]
 * Description: Handles the get conversation settings logic for the application.
 * Keywords: getconversationsettings, get, conversation, settings, auto-annotated
 */
export const getConversationSettings = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const partnerId = req.params.partnerId as string;
  if (!userId || !partnerId) { res.status(400).json({ error: 'ERR_BAD_REQUEST' }); return; }

  const setting = await prisma.conversationSetting.findUnique({
    where: { userId_partnerId: { userId, partnerId } }
  });
  res.json({ allowTwoSidedDelete: setting?.allowTwoSidedDelete || false });
};

/**
 * Callers: []
 * Callees: [json, status, upsert]
 * Description: Handles the update conversation settings logic for the application.
 * Keywords: updateconversationsettings, update, conversation, settings, auto-annotated
 */
export const updateConversationSettings = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const partnerId = req.params.partnerId as string;
  const { allowTwoSidedDelete } = req.body;
  if (!userId || !partnerId) { res.status(400).json({ error: 'ERR_BAD_REQUEST' }); return; }

  try {
    await messagingApplicationService.updateConversationSettings(userId, partnerId, allowTwoSidedDelete);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'ERR_FAILED_TO_UPDATE_SETTINGS' });
  }
};

/**
 * Callers: []
 * Callees: [json, status, findUnique, delete, includes, update]
 * Description: Handles the delete message logic for the application.
 * Keywords: deletemessage, delete, message, auto-annotated
 */
export const deleteMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const messageId = req.params.id as string;
  if (!userId) { res.status(401).json({ error: 'ERR_UNAUTHORIZED' }); return; }

  try {
    await messagingApplicationService.deleteMessage(messageId, userId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(error.message === 'ERR_NOT_FOUND' ? 404 : 403).json({ error: error.message });
  }
};

/**
 * Callers: []
 * Callees: [json, status, findUnique, findMany, delete, includes, update]
 * Description: Handles the clear chat logic for the application.
 * Keywords: clearchat, clear, chat, auto-annotated
 */
export const clearChat = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const withUserId = req.params.withUserId as string;
  if (!userId || !withUserId) { res.status(400).json({ error: 'ERR_BAD_REQUEST' }); return; }

  try {
    await messagingApplicationService.clearChat(userId, withUserId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'ERR_FAILED_TO_CLEAR_CHAT' });
  }
};

/**
 * Callers: []
 * Callees: [json, status, count]
 * Description: Handles the get unread count logic for the application.
 * Keywords: getunreadcount, get, unread, count, auto-annotated
 */
export const getUnreadCount = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) { res.status(401).json({ error: 'ERR_UNAUTHORIZED' }); return; }

  const count = await prisma.privateMessage.count({
    where: { receiverId: userId, isRead: false }
  });
  res.json({ count });
};

/**
 * Callers: []
 * Callees: [json, status, updateMany]
 * Description: Handles the mark as read logic for the application.
 * Keywords: markasread, mark, as, read, auto-annotated
 */
export const markAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const { senderId } = req.body;
  if (!userId || !senderId) { res.status(400).json({ error: 'ERR_BAD_REQUEST' }); return; }

  try {
    await messagingApplicationService.markAsRead(userId, senderId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'ERR_FAILED_TO_MARK_AS_READ' });
  }
};


/**
 * Callers: []
 * Callees: [json, status, parseInt, String, findMany, pop, reverse]
 * Description: Handles the get inbox logic for the application.
 * Keywords: getinbox, get, inbox, auto-annotated
 */
export const getInbox = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) { res.status(401).json({ error: 'ERR_UNAUTHORIZED' }); return; }

  const withUserId = req.query.withUserId as string | undefined;
  
  const limit = parseInt(req.query.limit as string) || 20;
  const cursor = req.query.cursor as string | undefined;
  const notExpiredCondition = {
    OR: [ { expiresAt: null }, { expiresAt: { gt: new Date() } } ]
  };

  let whereClause: any = {
    AND: [
      { OR: [ { senderId: userId }, { receiverId: userId } ] },
      notExpiredCondition,
      { NOT: { deletedBy: { has: userId } } }
    ]
  };

  if (withUserId) {
    whereClause = {
      AND: [
        {
          OR: [
            { senderId: userId, receiverId: String(withUserId) },
            { senderId: String(withUserId), receiverId: userId }
          ]
        },
        notExpiredCondition,
        { NOT: { deletedBy: { has: userId } } }
      ]
    };
  }

  const messages = await prisma.privateMessage.findMany({
    where: whereClause,
    take: limit + 1,
    ...(cursor && {
      skip: 1,
      cursor: { id: cursor },
    }),
    orderBy: [
      { createdAt: 'desc' },
      { id: 'desc' }
    ],
    include: { sender: { select: { username: true } }, receiver: { select: { username: true } } }
  });

  let nextCursor: string | undefined = undefined;
  if (messages.length > limit) {
    const nextItem = messages.pop();
    nextCursor = nextItem?.id;
  }

  const resultMessages = messages.reverse();

  res.json({ 
    messages: resultMessages,
    nextCursor,
    hasMore: nextCursor !== undefined
  });
};