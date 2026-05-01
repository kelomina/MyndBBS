import { Response } from 'express';
import { messagingQueryService } from '../queries/messaging/MessagingQueryService';
import { AuthRequest } from '../middleware/auth';
import { messagingApplicationService } from '../registry';

/**
 * 函数名称：uploadKeys
 *
 * 函数作用：
 *   上传当前用户的端到端加密密钥公钥和加密私钥。
 * Purpose:
 *   Uploads the current user's E2EE public key and encrypted private key.
 *
 * 调用方 / Called by:
 *   POST /api/v1/messages/keys
 *
 * 被调用方 / Calls:
 *   - messagingApplicationService.uploadKeysWithValidation
 *
 * 参数说明 / Parameters:
 *   - req.body.scheme: string, 密钥方案标识
 *   - req.body.publicKey: string, 公钥（必填）
 *   - req.body.encryptedPrivateKey: string, 加密私钥（必填）
 *   - req.body.mlKemPublicKey: string | undefined, ML-KEM 公钥
 *   - req.body.encryptedMlKemPrivateKey: string | undefined, 加密 ML-KEM 私钥
 *
 * 返回值说明 / Returns:
 *   { success: true } 或 { error: errorCode }
 *
 * 错误处理 / Error handling:
 *   - 401: ERR_UNAUTHORIZED（未认证）
 *   - 400: ERR_MISSING_KEYS（缺少必填密钥字段）
 *   - 404: ERR_USER_NOT_FOUND（用户不存在）
 *   - 403: 其他权限相关错误
 *
 * 副作用 / Side effects:
 *   写数据库——存储或更新用户密钥
 *
 * 中文关键词：
 *   消息，密钥上传，加密，公钥，E2EE
 * English keywords:
 *   message, key upload, encryption, public key, E2EE
 */
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

/**
 * 函数名称：getMyKey
 *
 * 函数作用：
 *   获取当前用户自己的密钥信息。
 * Purpose:
 *   Retrieves the current user's own key information.
 *
 * 调用方 / Called by:
 *   GET /api/v1/messages/keys/me
 *
 * 被调用方 / Calls:
 *   - messagingQueryService.getMyKey
 *
 * 参数说明 / Parameters:
 *   无请求体参数（从 req.user.userId 获取）
 *
 * 返回值说明 / Returns:
 *   { key: object | null } 用户密钥对象，未设置时返回 null
 *
 * 错误处理 / Error handling:
 *   401: ERR_UNAUTHORIZED（未认证）
 *
 * 副作用 / Side effects:
 *   无——只读查询
 *
 * 中文关键词：
 *   消息，密钥查询，当前用户，E2EE
 * English keywords:
 *   message, key query, current user, E2EE
 */
export const getMyKey = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) { res.status(401).json({ error: 'ERR_UNAUTHORIZED' }); return; }

  const key = await messagingQueryService.getMyKey(userId);
  res.json({ key });
};

/**
 * 函数名称：getUserPublicKey
 *
 * 函数作用：
 *   根据用户名获取指定用户的公钥和用户 ID。
 * Purpose:
 *   Retrieves a user's public key and user ID by username.
 *
 * 调用方 / Called by:
 *   GET /api/v1/messages/keys/:username
 *
 * 被调用方 / Calls:
 *   - messagingQueryService.getUserPublicKey
 *
 * 参数说明 / Parameters:
 *   - req.params.username: string, 目标用户名
 *
 * 返回值说明 / Returns:
 *   { publicKey: string, userId: string } 或 { error: errorCode }
 *
 * 错误处理 / Error handling:
 *   - 401: ERR_UNAUTHORIZED（未认证）
 *   - 404: ERR_USER_OR_KEY_NOT_FOUND（用户或密钥不存在）
 *
 * 副作用 / Side effects:
 *   无——只读查询
 *
 * 中文关键词：
 *   消息，公钥查询，用户名，E2EE
 * English keywords:
 *   message, public key query, username, E2EE
 */
export const getUserPublicKey = async (req: AuthRequest, res: Response): Promise<void> => {
  const username = req.params.username as string;
  const user = await messagingQueryService.getUserPublicKey(username);
  
  if (!user || !user.userKey) { res.status(404).json({ error: 'ERR_USER_OR_KEY_NOT_FOUND' }); return; }
  res.json({ publicKey: user.userKey.publicKey, userId: user.id });
};

/**
 * 函数名称：sendMessage
 *
 * 函数作用：
 *   发送加密的私信消息给指定用户。
 * Purpose:
 *   Sends an encrypted private message to a specified user.
 *
 * 调用方 / Called by:
 *   POST /api/v1/messages
 *
 * 被调用方 / Calls:
 *   - messagingApplicationService.sendMessageWithValidation
 *
 * 参数说明 / Parameters:
 *   - req.body.receiverId: string, 接收方用户 ID（必填）
 *   - req.body.encryptedContent: string, 加密消息内容（必填）
 *   - req.body.ephemeralPublicKey: string, 一次性公钥
 *   - req.body.senderEncryptedContent: string, 发送方侧的加密副本
 *   - req.body.isBurnAfterRead: boolean, 是否阅后即焚
 *
 * 返回值说明 / Returns:
 *   { success: true, messageId: string } 或 { error: errorCode }
 *
 * 错误处理 / Error handling:
 *   - 401: ERR_UNAUTHORIZED（未认证）
 *   - 404: ERR_USER_NOT_FOUND（接收方不存在）
 *   - 403: 其他业务错误（如不是好友）
 *
 * 副作用 / Side effects:
 *   写数据库——创建私信记录
 *
 * 中文关键词：
 *   消息，发送私信，加密，阅后即焚，E2EE
 * English keywords:
 *   message, send private message, encrypted, burn after reading, E2EE
 */
export const sendMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  const senderId = req.user?.userId;
  if (!senderId) { res.status(401).json({ error: 'ERR_UNAUTHORIZED' }); return; }

  const { receiverId, encryptedContent, ephemeralPublicKey, senderEncryptedContent, isBurnAfterRead } = req.body;

  try {
    const msgId = await messagingApplicationService.sendMessageWithValidation(
      senderId,
      receiverId,
      encryptedContent,
      ephemeralPublicKey,
      senderEncryptedContent,
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

/**
 * 函数名称：getConversationSettings
 *
 * 函数作用：
 *   获取当前用户与指定对话伙伴的会话设置。
 * Purpose:
 *   Retrieves conversation settings between the current user and a specified partner.
 *
 * 调用方 / Called by:
 *   GET /api/v1/messages/settings/:partnerId
 *
 * 被调用方 / Calls:
 *   - messagingQueryService.getConversationSettings
 *
 * 参数说明 / Parameters:
 *   - req.params.partnerId: string, 对话伙伴的用户 ID
 *
 * 返回值说明 / Returns:
 *   { setting: object } 会话设置对象
 *
 * 错误处理 / Error handling:
 *   400: ERR_BAD_REQUEST（缺少参数）
 *
 * 副作用 / Side effects:
 *   无——只读查询
 *
 * 中文关键词：
 *   消息，会话设置，对话伙伴，查询
 * English keywords:
 *   message, conversation settings, partner, query
 */
export const getConversationSettings = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const partnerId = req.params.partnerId as string;
  if (!userId || !partnerId) { res.status(400).json({ error: 'ERR_BAD_REQUEST' }); return; }

  const setting = await messagingQueryService.getConversationSettings(userId, partnerId);
    res.json(setting);
};

/**
 * 函数名称：updateConversationSettings
 *
 * 函数作用：
 *   更新当前用户与指定对话伙伴的会话设置。
 * Purpose:
 *   Updates conversation settings between the current user and a specified partner.
 *
 * 调用方 / Called by:
 *   PUT /api/v1/messages/settings/:partnerId
 *
 * 被调用方 / Calls:
 *   - messagingApplicationService.updateConversationSettings
 *
 * 参数说明 / Parameters:
 *   - req.params.partnerId: string, 对话伙伴的用户 ID
 *   - req.body.allowTwoSidedDelete: boolean, 是否允许双向删除
 *
 * 返回值说明 / Returns:
 *   { success: true } 或 { error: errorCode }
 *
 * 错误处理 / Error handling:
 *   - 400: ERR_BAD_REQUEST（缺少参数）
 *   - 500: ERR_FAILED_TO_UPDATE_SETTINGS
 *
 * 副作用 / Side effects:
 *   写数据库——更新会话设置
 *
 * 中文关键词：
 *   消息，会话设置更新，双向删除，对话伙伴
 * English keywords:
 *   message, update conversation settings, two-sided delete, partner
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
 * 函数名称：deleteMessage
 *
 * 函数作用：
 *   删除指定消息（软删除或硬删除，取决于会话设置）。
 * Purpose:
 *   Deletes a specified message (soft or hard delete depending on conversation settings).
 *
 * 调用方 / Called by:
 *   DELETE /api/v1/messages/:id
 *
 * 被调用方 / Calls:
 *   - messagingApplicationService.deleteMessage
 *
 * 参数说明 / Parameters:
 *   - req.params.id: string, 消息 ID
 *
 * 返回值说明 / Returns:
 *   { success: true } 或 { error: errorCode }
 *
 * 错误处理 / Error handling:
 *   - 401: ERR_UNAUTHORIZED（未认证）
 *   - 404: ERR_NOT_FOUND（消息不存在）
 *   - 403: 其他权限错误
 *
 * 副作用 / Side effects:
 *   写数据库——删除消息记录
 *
 * 中文关键词：
 *   消息，删除，软删除，硬删除
 * English keywords:
 *   message, delete, soft delete, hard delete
 */
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

/**
 * 函数名称：clearChat
 *
 * 函数作用：
 *   清空当前用户与指定用户之间的全部聊天记录。
 * Purpose:
 *   Clears all chat history between the current user and a specified user.
 *
 * 调用方 / Called by:
 *   DELETE /api/v1/messages/chat/:withUserId
 *
 * 被调用方 / Calls:
 *   - messagingApplicationService.clearChat
 *
 * 参数说明 / Parameters:
 *   - req.params.withUserId: string, 聊天对象用户 ID
 *
 * 返回值说明 / Returns:
 *   { success: true } 或 { error: errorCode }
 *
 * 错误处理 / Error handling:
 *   - 400: ERR_BAD_REQUEST（缺少参数）
 *   - 500: ERR_FAILED_TO_CLEAR_CHAT
 *
 * 副作用 / Side effects:
 *   写数据库——删除相关消息记录
 *
 * 中文关键词：
 *   消息，清空聊天，删除记录
 * English keywords:
 *   message, clear chat, delete history
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
 * 函数名称：getUnreadCount
 *
 * 函数作用：
 *   获取当前用户的未读消息数量。
 * Purpose:
 *   Retrieves the count of unread messages for the current user.
 *
 * 调用方 / Called by:
 *   GET /api/v1/messages/unread
 *
 * 被调用方 / Calls:
 *   - messagingQueryService.getUnreadCount
 *
 * 参数说明 / Parameters:
 *   无请求体参数（从 req.user.userId 获取）
 *
 * 返回值说明 / Returns:
 *   { count: number } 未读消息数量
 *
 * 错误处理 / Error handling:
 *   401: ERR_UNAUTHORIZED（未认证）
 *
 * 副作用 / Side effects:
 *   无——只读查询
 *
 * 中文关键词：
 *   消息，未读数量，查询
 * English keywords:
 *   message, unread count, query
 */
export const getUnreadCount = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) { res.status(401).json({ error: 'ERR_UNAUTHORIZED' }); return; }

  const count = await messagingQueryService.getUnreadCount(userId);
  res.json({ count });
};

/**
 * 函数名称：markAsRead
 *
 * 函数作用：
 *   将来自指定发送者的所有消息标记为已读。
 * Purpose:
 *   Marks all messages from a specified sender as read.
 *
 * 调用方 / Called by:
 *   PUT /api/v1/messages/read
 *
 * 被调用方 / Calls:
 *   - messagingApplicationService.markAsRead
 *
 * 参数说明 / Parameters:
 *   - req.body.senderId: string, 发送方用户 ID
 *
 * 返回值说明 / Returns:
 *   { success: true } 或 { error: errorCode }
 *
 * 错误处理 / Error handling:
 *   - 400: ERR_BAD_REQUEST（缺少参数）
 *   - 500: ERR_FAILED_TO_MARK_AS_READ
 *
 * 副作用 / Side effects:
 *   写数据库——更新消息为已读状态
 *
 * 中文关键词：
 *   消息，标记已读，发送方
 * English keywords:
 *   message, mark as read, sender
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
 * 函数名称：getInbox
 *
 * 函数作用：
 *   获取当前用户的收件箱消息列表，支持分页和按对话伙伴过滤。
 * Purpose:
 *   Retrieves the current user's inbox messages, with support for pagination and filtering by conversation partner.
 *
 * 调用方 / Called by:
 *   GET /api/v1/messages/inbox
 *
 * 被调用方 / Calls:
 *   - messagingQueryService.getMessages
 *
 * 参数说明 / Parameters:
 *   - req.query.withUserId: string | undefined, 过滤特定对话伙伴
 *   - req.query.limit: string | undefined, 每页条数（默认 20）
 *   - req.query.cursor: string | undefined, 分页游标
 *
 * 返回值说明 / Returns:
 *   { messages: array, nextCursor: string | null } 分页消息列表
 *
 * 错误处理 / Error handling:
 *   401: ERR_UNAUTHORIZED（未认证）
 *
 * 副作用 / Side effects:
 *   无——只读查询
 *
 * 中文关键词：
 *   消息，收件箱，分页，游标，对话伙伴
 * English keywords:
 *   message, inbox, pagination, cursor, partner
 */
export const getInbox = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) { res.status(401).json({ error: 'ERR_UNAUTHORIZED' }); return; }

  const withUserId = req.query.withUserId as string | undefined;
  
  const limit = parseInt(req.query.limit as string) || 20;
  const cursor = req.query.cursor as string | undefined;
  const result = await messagingQueryService.getMessages(userId, limit, cursor as string | undefined, withUserId as string | undefined);
  res.json(result);
};
