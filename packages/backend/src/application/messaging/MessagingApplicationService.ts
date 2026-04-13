import { IFriendshipRepository } from '../../domain/messaging/IFriendshipRepository';
import { IPrivateMessageRepository } from '../../domain/messaging/IPrivateMessageRepository';
import { IUserKeyRepository } from '../../domain/messaging/IUserKeyRepository';
import { IConversationSettingRepository } from '../../domain/messaging/IConversationSettingRepository';
import { Friendship } from '../../domain/messaging/Friendship';
import { PrivateMessage } from '../../domain/messaging/PrivateMessage';
import { UserKey } from '../../domain/messaging/UserKey';
import { ConversationSetting } from '../../domain/messaging/ConversationSetting';
import { IUserRepository } from '../../domain/identity/IUserRepository';
import { v4 as uuidv4 } from 'uuid';

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
    private userRepository: IUserRepository
  ) {}

  // --- Friendship Management ---

  /**
   * Callers: [FriendController]
   * Callees: [friendshipRepository.findByUsers, Friendship.create, friendshipRepository.save, userRepository.findById, userRepository.findByUsername, PrivateMessage.create, privateMessageRepository.save]
   * Description: Sends a friend request from one user to another, also dispatching a system notification.
   * Keywords: friend, request, send, messaging, friendship
   */
  public async sendFriendRequest(requesterId: string, addresseeId: string): Promise<Friendship> {
    const existing = await this.friendshipRepository.findByUsers(requesterId, addresseeId);
    if (existing) throw new Error('ERR_FRIENDSHIP_EXISTS');

    const friendship = Friendship.create({
      id: uuidv4(),
      requesterId,
      addresseeId,
      status: 'PENDING',
      createdAt: new Date()
    });

    await this.friendshipRepository.save(friendship);

    // Send system notification message
    const requester = await this.userRepository.findById(requesterId);
    const payload = {
      title: 'Friend Request',
      content: `${requester?.username} wants to be your friend.`,
      relatedId: friendship.id,
      type: 'FRIEND_REQUEST'
    };

    const systemUser = await this.userRepository.findByUsername('system');
    if (systemUser) {
      const systemMessage = PrivateMessage.create({
        id: uuidv4(),
        senderId: systemUser.id,
        receiverId: addresseeId,
        ephemeralPublicKey: 'system',
        ephemeralMlKemCiphertext: null,
        encryptedContent: JSON.stringify(payload),
        senderEncryptedContent: null,
        isRead: false,
        isSystem: true,
        expiresAt: null,
        deletedBy: [],
        createdAt: new Date()
      });
      await this.privateMessageRepository.save(systemMessage);
    }

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

  public async sendMessage(
    senderId: string, 
    receiverId: string, 
    ephemeralPublicKey: string, 
    ephemeralMlKemCiphertext: string | null, 
    encryptedContent: string, 
    senderEncryptedContent: string | null, 
    expiresIn?: number
  ): Promise<PrivateMessage> {
    const sender = await this.userRepository.findById(senderId);
    if (!sender || sender.level < 2) throw new Error('ERR_LEVEL_TOO_LOW');

    const friendship = await this.friendshipRepository.findByUsers(senderId, receiverId);
    const isFriend = friendship && friendship.status === 'ACCEPTED';

    if (!isFriend) {
      const sentCount = await this.privateMessageRepository.countMessagesBetween(senderId, receiverId);
      if (sentCount >= 3) {
        throw new Error('ERR_FRIEND_REQUIRED_LIMIT_REACHED');
      }
    }

    let expiresAt: Date | null = null;
    if (expiresIn && typeof expiresIn === 'number') {
      expiresAt = new Date(Date.now() + expiresIn);
    }

    const message = PrivateMessage.create({
      id: uuidv4(),
      senderId,
      receiverId,
      ephemeralPublicKey,
      ephemeralMlKemCiphertext,
      encryptedContent,
      senderEncryptedContent,
      isRead: false,
      isSystem: false,
      expiresAt,
      deletedBy: [],
      createdAt: new Date()
    });

    await this.privateMessageRepository.save(message);
    return message;
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

  /**
   * Callers: [MessageController]
   * Callees: [userRepository.findById, userKeyRepository.findByUserId, userKey.updateKeys, UserKey.create, userKeyRepository.save]
   * Description: Uploads public and private encryption keys for a user.
   * Keywords: upload, keys, encryption, messaging, user
   */
  public async uploadKeys(userId: string, scheme: string, publicKey: string, encryptedPrivateKey: string, mlKemPublicKey?: string, encryptedMlKemPrivateKey?: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user || user.level < 2) throw new Error('ERR_LEVEL_TOO_LOW');
    if (scheme === 'X_WING_HYBRID' && user.level < 4) throw new Error('ERR_LEVEL_TOO_LOW_FOR_X_WING');

    let userKey = await this.userKeyRepository.findByUserId(userId);
    if (userKey) {
      userKey.updateKeys(scheme, publicKey, encryptedPrivateKey, mlKemPublicKey || null, encryptedMlKemPrivateKey || null);
    } else {
      userKey = UserKey.create({
        userId,
        scheme,
        publicKey,
        encryptedPrivateKey,
        mlKemPublicKey: mlKemPublicKey || null,
        encryptedMlKemPrivateKey: encryptedMlKemPrivateKey || null
      });
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
