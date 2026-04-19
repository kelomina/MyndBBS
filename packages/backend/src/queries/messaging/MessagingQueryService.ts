import { prisma } from '../../db';

import { FriendshipDTO, ConversationSettingsDTO, UserKeyDTO, UserPublicKeyDTO, MessageListDTO } from './dto';

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
  public async getMyKey(userId: string): Promise<UserKeyDTO | null> {
    const key = await prisma.userKey.findUnique({ where: { userId } });
    if (!key) return null;
    return {
      id: key.id,
      userId: key.userId,
      scheme: key.scheme,
      publicKey: key.publicKey,
      encryptedPrivateKey: key.encryptedPrivateKey,
      mlKemPublicKey: key.mlKemPublicKey,
      encryptedMlKemPrivateKey: key.encryptedMlKemPrivateKey,
      createdAt: key.createdAt,
      updatedAt: key.updatedAt,
    };
  }

  /**
   * Callers: [messageController.getUserPublicKey]
   * Callees: [prisma.user.findUnique]
   * Description: Fetches the public key of a user by username.
   * Keywords: user, public, key, username
   */
  public async getUserPublicKey(username: string): Promise<UserPublicKeyDTO | null> {
    const user = await prisma.user.findUnique({ where: { username }, include: { userKey: true } });
    if (!user) return null;
    return {
      id: user.id,
      username: user.username,
      userKey: user.userKey ? {
        id: user.userKey.id,
        userId: user.userKey.userId,
        scheme: user.userKey.scheme,
        publicKey: user.userKey.publicKey,
        encryptedPrivateKey: user.userKey.encryptedPrivateKey,
        mlKemPublicKey: user.userKey.mlKemPublicKey,
        encryptedMlKemPrivateKey: user.userKey.encryptedMlKemPrivateKey,
        createdAt: user.userKey.createdAt,
        updatedAt: user.userKey.updatedAt,
      } : null
    };
  }

  /**
   * Callers: [messageController.getConversationSettings]
   * Callees: [prisma.conversationSetting.findUnique]
   * Description: Fetches the conversation settings between two users.
   * Keywords: conversation, settings, user, partner
   */
  public async getConversationSettings(userId: string, partnerId: string): Promise<ConversationSettingsDTO> {
    const setting = await prisma.conversationSetting.findUnique({ where: { userId_partnerId: { userId, partnerId } } });
    return { allowTwoSidedDelete: setting?.allowTwoSidedDelete || false };
  }

  /**
   * Callers: [messageController.getUnreadCount]
   * Callees: [prisma.privateMessage.count, prisma.friendship.count]
   * Description: Counts the number of unread private messages and pending friend requests for a user.
   * Keywords: unread, count, private, messages, friend, requests
   */
  public async getUnreadCount(userId: string): Promise<number> {
    const unreadMessages = await prisma.privateMessage.count({ where: { receiverId: userId, isRead: false } });
    const pendingFriendRequests = await prisma.friendship.count({ where: { addresseeId: userId, status: 'PENDING' } });
    return unreadMessages + pendingFriendRequests;
  }

  /**
   * Callers: [friendController.getFriends]
   * Callees: [prisma.friendship.findMany]
   * Description: Lists all friendships for a given user, including requester and addressee usernames.
   * Keywords: friendships, list, user
   */
  public async listFriends(userId: string): Promise<FriendshipDTO[]> {
    const friends = await prisma.friendship.findMany({
      where: { OR: [{ requesterId: userId }, { addresseeId: userId }] },
      include: {
        requester: { select: { id: true, username: true } },
        addressee: { select: { id: true, username: true } },
      },
    });
    return friends.map(f => ({
      id: f.id,
      requesterId: f.requesterId,
      addresseeId: f.addresseeId,
      status: f.status,
      createdAt: f.createdAt,
      requester: { id: f.requester.id, username: f.requester.username },
      addressee: { id: f.addressee.id, username: f.addressee.username },
    }));
  }

  public async getMessages(userId: string, limit: number, cursor?: string, withUserId?: string): Promise<MessageListDTO> {
    const notExpiredCondition = {
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } }
      ]
    };

    let whereClause: NonNullable<Parameters<typeof prisma.privateMessage.findMany>[0]>['where'] = {
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
      messages: messages.reverse().map((m: any) => ({
        id: m.id,
        senderId: m.senderId,
        receiverId: m.receiverId,
        ephemeralPublicKey: m.ephemeralPublicKey,
        ephemeralMlKemCiphertext: m.ephemeralMlKemCiphertext,
        encryptedContent: m.encryptedContent,
        senderEncryptedContent: m.senderEncryptedContent,
        isRead: m.isRead,
        isSystem: m.isSystem,
        expiresAt: m.expiresAt,
        deletedBy: m.deletedBy,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
        sender: { username: m.sender.username },
        receiver: { username: m.receiver.username },
      })),
      nextCursor,
      hasMore: nextCursor !== undefined
    };
  }
}

export const messagingQueryService = new MessagingQueryService();
