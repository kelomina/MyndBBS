import { Response } from 'express';
import { messagingQueryService } from '../queries/messaging/MessagingQueryService';
import { AuthRequest } from '../middleware/auth';
import { messagingApplicationService } from '../registry';


export const uploadKeys = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) { res.status(401).json({ error: 'ERR_UNAUTHORIZED' }); return; }

  const { scheme, publicKey, encryptedPrivateKey, mlKemPublicKey, encryptedMlKemPrivateKey } = req.body;
  if (!publicKey || !encryptedPrivateKey) { res.status(400).json({ error: 'ERR_MISSING_KEYS' }); return; }

  try {
    await messagingApplicationService.uploadKeysWithValidation(userId, scheme, publicKey, encryptedPrivateKey, mlKemPublicKey, encryptedMlKemPrivateKey);
    res.json({ success: true });
  } catch (error: any) {
    const errorCode = typeof error?.message === 'string' && error.message.startsWith('ERR_')
      ? error.message
      : 'ERR_INTERNAL_SERVER_ERROR';

    if (errorCode === 'ERR_USER_NOT_FOUND') {
      res.status(404).json({ error: errorCode });
      return;
    }
    res.status(403).json({ error: errorCode });
  }
};

export const getMyKey = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) { res.status(401).json({ error: 'ERR_UNAUTHORIZED' }); return; }

  const key = await messagingQueryService.getMyKey(userId);
  res.json({ key });
};

export const getUserPublicKey = async (req: AuthRequest, res: Response): Promise<void> => {
  const username = req.params.username as string;
  const user = await messagingQueryService.getUserPublicKey(username);
  
  if (!user || !user.userKey) { res.status(404).json({ error: 'ERR_USER_OR_KEY_NOT_FOUND' }); return; }
  res.json({ publicKey: user.userKey.publicKey, userId: user.id });
};

export const sendMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  const senderId = req.user?.userId;
  if (!senderId) { res.status(401).json({ error: 'ERR_UNAUTHORIZED' }); return; }

  const { receiverId, encryptedContent, isBurnAfterRead } = req.body;

  try {
    const msgId = await messagingApplicationService.sendMessageWithValidation(
      senderId,
      receiverId,
      encryptedContent,
      false, // isSystem
      !!isBurnAfterRead
    );
    res.json({ success: true, messageId: msgId });
  } catch (error: any) {
    const errorCode = typeof error?.message === 'string' && error.message.startsWith('ERR_')
      ? error.message
      : 'ERR_INTERNAL_SERVER_ERROR';

    if (errorCode === 'ERR_USER_NOT_FOUND') {
      res.status(404).json({ error: errorCode });
      return;
    }
    res.status(403).json({ error: errorCode });
  }
};


export const getConversationSettings = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const partnerId = req.params.partnerId as string;
  if (!userId || !partnerId) { res.status(400).json({ error: 'ERR_BAD_REQUEST' }); return; }

  const setting = await messagingQueryService.getConversationSettings(userId, partnerId);
    res.json(setting);
};

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

export const deleteMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const messageId = req.params.id as string;
  if (!userId) { res.status(401).json({ error: 'ERR_UNAUTHORIZED' }); return; }

  try {
    await messagingApplicationService.deleteMessage(messageId, userId);
    res.json({ success: true });
  } catch (error: any) {
    const errorCode = typeof error?.message === 'string' && error.message.startsWith('ERR_')
      ? error.message
      : 'ERR_INTERNAL_SERVER_ERROR';
    res.status(errorCode === 'ERR_NOT_FOUND' ? 404 : 403).json({ error: errorCode });
  }
};

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

export const getUnreadCount = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) { res.status(401).json({ error: 'ERR_UNAUTHORIZED' }); return; }

  const count = await messagingQueryService.getUnreadCount(userId);
  res.json({ count });
};

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


export const getInbox = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) { res.status(401).json({ error: 'ERR_UNAUTHORIZED' }); return; }

  const withUserId = req.query.withUserId as string | undefined;
  
  const limit = parseInt(req.query.limit as string) || 20;
  const cursor = req.query.cursor as string | undefined;
  const result = await messagingQueryService.getMessages(userId, limit, cursor as string | undefined, withUserId as string | undefined);
  res.json(result);
};
