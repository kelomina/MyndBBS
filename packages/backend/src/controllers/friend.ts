import { Response } from 'express';
import { messagingQueryService } from '../queries/messaging/MessagingQueryService';
import { AuthRequest } from '../middleware/auth';
import { messagingApplicationService } from '../registry';

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

export const getFriends = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) { res.status(401).json({ error: 'ERR_UNAUTHORIZED' }); return; }

  const friendships = await messagingQueryService.listFriends(userId);

  res.json({ friendships });
};
