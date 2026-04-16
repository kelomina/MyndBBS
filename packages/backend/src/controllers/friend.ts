import { Response } from 'express';
import { messagingQueryService } from '../queries/messaging/MessagingQueryService';
import { identityQueryService } from '../queries/identity/IdentityQueryService';
import { AuthRequest } from '../middleware/auth';
import { messagingApplicationService } from '../registry';

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

  const requester = await identityQueryService.getProfile(requesterId);
  if (!requester) { res.status(404).json({ error: 'ERR_USER_NOT_FOUND' }); return; }

  const systemUser = await identityQueryService.getUserByUsername('system');

  try {
    await messagingApplicationService.sendFriendRequest(
      requesterId,
      requester.username,
      addresseeId,
      systemUser?.id || ''
    );
    res.json({ success: true });
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
