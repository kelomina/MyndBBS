import { Response } from 'express';
import { messagingQueryService } from '../queries/messaging/MessagingQueryService';
import { AuthRequest } from '../middleware/auth';
import { messagingApplicationService } from '../registry';

/**
 * Callers: [Router]
 * Callees: [messagingApplicationService]
 * Description: Handles sending a friend request from the authenticated user to another user.
 * Keywords: friend, request
 */
export const requestFriend = async (req: AuthRequest, res: Response): Promise<void> => {
  const requesterId = req.user?.userId;
  const { addresseeId } = req.body;
  if (!requesterId || !addresseeId) { res.status(400).json({ error: 'ERR_BAD_REQUEST' }); return; }

  try {
    await messagingApplicationService.sendFriendRequestWithValidation(
      requesterId,
      addresseeId
    );
    res.json({ success: true });
  } catch (error: any) {
    const errorCode = typeof error?.message === 'string' && error.message.startsWith('ERR_')
      ? error.message
      : 'ERR_INTERNAL_SERVER_ERROR';

    if (errorCode === 'ERR_USER_NOT_FOUND') {
      res.status(404).json({ error: errorCode });
      return;
    }
    res.status(400).json({ error: errorCode });
  }
};

/**
 * Callers: [Router]
 * Callees: [messagingApplicationService]
 * Description: Handles responding to an incoming friend request (accept or reject).
 * Keywords: friend, respond, accept
 */
export const respondFriend = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const { friendshipId, accept } = req.body;
  if (!userId || !friendshipId) { res.status(400).json({ error: 'ERR_BAD_REQUEST' }); return; }

  try {
    await messagingApplicationService.respondFriendRequest(friendshipId, userId, accept);
    res.json({ success: true });
  } catch (error: any) {
    const errorCode = typeof error?.message === 'string' && error.message.startsWith('ERR_')
      ? error.message
      : 'ERR_INTERNAL_SERVER_ERROR';
    res.status(errorCode === 'ERR_NOT_FOUND' ? 404 : 400).json({ error: errorCode });
  }
};

/**
 * Callers: [Router]
 * Callees: [messagingQueryService]
 * Description: Retrieves the list of friends for the authenticated user.
 * Keywords: friend, list
 */
export const getFriends = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) { res.status(401).json({ error: 'ERR_UNAUTHORIZED' }); return; }

  const friendships = await messagingQueryService.listFriends(userId);

  res.json({ friendships });
};

/**
 * Callers: [Router]
 * Callees: [messagingApplicationService]
 * Description: Removes a friend or cancels a friend request.
 * Keywords: remove, friend, unfriend
 */
export const removeFriend = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const { targetUserId } = req.body;
  if (!userId || !targetUserId) { res.status(400).json({ error: 'ERR_BAD_REQUEST' }); return; }

  try {
    await messagingApplicationService.removeFriend(userId, targetUserId);
    res.json({ success: true });
  } catch (error: any) {
    const errorCode = typeof error?.message === 'string' && error.message.startsWith('ERR_')
      ? error.message
      : 'ERR_INTERNAL_SERVER_ERROR';
    res.status(errorCode === 'ERR_NOT_FOUND' ? 404 : 400).json({ error: errorCode });
  }
};

/**
 * Callers: [Router]
 * Callees: [messagingApplicationService]
 * Description: Blocks a user, adding them to the blacklist.
 * Keywords: block, user, blacklist
 */
export const blockUser = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const { targetUserId } = req.body;
  if (!userId || !targetUserId) { res.status(400).json({ error: 'ERR_BAD_REQUEST' }); return; }

  try {
    await messagingApplicationService.blockUser(userId, targetUserId);
    res.json({ success: true });
  } catch (error: any) {
    const errorCode = typeof error?.message === 'string' && error.message.startsWith('ERR_')
      ? error.message
      : 'ERR_INTERNAL_SERVER_ERROR';
    res.status(400).json({ error: errorCode });
  }
};
