import { IFriendshipRepository } from '../../domain/messaging/IFriendshipRepository';
import { IPrivateMessageRepository } from '../../domain/messaging/IPrivateMessageRepository';
import { IUserKeyRepository } from '../../domain/messaging/IUserKeyRepository';
import { IConversationSettingRepository } from '../../domain/messaging/IConversationSettingRepository';
import { IIdentityIntegrationPort } from '../../domain/messaging/IIdentityIntegrationPort';
import { Friendship } from '../../domain/messaging/Friendship';
import { PrivateMessage } from '../../domain/messaging/PrivateMessage';
import { UserKey } from '../../domain/messaging/UserKey';
import { ConversationSetting } from '../../domain/messaging/ConversationSetting';
import { randomUUID as uuidv4 } from 'crypto';
import { IUnitOfWork } from '../../domain/shared/IUnitOfWork';

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
    private conversationSettingRepository: IConversationSettingRepository,
    private identityIntegrationPort: IIdentityIntegrationPort,
    private unitOfWork: IUnitOfWork
  ) {}

  // --- Friendship Management ---

  /**
   * Callers: [FriendController.sendFriendRequest]
   * Callees: [IIdentityIntegrationPort.getUserProfile, IIdentityIntegrationPort.getUserByUsername, sendFriendRequest, sendMessage, IUnitOfWork.execute]
   * Description: Validates user profiles before sending a friend request. Sends a system message if applicable within a transaction.
   * Keywords: validate, friend, request, messaging
   */
  public async sendFriendRequestWithValidation(requesterId: string, addresseeId: string): Promise<void> {
    const requester = await this.identityIntegrationPort.getUserProfile(requesterId);
    if (!requester) throw new Error('ERR_USER_NOT_FOUND');

    const systemUser = await this.identityIntegrationPort.getUserByUsername('system');

    await this.unitOfWork.execute(async () => {
      const friendship = await this.sendFriendRequest(requesterId, addresseeId);

      const payload = {
        title: 'Friend Request',
        content: `{{username}} wants to be your friend.`,
        params: { username: requester.username },
        relatedId: friendship.id,
        type: 'FRIEND_REQUEST'
      };

      if (systemUser) {
        await this.sendMessage(
          systemUser.id,
          6, // system level
          addresseeId,
          JSON.stringify(payload),
          'system', // ephemeralPublicKey
          '',       // senderEncryptedContent
          false, // isBurnAfterRead
          true   // isSystem
        );
      }
    });
  }

  /**
   * Callers: [FriendController]
   * Callees: [friendshipRepository.findByUsers, Friendship.create, friendshipRepository.save, userRepository.findById, userRepository.findByUsername, PrivateMessage.create, privateMessageRepository.save, IUnitOfWork.execute]
   * Description: Sends a friend request from one user to another, also dispatching a system notification.
   * Keywords: friend, request, send, messaging, friendship
   */
  public async sendFriendRequest(requesterId: string, receiverId: string): Promise<Friendship> {
    return this.unitOfWork.execute(async () => {
      const existing = await this.friendshipRepository.findByUsers(requesterId, receiverId);
      if (existing) {
        if (existing.status === 'BLOCKED') throw new Error('ERR_USER_BLOCKED');
        throw new Error('ERR_FRIENDSHIP_EXISTS');
      }

      const friendship = Friendship.create({
        id: uuidv4(),
        requesterId,
        addresseeId: receiverId,
        status: 'PENDING',
        createdAt: new Date()
      });

      await this.friendshipRepository.save(friendship);
      return friendship;
    });
  }

  /**
   * Callers: [FriendController.respondFriendRequest]
   * Callees: [IFriendshipRepository.findById, Friendship.accept, Friendship.reject, IFriendshipRepository.save, IUnitOfWork.execute]
   * Description: Responds to a friend request by accepting or rejecting it.
   * Keywords: respond, friend, request, messaging, friendship
   */
  public async respondFriendRequest(friendshipId: string, userId: string, accept: boolean): Promise<void> {
    await this.unitOfWork.execute(async () => {
      const friendship = await this.friendshipRepository.findById(friendshipId);
      if (!friendship) throw new Error('ERR_NOT_FOUND');

      if (accept) {
        friendship.accept(userId);
      } else {
        friendship.reject(userId);
      }

      await this.friendshipRepository.save(friendship);
    });
  }

  /**
   * Callers: [FriendController.removeFriend]
   * Callees: [IFriendshipRepository.findByUsers, IFriendshipRepository.delete, IUnitOfWork.execute]
   * Description: Removes a friend or cancels a friend request.
   * Keywords: remove, delete, friend, unfriend, messaging
   */
  public async removeFriend(userId: string, targetUserId: string): Promise<void> {
    return this.unitOfWork.execute(async () => {
      const friendship = await this.friendshipRepository.findByUsers(userId, targetUserId);
      if (!friendship) throw new Error('ERR_NOT_FOUND');
      
      // Allow removing if they are involved in the friendship
      if (friendship.requesterId !== userId && friendship.addresseeId !== userId) {
        throw new Error('ERR_FORBIDDEN_NOT_INVOLVED');
      }
      
      await this.friendshipRepository.delete(friendship.id);
    });
  }

  /**
   * Callers: [FriendController.blockUser]
   * Callees: [IFriendshipRepository.findByUsers, Friendship.create, Friendship.block, IFriendshipRepository.save, IUnitOfWork.execute]
   * Description: Blocks a user, preventing them from sending messages or friend requests.
   * Keywords: block, user, friend, blacklist, messaging
   */
  public async blockUser(userId: string, targetUserId: string): Promise<void> {
    return this.unitOfWork.execute(async () => {
      let friendship = await this.friendshipRepository.findByUsers(userId, targetUserId);
      
      if (friendship) {
        friendship.block(userId);
      } else {
        friendship = Friendship.create({
          id: uuidv4(),
          requesterId: userId,
          addresseeId: targetUserId,
          status: 'BLOCKED',
          createdAt: new Date()
        });
      }
      
      await this.friendshipRepository.save(friendship);
    });
  }

  // --- Private Message Management ---

  /**
   * Callers: [MessageController.sendMessage]
   * Callees: [IIdentityIntegrationPort.getUserProfile, sendMessage]
   * Description: Validates sender profile before delegating to sendMessage.
   * Keywords: validate, send, message, private, messaging
   */
  public async sendMessageWithValidation(
    senderId: string, 
    receiverId: string, 
    content: string,
    ephemeralPublicKey: string,
    senderEncryptedContent: string,
    isSystem: boolean = false,
    isBurnAfterRead: boolean = false
  ): Promise<string> {
    const sender = await this.identityIntegrationPort.getUserProfile(senderId);
    if (!sender) throw new Error('ERR_USER_NOT_FOUND');

    return this.sendMessage(
      senderId, 
      sender.level, 
      receiverId, 
      content,
      ephemeralPublicKey,
      senderEncryptedContent,
      isBurnAfterRead,
      isSystem
    );
  }

  /**
   * Callers: [sendMessageWithValidation, sendFriendRequestWithValidation]
   * Callees: [IFriendshipRepository.findByUsers, IPrivateMessageRepository.countMessagesBetween, PrivateMessage.create, IPrivateMessageRepository.save, IUnitOfWork.execute]
   * Description: Sends a private message from one user to another. Checks friendship status and limits.
   * Keywords: send, message, private, messaging
   */
  public async sendMessage(
    senderId: string,
    senderLevel: number,
    receiverId: string,
    encryptedContent: string,
    ephemeralPublicKey: string,
    senderEncryptedContent: string,
    isBurnAfterRead: boolean,
    isSystem: boolean = false
  ): Promise<string> {
    const friendship = await this.friendshipRepository.findByUsers(senderId, receiverId);

    if (friendship && friendship.status === 'BLOCKED' && !isSystem) {
      throw new Error('ERR_USER_BLOCKED');
    }

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
      ephemeralPublicKey: isSystem ? 'system' : ephemeralPublicKey,
      ephemeralMlKemCiphertext: null,
      encryptedContent,
      senderEncryptedContent: isSystem ? null : senderEncryptedContent,
      isRead: false,
      isSystem,
      expiresAt,
      deletedBy: [],
      createdAt: new Date()
    }, senderLevel, isFriend, sentCount);

    await this.unitOfWork.execute(async () => {
      await this.privateMessageRepository.save(message);
    });
    
    return message.id;
  }

  /**
   * Callers: [MessageController.deleteMessage]
   * Callees: [IPrivateMessageRepository.findById, IConversationSettingRepository.findByUsers, PrivateMessage.deleteForUser, IPrivateMessageRepository.delete, IPrivateMessageRepository.save, IUnitOfWork.execute]
   * Description: Deletes a specific message for a user. Hard deletes if applicable based on conversation settings.
   * Keywords: delete, message, private, messaging, conversation
   */
  public async deleteMessage(messageId: string, userId: string): Promise<void> {
    const message = await this.privateMessageRepository.findById(messageId);
    if (!message) throw new Error('ERR_NOT_FOUND');

    let canHardDelete = false;
    if (message.senderId === userId) {
      const partnerId = message.senderId === userId ? message.receiverId : message.senderId;
      const partnerSetting = await this.conversationSettingRepository.findByUsers(partnerId, userId);
      canHardDelete = partnerSetting?.allowTwoSidedDelete || false;
    }

    await this.unitOfWork.execute(async () => {
      const shouldHardDelete = message.deleteForUser(userId, canHardDelete);
      
      if (shouldHardDelete) {
        await this.privateMessageRepository.delete(message.id);
      } else {
        await this.privateMessageRepository.save(message);
      }
    });
  }

  /**
   * Callers: [MessageController.clearChat]
   * Callees: [IConversationSettingRepository.findByUsers, IPrivateMessageRepository.findConversation, IUnitOfWork.execute, PrivateMessage.deleteForUser, IPrivateMessageRepository.delete, IPrivateMessageRepository.save]
   * Description: Clears all messages in a conversation for a specific user.
   * Keywords: clear, chat, message, private, messaging, conversation
   */
  public async clearChat(userId: string, partnerId: string): Promise<void> {
    const partnerSetting = await this.conversationSettingRepository.findByUsers(partnerId, userId);
    const canHardDelete = partnerSetting?.allowTwoSidedDelete || false;

    const messages = await this.privateMessageRepository.findConversation(userId, partnerId);

    await this.unitOfWork.execute(async () => {
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
    });
  }

  /**
   * Callers: [MessageController.markAsRead]
   * Callees: [IPrivateMessageRepository.findConversation, IUnitOfWork.execute, PrivateMessage.markAsRead, IPrivateMessageRepository.save]
   * Description: Marks all unread messages from a sender to a receiver as read.
   * Keywords: mark, read, message, private, messaging
   */
  public async markAsRead(receiverId: string, senderId: string): Promise<void> {
    const messages = await this.privateMessageRepository.findConversation(receiverId, senderId);
    
    await this.unitOfWork.execute(async () => {
      for (const msg of messages) {
        if (msg.receiverId === receiverId && !msg.isRead) {
          msg.markAsRead(receiverId);
          await this.privateMessageRepository.save(msg);
        }
      }
    });
  }

  /**
   * Callers: [MessageController.uploadKeys]
   * Callees: [IIdentityIntegrationPort.getUserProfile, uploadKeys]
   * Description: Validates user profile before uploading encryption keys.
   * Keywords: validate, upload, keys, encryption, messaging
   */
  public async uploadKeysWithValidation(
    userId: string, 
    scheme: string, 
    publicKey: string, 
    encryptedPrivateKey: string, 
    mlKemPublicKey?: string, 
    encryptedMlKemPrivateKey?: string
  ): Promise<void> {
    const user = await this.identityIntegrationPort.getUserProfile(userId);
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
   * Callees: [userRepository.findById, userKeyRepository.findByUserId, userKey.updateKeys, UserKey.create, userKeyRepository.save, IUnitOfWork.execute]
   * Description: Uploads public and private encryption keys for a user.
   * Keywords: upload, keys, encryption, messaging, user
   */
  public async uploadKeys(userId: string, userLevel: number, scheme: string, publicKey: string, encryptedPrivateKey: string, mlKemPublicKey?: string, encryptedMlKemPrivateKey?: string): Promise<void> {
    if (userLevel < 2) throw new Error('ERR_LEVEL_TOO_LOW');

    await this.unitOfWork.execute(async () => {
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
    });
  }

  /**
   * Callers: [MessageController.updateConversationSettings]
   * Callees: [IConversationSettingRepository.findByUsers, ConversationSetting.updatePreference, ConversationSetting.create, IConversationSettingRepository.save, IUnitOfWork.execute]
   * Description: Updates a user's preference regarding two-sided hard deletes for a specific conversation.
   * Keywords: update, conversation, settings, preference, delete
   */
  public async updateConversationSettings(userId: string, partnerId: string, allowTwoSidedDelete: boolean): Promise<void> {
    await this.unitOfWork.execute(async () => {
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
    });
  }
}
