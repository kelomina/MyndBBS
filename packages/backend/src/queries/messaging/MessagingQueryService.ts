import { prisma } from '../../db';

/**
 * Callers: [messageController, friendController]
 * Callees: [prisma.userKey, prisma.user, prisma.conversationSetting, prisma.privateMessage, prisma.friendship]
 * Description: Query service for messaging domain components (keys, conversation settings, private messages, friendships).
 * Keywords: query, service, messaging, keys, conversations, messages, friends
 */
export class MessagingQueryService {
  /**
   * Callers: [messageController.getMyKey]
   * Callees: [prisma.userKey.findUnique]
   * Description: Fetches the public/private key pair for a user.
   * Keywords: user, key, public, private
   */
  public async getMyKey(userId: string) {
    return prisma.userKey.findUnique({ where: { userId } });
  }

  /**
   * Callers: [messageController.getUserPublicKey]
   * Callees: [prisma.user.findUnique]
   * Description: Fetches the public key of a user by username.
   * Keywords: user, public, key, username
   */
  public async getUserPublicKey(username: string) {
    return prisma.user.findUnique({ where: { username }, include: { userKey: true } });
  }

  /**
   * Callers: [messageController.getConversationSettings]
   * Callees: [prisma.conversationSetting.findUnique]
   * Description: Fetches the conversation settings between two users.
   * Keywords: conversation, settings, user, partner
   */
  public async getConversationSettings(userId: string, partnerId: string) {
    const setting = await prisma.conversationSetting.findUnique({ where: { userId_partnerId: { userId, partnerId } } });
    return { allowTwoSidedDelete: setting?.allowTwoSidedDelete || false };
  }

  /**
   * Callers: [messageController.getUnreadCount]
   * Callees: [prisma.privateMessage.count]
   * Description: Counts the number of unread private messages for a user.
   * Keywords: unread, count, private, messages
   */
  public async getUnreadCount(userId: string) {
    return prisma.privateMessage.count({ where: { receiverId: userId, isRead: false } });
  }

  /**
   * Callers: [friendController.getFriends]
   * Callees: [prisma.friendship.findMany]
   * Description: Lists all friendships for a given user, including requester and addressee usernames.
   * Keywords: friendships, list, user
   */
  public async listFriends(userId: string) {
    return prisma.friendship.findMany({
      where: { OR: [{ requesterId: userId }, { addresseeId: userId }] },
      include: {
        requester: { select: { id: true, username: true } },
        addressee: { select: { id: true, username: true } },
      },
    });
  }

  public async getMessages(userId: string, limit: number, cursor?: string, withUserId?: string) {
    const notExpiredCondition = {
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } }
      ]
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

    return {
      messages: messages.reverse(),
      nextCursor,
      hasMore: nextCursor !== undefined
    };
  }
}

export const messagingQueryService = new MessagingQueryService();
