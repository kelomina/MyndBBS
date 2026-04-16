import { PrivateMessage, PrivateMessageProps } from '../../../src/domain/messaging/PrivateMessage';

describe('PrivateMessage Aggregate Root', () => {
  const getValidProps = (): PrivateMessageProps => ({
    id: 'msg-1',
    senderId: 'user-1',
    receiverId: 'user-2',
    ephemeralPublicKey: 'pub-key',
    ephemeralMlKemCiphertext: 'ciphertext',
    encryptedContent: 'encrypted-data',
    senderEncryptedContent: 'sender-encrypted-data',
    isRead: false,
    isSystem: false,
    expiresAt: null,
    deletedBy: [],
    createdAt: new Date('2023-01-01T00:00:00Z'),
  });

  describe('create()', () => {
    it('should create a PrivateMessage successfully when valid parameters are provided', () => {
      const validProps = getValidProps();
      const message = PrivateMessage.create(validProps, 2, true, 0);

      expect(message.id).toBe(validProps.id);
      expect(message.senderId).toBe(validProps.senderId);
      expect(message.receiverId).toBe(validProps.receiverId);
      expect(message.encryptedContent).toBe(validProps.encryptedContent);
      expect(message.isRead).toBe(validProps.isRead);
      expect(message.deletedBy).toEqual(validProps.deletedBy);
    });

    it('should throw an error if senderId is missing', () => {
      const invalidProps = { ...getValidProps(), senderId: '' };
      expect(() => PrivateMessage.create(invalidProps, 2, true, 0)).toThrow('ERR_MESSAGE_MISSING_REQUIRED_FIELDS');
    });

    it('should throw an error if receiverId is missing', () => {
      const invalidProps = { ...getValidProps(), receiverId: '' };
      expect(() => PrivateMessage.create(invalidProps, 2, true, 0)).toThrow('ERR_MESSAGE_MISSING_REQUIRED_FIELDS');
    });

    it('should throw an error if encryptedContent is missing', () => {
      const invalidProps = { ...getValidProps(), encryptedContent: '' };
      expect(() => PrivateMessage.create(invalidProps, 2, true, 0)).toThrow('ERR_MESSAGE_MISSING_REQUIRED_FIELDS');
    });

    it('should throw an error if senderLevel is less than 2', () => {
      expect(() => PrivateMessage.create(getValidProps(), 1, true, 0)).toThrow('ERR_LEVEL_TOO_LOW');
      expect(() => PrivateMessage.create(getValidProps(), 0, true, 0)).toThrow('ERR_LEVEL_TOO_LOW');
    });

    it('should throw an error if not friend and sentCountToNonFriend is 3 or more', () => {
      expect(() => PrivateMessage.create(getValidProps(), 2, false, 3)).toThrow('ERR_FRIEND_REQUIRED_LIMIT_REACHED');
      expect(() => PrivateMessage.create(getValidProps(), 2, false, 4)).toThrow('ERR_FRIEND_REQUIRED_LIMIT_REACHED');
    });

    it('should create successfully if not friend but sentCountToNonFriend is less than 3', () => {
      const validProps = getValidProps();
      const message = PrivateMessage.create(validProps, 2, false, 2);
      expect(message.id).toBe(validProps.id);
    });
  });

  describe('load()', () => {
    it('should reconstitute a PrivateMessage entity from existing props', () => {
      const validProps = getValidProps();
      const existingProps: PrivateMessageProps = {
        ...validProps,
        isRead: true,
        deletedBy: ['user-1'],
      };

      const message = PrivateMessage.load(existingProps);

      expect(message.id).toBe(existingProps.id);
      expect(message.isRead).toBe(true);
      expect(message.deletedBy).toEqual(['user-1']);
    });
  });

  describe('markAsRead()', () => {
    it('should mark the message as read if called by the receiver', () => {
      const message = PrivateMessage.create(getValidProps(), 2, true, 0);
      expect(message.isRead).toBe(false);

      message.markAsRead('user-2');
      expect(message.isRead).toBe(true);
    });

    it('should throw an error if called by someone other than the receiver', () => {
      const message = PrivateMessage.create(getValidProps(), 2, true, 0);
      expect(() => message.markAsRead('user-1')).toThrow('ERR_FORBIDDEN_NOT_RECEIVER');
      expect(() => message.markAsRead('user-3')).toThrow('ERR_FORBIDDEN_NOT_RECEIVER');
    });

    it('should throw an error if the message is already read', () => {
      const message = PrivateMessage.load({ ...getValidProps(), isRead: true });
      expect(() => message.markAsRead('user-2')).toThrow('ERR_MESSAGE_ALREADY_READ');
    });
  });

  describe('deleteForUser()', () => {
    it('should throw an error if called by someone who is neither sender nor receiver', () => {
      const message = PrivateMessage.create(getValidProps(), 2, true, 0);
      expect(() => message.deleteForUser('user-3')).toThrow('ERR_FORBIDDEN_NOT_PARTICIPANT');
    });

    it('should return true (hard delete) if isHardDeleteAllowed is true and called by sender', () => {
      const message = PrivateMessage.create(getValidProps(), 2, true, 0);
      const isHardDelete = message.deleteForUser('user-1', true);
      expect(isHardDelete).toBe(true);
      // deletedBy should not be updated since we returned true immediately
      expect(message.deletedBy).toEqual([]);
    });

    it('should soft delete (return false) if isHardDeleteAllowed is false and called by sender', () => {
      const message = PrivateMessage.create(getValidProps(), 2, true, 0);
      const isHardDelete = message.deleteForUser('user-1', false);
      expect(isHardDelete).toBe(false);
      expect(message.deletedBy).toContain('user-1');
    });

    it('should soft delete (return false) if called by receiver', () => {
      const message = PrivateMessage.create(getValidProps(), 2, true, 0);
      const isHardDelete = message.deleteForUser('user-2');
      expect(isHardDelete).toBe(false);
      expect(message.deletedBy).toContain('user-2');
    });

    it('should not add user to deletedBy twice', () => {
      const message = PrivateMessage.load({ ...getValidProps(), deletedBy: ['user-1'] });
      const isHardDelete = message.deleteForUser('user-1');
      expect(isHardDelete).toBe(false);
      expect(message.deletedBy).toEqual(['user-1']);
    });

    it('should return true (hard delete) if both sender and receiver have deleted it', () => {
      const message = PrivateMessage.create(getValidProps(), 2, true, 0);
      
      // Sender deletes
      let isHardDelete = message.deleteForUser('user-1');
      expect(isHardDelete).toBe(false);
      expect(message.deletedBy).toContain('user-1');

      // Receiver deletes
      isHardDelete = message.deleteForUser('user-2');
      expect(isHardDelete).toBe(true);
      expect(message.deletedBy).toContain('user-1');
      expect(message.deletedBy).toContain('user-2');
    });
  });
});
