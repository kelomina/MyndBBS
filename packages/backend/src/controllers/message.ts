import { Response } from 'express';
import { prisma } from '../db';
import { AuthRequest } from '../middleware/auth';


export const uploadKeys = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) { res.status(401).json({ error: 'ERR_UNAUTHORIZED' }); return; }
  
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.level < 2) { res.status(403).json({ error: 'ERR_LEVEL_TOO_LOW' }); return; }

  const { scheme, publicKey, encryptedPrivateKey, mlKemPublicKey, encryptedMlKemPrivateKey } = req.body;
  if (!publicKey || !encryptedPrivateKey) { res.status(400).json({ error: 'ERR_MISSING_KEYS' }); return; }
  
  if (scheme === 'X_WING_HYBRID' && user.level < 4) {
    res.status(403).json({ error: 'ERR_LEVEL_TOO_LOW_FOR_X_WING' });
    return;
  }

  await prisma.userKey.upsert({
    where: { userId },
    update: { scheme, publicKey, encryptedPrivateKey, mlKemPublicKey, encryptedMlKemPrivateKey },
    create: { userId, scheme, publicKey, encryptedPrivateKey, mlKemPublicKey, encryptedMlKemPrivateKey }
  });

  res.json({ success: true });
};

export const getMyKey = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) { res.status(401).json({ error: 'ERR_UNAUTHORIZED' }); return; }

  const key = await prisma.userKey.findUnique({ where: { userId } });
  res.json({ key });
};

export const getUserPublicKey = async (req: AuthRequest, res: Response): Promise<void> => {
  const username = req.params.username as string;
  const user = await prisma.user.findUnique({ where: { username }, include: { userKey: true } });
  
  if (!user || !user.userKey) { res.status(404).json({ error: 'ERR_USER_OR_KEY_NOT_FOUND' }); return; }
  res.json({ publicKey: user.userKey.publicKey, userId: user.id });
};

export const sendMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  const senderId = req.user?.userId;
  if (!senderId) { res.status(401).json({ error: 'ERR_UNAUTHORIZED' }); return; }

  const { receiverId, ephemeralPublicKey, ephemeralMlKemCiphertext, encryptedContent, senderEncryptedContent, expiresIn } = req.body;
  let expiresAt: Date | null = null;
  if (expiresIn && typeof expiresIn === 'number') {
    expiresAt = new Date(Date.now() + expiresIn);
  }
  
  const sender = await prisma.user.findUnique({ where: { id: senderId } });
  if (!sender || sender.level < 2) { res.status(403).json({ error: 'ERR_LEVEL_TOO_LOW' }); return; }

  // Check if they are friends
  const isFriend = await prisma.friendship.findFirst({
    where: {
      status: 'ACCEPTED',
      OR: [
        { requesterId: senderId, addresseeId: receiverId },
        { requesterId: receiverId, addresseeId: senderId }
      ]
    }
  });

  if (!isFriend) {
    const sentCount = await prisma.privateMessage.count({
      where: { senderId, receiverId }
    });
    if (sentCount >= 3) {
      res.status(403).json({ error: 'ERR_FRIEND_REQUIRED_LIMIT_REACHED' });
      return;
    }
  }

  const msg = await prisma.privateMessage.create({
    data: { senderId, receiverId, ephemeralPublicKey, ephemeralMlKemCiphertext, encryptedContent, senderEncryptedContent, expiresAt }
  });

  res.json({ success: true, message: msg });
};


export const getConversationSettings = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const partnerId = req.params.partnerId as string;
  if (!userId || !partnerId) { res.status(400).json({ error: 'ERR_BAD_REQUEST' }); return; }

  const setting = await prisma.conversationSetting.findUnique({
    where: { userId_partnerId: { userId, partnerId } }
  });
  res.json({ allowTwoSidedDelete: setting?.allowTwoSidedDelete || false });
};

export const updateConversationSettings = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const partnerId = req.params.partnerId as string;
  const { allowTwoSidedDelete } = req.body;
  if (!userId || !partnerId) { res.status(400).json({ error: 'ERR_BAD_REQUEST' }); return; }

  await prisma.conversationSetting.upsert({
    where: { userId_partnerId: { userId, partnerId } },
    update: { allowTwoSidedDelete },
    create: { userId, partnerId, allowTwoSidedDelete }
  });
  res.json({ success: true });
};

export const deleteMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const messageId = req.params.id as string;
  if (!userId) { res.status(401).json({ error: 'ERR_UNAUTHORIZED' }); return; }

  const message = await prisma.privateMessage.findUnique({ where: { id: messageId } });
  if (!message) { res.status(404).json({ error: 'ERR_NOT_FOUND' }); return; }

  if (message.senderId !== userId && message.receiverId !== userId) {
    res.status(403).json({ error: 'ERR_FORBIDDEN' }); return;
  }

  const partnerId = message.senderId === userId ? message.receiverId : message.senderId;
  
  let canHardDelete = false;
  if (message.senderId === userId) {
    const partnerSetting = await prisma.conversationSetting.findUnique({
      where: { userId_partnerId: { userId: partnerId, partnerId: userId } }
    });
    canHardDelete = partnerSetting?.allowTwoSidedDelete || false;
  }

  if (canHardDelete) {
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
  }

  res.json({ success: true });
};

export const clearChat = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const withUserId = req.params.withUserId as string;
  if (!userId || !withUserId) { res.status(400).json({ error: 'ERR_BAD_REQUEST' }); return; }

  const partnerSetting = await prisma.conversationSetting.findUnique({
    where: { userId_partnerId: { userId: withUserId, partnerId: userId } }
  });
  const canHardDelete = partnerSetting?.allowTwoSidedDelete || false;

  const messages = await prisma.privateMessage.findMany({
    where: {
      OR: [
        { senderId: userId, receiverId: withUserId },
        { senderId: withUserId, receiverId: userId }
      ],
      NOT: { deletedBy: { has: userId } }
    },
    select: { id: true, senderId: true, receiverId: true, deletedBy: true }
  });

  for (const msg of messages) {
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
  }

  res.json({ success: true });
};

export const getUnreadCount = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) { res.status(401).json({ error: 'ERR_UNAUTHORIZED' }); return; }

  const count = await prisma.privateMessage.count({
    where: { receiverId: userId, isRead: false }
  });
  res.json({ count });
};

export const markAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const { senderId } = req.body;
  if (!userId || !senderId) { res.status(400).json({ error: 'ERR_BAD_REQUEST' }); return; }

  await prisma.privateMessage.updateMany({
    where: { receiverId: userId, senderId: senderId, isRead: false },
    data: { isRead: true }
  });
  res.json({ success: true });
};


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