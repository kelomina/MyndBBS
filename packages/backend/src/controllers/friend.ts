import { Response } from 'express';
import { messagingQueryService } from '../queries/messaging/MessagingQueryService';
import { AuthRequest } from '../middleware/auth';
import { MessagingApplicationService } from '../application/messaging/MessagingApplicationService';
import { PrismaFriendshipRepository } from '../infrastructure/repositories/PrismaFriendshipRepository';
import { PrismaPrivateMessageRepository } from '../infrastructure/repositories/PrismaPrivateMessageRepository';
import { PrismaUserKeyRepository } from '../infrastructure/repositories/PrismaUserKeyRepository';
import { PrismaConversationSettingRepository } from '../infrastructure/repositories/PrismaConversationSettingRepository';
import { PrismaUserRepository } from '../infrastructure/repositories/PrismaUserRepository';

const messagingApplicationService = new MessagingApplicationService(
  new PrismaFriendshipRepository(),
  new PrismaPrivateMessageRepository(),
  new PrismaUserKeyRepository(),
  new PrismaConversationSettingRepository(),
  new PrismaUserRepository()
);

/**
 * Callers: []
 * Callees: [json, status, findFirst, create, findUnique, stringify]
 * Description: Handles the request friend logic for the application.
 * Keywords: requestfriend, request, friend, auto-annotated
 */
export const requestFriend = async (req: AuthRequest, res: Response): Promise<void> => {
  const requesterId = req.user?.userId;
  const { addresseeId } = req.body;
  if (!requesterId || !addresseeId) { res.status(400).json({ error: 'ERR_BAD_REQUEST' }); return; }

  try {
    const friendship = await messagingApplicationService.sendFriendRequest(requesterId, addresseeId);
    res.json({ success: true, friendship });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

/**
 * Callers: []
 * Callees: [json, status, findUnique, update]
 * Description: Handles the respond friend logic for the application.
 * Keywords: respondfriend, respond, friend, auto-annotated
 */
export const respondFriend = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const { friendshipId, accept } = req.body;
  if (!userId || !friendshipId) { res.status(400).json({ error: 'ERR_BAD_REQUEST' }); return; }

  try {
    await messagingApplicationService.respondFriendRequest(friendshipId, userId, accept);
    res.json({ success: true });
  } catch (error: any) {
    res.status(error.message === 'ERR_NOT_FOUND' ? 404 : 400).json({ error: error.message });
  }
};

/**
 * Callers: []
 * Callees: [json, status, findMany]
 * Description: Handles the get friends logic for the application.
 * Keywords: getfriends, get, friends, auto-annotated
 */
export const getFriends = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) { res.status(401).json({ error: 'ERR_UNAUTHORIZED' }); return; }

  const friendships = await messagingQueryService.listFriends(userId);

  res.json({ friendships });
};
