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

  const { receiverId, ephemeralPublicKey, ephemeralMlKemCiphertext, encryptedContent, senderEncryptedContent } = req.body;
  
  const sender = await prisma.user.findUnique({ where: { id: senderId } });
  if (!sender || sender.level < 2) { res.status(403).json({ error: 'ERR_LEVEL_TOO_LOW' }); return; }

  const msg = await prisma.privateMessage.create({
    data: { senderId, receiverId, ephemeralPublicKey, ephemeralMlKemCiphertext, encryptedContent, senderEncryptedContent }
  });

  res.json({ success: true, message: msg });
};

export const getInbox = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) { res.status(401).json({ error: 'ERR_UNAUTHORIZED' }); return; }

  const withUserId = req.query.withUserId as string | undefined;
  
  const limit = parseInt(req.query.limit as string) || 20;
  const cursor = req.query.cursor as string | undefined;

  let whereClause: any = {
    OR: [ { senderId: userId }, { receiverId: userId } ]
  };

  if (withUserId) {
    whereClause = {
      OR: [
        { senderId: userId, receiverId: String(withUserId) },
        { senderId: String(withUserId), receiverId: userId }
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