const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/backend/src/controllers/message.ts');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add my imports
content = content.replace(
  "import { AuthRequest } from '../middleware/auth';",
  "import { AuthRequest } from '../middleware/auth';\n"
);

// 2. Update sendMessage
content = content.replace(
  "const { receiverId, ephemeralPublicKey, ephemeralMlKemCiphertext, encryptedContent, senderEncryptedContent } = req.body;",
  "const { receiverId, ephemeralPublicKey, ephemeralMlKemCiphertext, encryptedContent, senderEncryptedContent, expiresIn } = req.body;\n  let expiresAt: Date | null = null;\n  if (expiresIn && typeof expiresIn === 'number') {\n    expiresAt = new Date(Date.now() + expiresIn);\n  }"
);
content = content.replace(
  "data: { senderId, receiverId, ephemeralPublicKey, ephemeralMlKemCiphertext, encryptedContent, senderEncryptedContent }",
  "data: { senderId, receiverId, ephemeralPublicKey, ephemeralMlKemCiphertext, encryptedContent, senderEncryptedContent, expiresAt }"
);

// 3. Add my new functions
const newFunctions = `
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

`;
content = content.replace(
  "export const getInbox",
  newFunctions + "\nexport const getInbox"
);

// 4. Update getInbox to filter deletedBy and expiresAt
const notExpiredCond = `
  const notExpiredCondition = {
    OR: [ { expiresAt: null }, { expiresAt: { gt: new Date() } } ]
  };`;

content = content.replace(
  "const cursor = req.query.cursor as string | undefined;",
  "const cursor = req.query.cursor as string | undefined;" + notExpiredCond
);

content = content.replace(
  /let whereClause: any = \{\n    OR: \[ \{ senderId: userId \}, \{ receiverId: userId \} \]\n  \};/,
  `let whereClause: any = {
    AND: [
      { OR: [ { senderId: userId }, { receiverId: userId } ] },
      notExpiredCondition,
      { NOT: { deletedBy: { has: userId } } }
    ]
  };`
);

content = content.replace(
  /    whereClause = \{\n      OR: \[\n        \{ senderId: userId, receiverId: String\(withUserId\) \},\n        \{ senderId: String\(withUserId\), receiverId: userId \}\n      \]\n    \};/,
  `    whereClause = {
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
    };`
);

fs.writeFileSync(filePath, content);
console.log('Fixed message.ts');
