import { MessagingApplicationService } from '../src/application/messaging/MessagingApplicationService';
import { Friendship } from '../src/domain/messaging/Friendship';
import { PrivateMessage, PrivateMessageProps } from '../src/domain/messaging/PrivateMessage';
import { UserKey } from '../src/domain/messaging/UserKey';
import { ConversationSetting } from '../src/domain/messaging/ConversationSetting';

describe('MessagingApplicationService', () => {
  let friendshipRepository: any;
  let privateMessageRepository: any;
  let userKeyRepository: any;
  let conversationSettingRepository: any;
  let identityIntegrationPort: any;
  let unitOfWork: any;
  let eventBus: any;
  let service: MessagingApplicationService;

  const messageProps = (overrides: Partial<PrivateMessageProps> = {}): PrivateMessageProps => ({
    id: 'msg-1',
    senderId: 'user-1',
    receiverId: 'user-2',
    ephemeralPublicKey: 'pub-key',
    ephemeralMlKemCiphertext: null,
    encryptedContent: 'content',
    senderEncryptedContent: 'sender-content',
    isRead: false,
    isSystem: false,
    expiresAt: null,
    expiresInMs: null,
    expiresStartedAt: null,
    autoDeleteForSenderAfterRead: false,
    deletedBy: [],
    createdAt: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    friendshipRepository = {
      findByUsers: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    privateMessageRepository = {
      findById: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      countMessagesBetween: jest.fn(),
      findConversation: jest.fn(),
    };
    userKeyRepository = {
      findByUserId: jest.fn(),
      save: jest.fn(),
    };
    conversationSettingRepository = {
      findByUsers: jest.fn(),
      save: jest.fn(),
    };
    identityIntegrationPort = {
      getUserProfile: jest.fn(),
      getUserByUsername: jest.fn(),
    };
    unitOfWork = {
      execute: jest.fn((work) => work()),
    };
    eventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
      subscribe: jest.fn(),
    };

    service = new MessagingApplicationService({
      friendshipRepository,
      privateMessageRepository,
      userKeyRepository,
      conversationSettingRepository,
      identityIntegrationPort,
      unitOfWork,
      eventBus,
    });
  });

  describe('Friendship Management', () => {
    it('should send a friend request', async () => {
      friendshipRepository.findByUsers.mockResolvedValue(null);

      const friendship = await service.sendFriendRequest('user-1', 'user-2');

      expect(friendship).toBeInstanceOf(Friendship);
      expect(friendship.status).toBe('PENDING');
      expect(friendshipRepository.save).toHaveBeenCalled();
    });

    it('should throw when sending request to blocked user', async () => {
      friendshipRepository.findByUsers.mockResolvedValue({ status: 'BLOCKED' });

      await expect(service.sendFriendRequest('user-1', 'user-2')).rejects.toThrow('ERR_USER_BLOCKED');
    });

    it('should throw when friendship already exists', async () => {
      friendshipRepository.findByUsers.mockResolvedValue({ status: 'ACCEPTED' });

      await expect(service.sendFriendRequest('user-1', 'user-2')).rejects.toThrow('ERR_FRIENDSHIP_EXISTS');
    });

    it('should accept a friend request', async () => {
      const mockFriendship = Friendship.create({
        id: 'friendship-1',
        requesterId: 'user-1',
        addresseeId: 'user-2',
        status: 'PENDING',
        createdAt: new Date(),
      });
      friendshipRepository.findById.mockResolvedValue(mockFriendship);

      await service.respondFriendRequest('friendship-1', 'user-2', true);

      expect(mockFriendship.status).toBe('ACCEPTED');
      expect(friendshipRepository.save).toHaveBeenCalled();
    });

    it('should reject a friend request', async () => {
      const mockFriendship = Friendship.create({
        id: 'friendship-1',
        requesterId: 'user-1',
        addresseeId: 'user-2',
        status: 'PENDING',
        createdAt: new Date(),
      });
      friendshipRepository.findById.mockResolvedValue(mockFriendship);

      await service.respondFriendRequest('friendship-1', 'user-2', false);

      expect(mockFriendship.status).toBe('REJECTED');
    });

    it('should remove a friend', async () => {
      const mockFriendship = Friendship.create({
        id: 'friendship-1',
        requesterId: 'user-1',
        addresseeId: 'user-2',
        status: 'ACCEPTED',
        createdAt: new Date(),
      });
      friendshipRepository.findByUsers.mockResolvedValue(mockFriendship);

      await service.removeFriend('user-1', 'user-2');

      expect(friendshipRepository.delete).toHaveBeenCalledWith('friendship-1');
    });

    it('should throw when removing friend not involved in', async () => {
      const mockFriendship = Friendship.create({
        id: 'friendship-1',
        requesterId: 'user-2',
        addresseeId: 'user-3',
        status: 'ACCEPTED',
        createdAt: new Date(),
      });
      friendshipRepository.findByUsers.mockResolvedValue(mockFriendship);

      await expect(service.removeFriend('user-1', 'user-2')).rejects.toThrow('ERR_FORBIDDEN_NOT_INVOLVED');
    });

    it('should block a user', async () => {
      friendshipRepository.findByUsers.mockResolvedValue(null);

      await service.blockUser('user-1', 'user-2');

      expect(friendshipRepository.save).toHaveBeenCalled();
      const savedFriendship = friendshipRepository.save.mock.calls[0][0];
      expect(savedFriendship.status).toBe('BLOCKED');
    });

    it('should update existing friendship to blocked', async () => {
      const mockFriendship = Friendship.create({
        id: 'friendship-1',
        requesterId: 'user-1',
        addresseeId: 'user-2',
        status: 'ACCEPTED',
        createdAt: new Date(),
      });
      friendshipRepository.findByUsers.mockResolvedValue(mockFriendship);

      await service.blockUser('user-1', 'user-2');

      expect(mockFriendship.status).toBe('BLOCKED');
    });
  });

  describe('Private Message Management', () => {
    it('should send a message to a friend', async () => {
      friendshipRepository.findByUsers.mockResolvedValue({ status: 'ACCEPTED' });

      const messageId = await service.sendMessage(
        'user-1',
        2,
        'user-2',
        'encrypted-content',
        'pub-key',
        'sender-encrypted',
        false,
        false
      );

      expect(messageId).toBeDefined();
      expect(privateMessageRepository.save).toHaveBeenCalled();
      expect(privateMessageRepository.save.mock.calls[0][0].deletedBy).toEqual([]);
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: 'PrivateMessageSentEvent',
          senderId: 'user-1',
          receiverId: 'user-2',
        }),
      );
    });

    it('should throw when sending message to blocked user', async () => {
      friendshipRepository.findByUsers.mockResolvedValue({ status: 'BLOCKED' });

      await expect(service.sendMessage(
        'user-1',
        2,
        'user-2',
        'encrypted-content',
        'pub-key',
        'sender-encrypted',
        false,
        false
      )).rejects.toThrow('ERR_USER_BLOCKED');
    });

    it('should delete a message', async () => {
      const mockMessage = PrivateMessage.create(messageProps(), 2, true, 0);
      privateMessageRepository.findById.mockResolvedValue(mockMessage);
      conversationSettingRepository.findByUsers.mockResolvedValue({ allowTwoSidedDelete: false });

      await service.deleteMessage('msg-1', 'user-1');

      expect(mockMessage.deletedBy).toContain('user-1');
      expect(privateMessageRepository.save).toHaveBeenCalled();
    });

    it('should hard delete a message when allowed', async () => {
      const mockMessage = PrivateMessage.create(messageProps(), 2, true, 0);
      privateMessageRepository.findById.mockResolvedValue(mockMessage);
      conversationSettingRepository.findByUsers.mockResolvedValue({ allowTwoSidedDelete: true });

      await service.deleteMessage('msg-1', 'user-1');

      expect(privateMessageRepository.delete).toHaveBeenCalledWith('msg-1');
    });

    it('should mark messages as read', async () => {
      const mockMessages = [
        PrivateMessage.create({
          ...messageProps(),
          id: 'msg-1',
          encryptedContent: 'content',
          senderEncryptedContent: 'sender-content',
        }, 2, true, 0),
        PrivateMessage.create({
          ...messageProps(),
          id: 'msg-2',
          encryptedContent: 'content2',
          senderEncryptedContent: 'sender-content2',
        }, 2, true, 0),
      ];
      privateMessageRepository.findConversation.mockResolvedValue(mockMessages);

      await service.markAsRead('user-2', 'user-1');

      expect(mockMessages[0].isRead).toBe(true);
      expect(mockMessages[1].isRead).toBe(true);
      expect(privateMessageRepository.save).toHaveBeenCalledTimes(2);
    });

    it('should keep auto-delete messages visible to sender until receiver reads', async () => {
      friendshipRepository.findByUsers.mockResolvedValue({ status: 'ACCEPTED' });

      await service.sendMessage(
        'user-1',
        2,
        'user-2',
        'encrypted-content',
        'pub-key',
        'sender-encrypted',
        false,
        false,
        undefined,
        true
      );

      const savedMessage = privateMessageRepository.save.mock.calls[0][0];
      expect(savedMessage.deletedBy).toEqual([]);
      expect(savedMessage.autoDeleteForSenderAfterRead).toBe(true);
    });

    it('should delete auto-delete message for sender when receiver reads', async () => {
      const mockMessage = PrivateMessage.create(messageProps({
        autoDeleteForSenderAfterRead: true,
      }), 2, true, 0);
      privateMessageRepository.findConversation.mockResolvedValue([mockMessage]);

      await service.markAsRead('user-2', 'user-1');

      expect(mockMessage.deletedBy).toEqual(['user-1']);
      expect(privateMessageRepository.save).toHaveBeenCalledWith(mockMessage);
      expect(eventBus.publish).toHaveBeenCalledWith(expect.objectContaining({
        eventName: 'MessageRemovedEvent',
        targetUserId: 'user-1',
      }));
    });

    it('should start timed message expiration when receiver reads', async () => {
      const mockMessage = PrivateMessage.create(messageProps({
        expiresInMs: 60_000,
      }), 2, true, 0);
      privateMessageRepository.findConversation.mockResolvedValue([mockMessage]);

      await service.markAsRead('user-2', 'user-1');

      expect(mockMessage.expiresStartedAt).toBeInstanceOf(Date);
      expect(mockMessage.expiresAt).toBeInstanceOf(Date);
      expect(mockMessage.expiresAt!.getTime()).toBeGreaterThan(Date.now());
      expect(eventBus.publish).toHaveBeenCalledWith(expect.objectContaining({
        eventName: 'MessageExpiredEvent',
        receiverId: 'user-2',
      }));
    });
  });

  describe('User Keys', () => {
    it('should upload keys for level 2 user', async () => {
      userKeyRepository.findByUserId.mockResolvedValue(null);

      await service.uploadKeys('user-1', 2, 'scheme', 'pub-key', 'encrypted-priv-key');

      expect(userKeyRepository.save).toHaveBeenCalled();
    });

    it('should throw when uploading keys with insufficient level', async () => {
      await expect(service.uploadKeys('user-1', 1, 'scheme', 'pub-key', 'encrypted-priv-key'))
        .rejects.toThrow('ERR_LEVEL_TOO_LOW');
    });

    it('should update existing keys', async () => {
      const mockUserKey = UserKey.create(
        { userId: 'user-1', scheme: 'old', publicKey: 'old-pub', encryptedPrivateKey: 'old-priv' },
        2
      );
      userKeyRepository.findByUserId.mockResolvedValue(mockUserKey);

      await service.uploadKeys('user-1', 2, 'new-scheme', 'new-pub', 'new-priv');

      expect(mockUserKey.scheme).toBe('new-scheme');
      expect(userKeyRepository.save).toHaveBeenCalled();
    });
  });

  describe('Conversation Settings', () => {
    it('should update conversation settings', async () => {
      conversationSettingRepository.findByUsers.mockResolvedValue(null);

      await service.updateConversationSettings('user-1', 'user-2', true);

      expect(conversationSettingRepository.save).toHaveBeenCalled();
      const savedSetting = conversationSettingRepository.save.mock.calls[0][0];
      expect(savedSetting.allowTwoSidedDelete).toBe(true);
    });

    it('should update existing conversation settings', async () => {
      const mockSetting = ConversationSetting.create({ userId: 'user-1', partnerId: 'user-2', allowTwoSidedDelete: false });
      conversationSettingRepository.findByUsers.mockResolvedValue(mockSetting);

      await service.updateConversationSettings('user-1', 'user-2', true);

      expect(mockSetting.allowTwoSidedDelete).toBe(true);
    });
  });
});
