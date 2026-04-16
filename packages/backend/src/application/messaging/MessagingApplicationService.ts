import { IFriendshipRepository } from '../../domain/messaging/IFriendshipRepository';
import { IPrivateMessageRepository } from '../../domain/messaging/IPrivateMessageRepository';
import { IUserKeyRepository } from '../../domain/messaging/IUserKeyRepository';
import { IConversationSettingRepository } from '../../domain/messaging/IConversationSettingRepository';
import { Friendship } from '../../domain/messaging/Friendship';
import { PrivateMessage } from '../../domain/messaging/PrivateMessage';
import { UserKey } from '../../domain/messaging/UserKey';
import { ConversationSetting } from '../../domain/messaging/ConversationSetting';
import { randomUUID as uuidv4 } from 'crypto';

import { identityQueryService } from '../../queries/identity/IdentityQueryService';

/**
 * Callers: [FriendController, MessageController]
 * Callees: [IFriendshipRepository, IPrivateMessageRepository, IUserKeyRepository, IConversationSettingRepository, Friendship.create, Friendship.accept, Friendship.reject, PrivateMessage.create, PrivateMessage.markAsRead, PrivateMessage.deleteForUser]
 * Description: The Application Service for the Messaging Domain. Orchestrates friend requests, private messages, and user keys.
 * Keywords: messaging, service, application, orchestration, friend, privatemessage, key
 */
export class MessagingApplicationService {
  constructor(
    private friendshipRepository: IFriendshipRepository,
    private privateMessageRepository: IPrivateMessageRepository,
    private userKeyRepository: IUserKeyRepository,
    private conversationSettingRepository: IConversationSettingRepository
  ) {}

  // --- Friendship Management ---

  public async sendFriendRequestWithValidation(requesterId: string, addresseeId: string): Promise<void> {
    const requester = await identityQueryService.getProfile(requesterId);
    if (!requester) throw new Error('ERR_USER_NOT_FOUND');

    const systemUser = await identityQueryService.getUserByUsername('system');

    const friendship = await this.sendFriendRequest(requesterId, addresseeId);

    const payload = {
      title: 'Friend Request',
      content: `${requester.username} wants to be your friend.`,
      relatedId: friendship.id,
      type: 'FRIEND_REQUEST'
    };

    if (systemUser) {
      await this.sendMessage(
        systemUser.id,
        6, // system level
        addresseeId,
        JSON.stringify(payload),
        false, // isBurnAfterRead
        true   // isSystem
      );
    }
  }

  /**
   * Callers: [FriendController]
   * Callees: [friendshipRepository.findByUsers, Friendship.create, friendshipRepository.save, userRepository.findById, userRepository.findByUsername, PrivateMessage.create, privateMessageRepository.save]
   * Description: Sends a friend request from one user to another, also dispatching a system notification.
   * Keywords: friend, request, send, messaging, friendship
   */
  public async sendFriendRequest(requesterId: string, receiverId: string): Promise<Friendship> {
    const existing = await this.friendshipRepository.findByUsers(requesterId, receiverId);
    if (existing) throw new Error('ERR_FRIENDSHIP_EXISTS');

    const friendship = Friendship.create({
      id: uuidv4(),
      requesterId,
      addresseeId: receiverId,
      status: 'PENDING',
      createdAt: new Date()
    });

    await this.friendshipRepository.save(friendship);
    return friendship;
  }

  public async respondFriendRequest(friendshipId: string, userId: string, accept: boolean): Promise<void> {
    const friendship = await this.friendshipRepository.findById(friendshipId);
    if (!friendship) throw new Error('ERR_NOT_FOUND');

    if (accept) {
      friendship.accept(userId);
    } else {
      friendship.reject(userId);
    }

    await this.friendshipRepository.save(friendship);
  }

  // --- Private Message Management ---

  public async sendMessageWithValidation(
    senderId: string, 
    receiverId: string, 
    content: string, 
    isSystem: boolean = false,
    isBurnAfterRead: boolean = false
  ): Promise<string> {
    const sender = await identityQueryService.getProfile(senderId);
    if (!sender) throw new Error('ERR_USER_NOT_FOUND');

    return this.sendMessage(
      senderId, 
      sender.level, 
      receiverId, 
      content, 
      isBurnAfterRead,
      isSystem
    );
  }

  public async sendMessage(
    senderId: string, 
    senderLevel: number, 
    receiverId: string, 
    encryptedContent: string, 
    isBurnAfterRead: boolean,
    isSystem: boolean = false
  ): Promise<string> {
    const friendship = await this.friendshipRepository.findByUsers(senderId, receiverId);
    const isFriend = !!(friendship && friendship.status === 'ACCEPTED') || isSystem;

    let sentCount = 0;
    if (!isFriend) {
      sentCount = await this.privateMessageRepository.countMessagesBetween(senderId, receiverId);
    }

    let expiresAt: Date | null = null;
    if (isBurnAfterRead) {
      expiresAt = new Date(Date.now() + 60 * 1000);
    }

    const message = PrivateMessage.create({
      id: uuidv4(),
      senderId,
      receiverId,
      ephemeralPublicKey: isSystem ? 'system' : '',
      ephemeralMlKemCiphertext: null,
      encryptedContent,
      senderEncryptedContent: null,
      isRead: false,
      isSystem,
      expiresAt,
      deletedBy: [],
      createdAt: new Date()
    }, senderLevel, isFriend, sentCount);

    await this.privateMessageRepository.save(message);
    return message.id;
  }

  public async deleteMessage(messageId: string, userId: string): Promise<void> {
    const message = await this.privateMessageRepository.findById(messageId);
    if (!message) throw new Error('ERR_NOT_FOUND');

    let canHardDelete = false;
    if (message.senderId === userId) {
      const partnerId = message.senderId === userId ? message.receiverId : message.senderId;
      const partnerSetting = await this.conversationSettingRepository.findByUsers(partnerId, userId);
      canHardDelete = partnerSetting?.allowTwoSidedDelete || false;
    }

    const shouldHardDelete = message.deleteForUser(userId, canHardDelete);
    
    if (shouldHardDelete) {
      await this.privateMessageRepository.delete(message.id);
    } else {
      await this.privateMessageRepository.save(message);
    }
  }

  public async clearChat(userId: string, partnerId: string): Promise<void> {
    const partnerSetting = await this.conversationSettingRepository.findByUsers(partnerId, userId);
    const canHardDelete = partnerSetting?.allowTwoSidedDelete || false;

    const messages = await this.privateMessageRepository.findConversation(userId, partnerId);

    for (const msg of messages) {
      if (!msg.deletedBy.includes(userId)) {
        const shouldHardDelete = msg.deleteForUser(userId, canHardDelete);
        if (shouldHardDelete) {
          await this.privateMessageRepository.delete(msg.id);
        } else {
          await this.privateMessageRepository.save(msg);
        }
      }
    }
  }

  public async markAsRead(receiverId: string, senderId: string): Promise<void> {
    const messages = await this.privateMessageRepository.findConversation(receiverId, senderId);
    for (const msg of messages) {
      if (msg.receiverId === receiverId && !msg.isRead) {
        msg.markAsRead(receiverId);
        await this.privateMessageRepository.save(msg);
      }
    }
  }

  public async uploadKeysWithValidation(
    userId: string, 
    scheme: string, 
    publicKey: string, 
    encryptedPrivateKey: string, 
    mlKemPublicKey?: string, 
    encryptedMlKemPrivateKey?: string
  ): Promise<void> {
    const user = await identityQueryService.getProfile(userId);
    if (!user) throw new Error('ERR_USER_NOT_FOUND');

    await this.uploadKeys(
      userId, 
      user.level, 
      scheme, 
      publicKey, 
      encryptedPrivateKey, 
      mlKemPublicKey, 
      encryptedMlKemPrivateKey
    );
  }

  /**
   * Callers: [MessageController]
   * Callees: [userRepository.findById, userKeyRepository.findByUserId, userKey.updateKeys, UserKey.create, userKeyRepository.save]
   * Description: Uploads public and private encryption keys for a user.
   * Keywords: upload, keys, encryption, messaging, user
   */
  public async uploadKeys(userId: string, userLevel: number, scheme: string, publicKey: string, encryptedPrivateKey: string, mlKemPublicKey?: string, encryptedMlKemPrivateKey?: string): Promise<void> {
    if (userLevel < 2) throw new Error('ERR_LEVEL_TOO_LOW');

    let userKey = await this.userKeyRepository.findByUserId(userId);
    if (userKey) {
      userKey.updateKeys(
        scheme,
        publicKey,
        encryptedPrivateKey,
        mlKemPublicKey || null,
        encryptedMlKemPrivateKey || null,
        userLevel
      );
    } else {
      userKey = UserKey.create({
        userId,
        scheme,
        publicKey,
        encryptedPrivateKey,
        mlKemPublicKey: mlKemPublicKey || null,
        encryptedMlKemPrivateKey: encryptedMlKemPrivateKey || null
      }, userLevel);
    }
    await this.userKeyRepository.save(userKey);
  }

  /**
   * Callers: [MessageController.updateConversationSettings]
   * Callees: [IConversationSettingRepository.findByUsers, ConversationSetting.updatePreference, ConversationSetting.create, IConversationSettingRepository.save]
   * Description: Updates a user's preference regarding two-sided hard deletes for a specific conversation.
   * Keywords: update, conversation, settings, preference, delete
   */
  public async updateConversationSettings(userId: string, partnerId: string, allowTwoSidedDelete: boolean): Promise<void> {
    let setting = await this.conversationSettingRepository.findByUsers(userId, partnerId);
    if (setting) {
      setting.updatePreference(allowTwoSidedDelete);
    } else {
      setting = ConversationSetting.create({
        userId,
        partnerId,
        allowTwoSidedDelete
      });
    }
    await this.conversationSettingRepository.save(setting);
  }
}
