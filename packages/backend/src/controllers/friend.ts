import { Response } from 'express';
import { prisma } from '../db';
import { AuthRequest } from '../middleware/auth';

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

  // Check if existing
  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId, addresseeId },
        { requesterId: addresseeId, addresseeId: requesterId }
      ]
    }
  });

  if (existing) { res.status(400).json({ error: 'ERR_FRIENDSHIP_EXISTS' }); return; }

  const friendship = await prisma.friendship.create({
    data: { requesterId, addresseeId, status: 'PENDING' }
  });

  // Create system notification for addressee
  const requester = await prisma.user.findUnique({ where: { id: requesterId } });
  const payload = {
    title: 'Friend Request',
    content: `${requester?.username} wants to be your friend.`,
    relatedId: friendship.id,
    type: 'FRIEND_REQUEST'
  };

  const systemUser = await prisma.user.findUnique({ where: { username: 'system' } });
  if (systemUser) {
    await prisma.privateMessage.create({
      data: {
        senderId: systemUser.id,
        receiverId: addresseeId,
        ephemeralPublicKey: 'system',
        encryptedContent: JSON.stringify(payload),
        isSystem: true
      }
    });
  }

  res.json({ success: true, friendship });
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

  const friendship = await prisma.friendship.findUnique({ where: { id: friendshipId } });
  if (!friendship || friendship.addresseeId !== userId) { res.status(404).json({ error: 'ERR_NOT_FOUND' }); return; }

  await prisma.friendship.update({
    where: { id: friendshipId },
    data: { status: accept ? 'ACCEPTED' : 'REJECTED' }
  });

  res.json({ success: true });
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

  const friendships = await prisma.friendship.findMany({
    where: {
      OR: [
        { requesterId: userId },
        { addresseeId: userId }
      ]
    },
    include: {
      requester: { select: { id: true, username: true } },
      addressee: { select: { id: true, username: true } }
    }
  });

  res.json({ friendships });
};
