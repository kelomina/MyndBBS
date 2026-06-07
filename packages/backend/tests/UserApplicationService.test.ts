import { UserApplicationService } from '../src/application/identity/UserApplicationService';
import { User } from '../src/domain/identity/User';
import { UserStatus } from '@myndbbs/shared';

describe('UserApplicationService', () => {
  let service: UserApplicationService;
  let userRepository: {
    findById: jest.Mock;
    findByEmail: jest.Mock;
    findByUsername: jest.Mock;
    save: jest.Mock;
  };
  let passkeyRepository: { findByUserId: jest.Mock };
  let abilityCache: { invalidateUserRules: jest.Mock };
  let passwordHasher: Record<string, never>;
  let totpPort: Record<string, never>;
  let storagePort: { saveAvatar: jest.Mock; deleteAvatar: jest.Mock };
  let unitOfWork: { execute: jest.Mock };

  beforeEach(() => {
    userRepository = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      findByUsername: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined)
    };
    passkeyRepository = {
      findByUserId: jest.fn().mockResolvedValue([])
    };
    abilityCache = {
      invalidateUserRules: jest.fn().mockResolvedValue(undefined)
    };
    passwordHasher = {};
    totpPort = {};
    storagePort = {
      saveAvatar: jest.fn().mockResolvedValue('/uploads/avatars/12345678-1234-5678-1234-567812345678.png'),
      deleteAvatar: jest.fn().mockResolvedValue(undefined)
    };
    unitOfWork = {
      execute: jest.fn().mockImplementation((work) => work())
    };

    service = new UserApplicationService({
      userRepository,
      passkeyRepository,
      abilityCache,
      passwordHasher,
      totpPort,
      unitOfWork,
      storagePort,
    } as any);
  });

  describe('updateProfile', () => {
    it('should update user profile with email and username', async () => {
      const user = User.create({
        id: 'user-1',
        email: 'old@example.com',
        username: 'olduser',
        password: 'hashed-pwd',
        roleId: 'role-1',
        level: 1,
        status: UserStatus.ACTIVE,
        isPasskeyMandatory: false,
        totpSecret: null,
        isTotpEnabled: false,
        createdAt: new Date()
      });
      
      userRepository.findById.mockResolvedValue(user);
      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.findByUsername.mockResolvedValue(null);

      const result = await service.updateProfile('user-1', 'new@example.com', 'newuser');

      expect(result).toEqual({
        id: 'user-1',
        email: 'new@example.com',
        username: 'newuser',
        roleId: 'role-1'
      });
      expect(userRepository.save).toHaveBeenCalledTimes(1);
    });

    it('should throw error if user not found', async () => {
      userRepository.findById.mockResolvedValue(null);

      await expect(service.updateProfile('user-1', 'new@example.com'))
        .rejects.toThrow('ERR_USER_NOT_FOUND');
    });

    it('should throw error if email already in use', async () => {
      const user = User.create({
        id: 'user-1',
        email: 'old@example.com',
        username: 'user1',
        password: 'hashed-pwd',
        roleId: 'role-1',
        level: 1,
        status: UserStatus.ACTIVE,
        isPasskeyMandatory: false,
        totpSecret: null,
        isTotpEnabled: false,
        createdAt: new Date()
      });
      
      userRepository.findById.mockResolvedValue(user);
      userRepository.findByEmail.mockResolvedValue({ id: 'user-2' });

      await expect(service.updateProfile('user-1', 'existing@example.com'))
        .rejects.toThrow('ERR_EMAIL_ALREADY_IN_USE');
    });

    it('should throw error if username already in use', async () => {
      const user = User.create({
        id: 'user-1',
        email: 'user@example.com',
        username: 'user1',
        password: 'hashed-pwd',
        roleId: 'role-1',
        level: 1,
        status: UserStatus.ACTIVE,
        isPasskeyMandatory: false,
        totpSecret: null,
        isTotpEnabled: false,
        createdAt: new Date()
      });
      
      userRepository.findById.mockResolvedValue(user);
      userRepository.findByUsername.mockResolvedValue({ id: 'user-2' });

      await expect(service.updateProfile('user-1', undefined, 'existinguser'))
        .rejects.toThrow('ERR_USERNAME_ALREADY_IN_USE');
    });
  });

  describe('enableTotp', () => {
    it('should enable TOTP for user', async () => {
      const user = User.create({
        id: 'user-1',
        email: 'user@example.com',
        username: 'user1',
        password: 'hashed-pwd',
        roleId: 'role-1',
        level: 1,
        status: UserStatus.ACTIVE,
        isPasskeyMandatory: false,
        totpSecret: null,
        isTotpEnabled: false,
        createdAt: new Date()
      });
      
      userRepository.findById.mockResolvedValue(user);

      await service.enableTotp('user-1', 'secret');

      expect(user.isTotpEnabled).toBe(true);
      expect(userRepository.save).toHaveBeenCalledTimes(1);
    });

    it('should throw error if user not found', async () => {
      userRepository.findById.mockResolvedValue(null);

      await expect(service.enableTotp('user-1', 'secret'))
        .rejects.toThrow('ERR_USER_NOT_FOUND');
    });
  });

  describe('disableTotp', () => {
    it('should disable TOTP for user', async () => {
      const user = User.create({
        id: 'user-1',
        email: 'user@example.com',
        username: 'user1',
        password: 'hashed-pwd',
        roleId: 'role-1',
        level: 1,
        status: UserStatus.ACTIVE,
        isPasskeyMandatory: false,
        totpSecret: 'secret',
        isTotpEnabled: true,
        createdAt: new Date()
      });
      
      userRepository.findById.mockResolvedValue(user);

      await service.disableTotp('user-1');

      expect(user.isTotpEnabled).toBe(false);
      expect(user.totpSecret).toBeNull();
      expect(userRepository.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('changeRole', () => {
    it('should change user role and invalidate cache', async () => {
      const user = User.create({
        id: 'user-1',
        email: 'user@example.com',
        username: 'user1',
        password: 'hashed-pwd',
        roleId: 'role-1',
        level: 1,
        status: UserStatus.ACTIVE,
        isPasskeyMandatory: false,
        totpSecret: null,
        isTotpEnabled: false,
        createdAt: new Date()
      });
      
      userRepository.findById.mockResolvedValue(user);

      await service.changeRole('user-1', 'role-2');

      expect(user.roleId).toBe('role-2');
      expect(userRepository.save).toHaveBeenCalledTimes(1);
      expect(abilityCache.invalidateUserRules).toHaveBeenCalledWith('user-1');
    });

    it('should allow setting role to null', async () => {
      const user = User.create({
        id: 'user-1',
        email: 'user@example.com',
        username: 'user1',
        password: 'hashed-pwd',
        roleId: 'role-1',
        level: 1,
        status: UserStatus.ACTIVE,
        isPasskeyMandatory: false,
        totpSecret: null,
        isTotpEnabled: false,
        createdAt: new Date()
      });
      
      userRepository.findById.mockResolvedValue(user);

      await service.changeRole('user-1', null);

      expect(user.roleId).toBeNull();
    });
  });

  describe('changeLevel', () => {
    it('should change user level when passkey exists', async () => {
      const user = User.create({
        id: 'user-1',
        email: 'user@example.com',
        username: 'user1',
        password: 'hashed-pwd',
        roleId: 'role-1',
        level: 1,
        status: UserStatus.ACTIVE,
        isPasskeyMandatory: false,
        totpSecret: null,
        isTotpEnabled: false,
        createdAt: new Date()
      });
      
      userRepository.findById.mockResolvedValue(user);
      passkeyRepository.findByUserId.mockResolvedValue([{ id: 'key-1' }]);

      await service.changeLevel('user-1', 2);

      expect(user.level).toBe(2);
      expect(userRepository.save).toHaveBeenCalledTimes(1);
    });

    it('should throw error when promoting to level 2 without passkey', async () => {
      const user = User.create({
        id: 'user-1',
        email: 'user@example.com',
        username: 'user1',
        password: 'hashed-pwd',
        roleId: 'role-1',
        level: 1,
        status: UserStatus.ACTIVE,
        isPasskeyMandatory: false,
        totpSecret: null,
        isTotpEnabled: false,
        createdAt: new Date()
      });
      
      userRepository.findById.mockResolvedValue(user);
      passkeyRepository.findByUserId.mockResolvedValue([]);

      await expect(service.changeLevel('user-1', 2))
        .rejects.toThrow();
    });
  });

  describe('changeStatus', () => {
    it('should change user status and invalidate cache', async () => {
      const user = User.create({
        id: 'user-1',
        email: 'user@example.com',
        username: 'user1',
        password: 'hashed-pwd',
        roleId: 'role-1',
        level: 1,
        status: UserStatus.ACTIVE,
        isPasskeyMandatory: false,
        totpSecret: null,
        isTotpEnabled: false,
        createdAt: new Date()
      });
      
      userRepository.findById.mockResolvedValue(user);

      await service.changeStatus('user-1', UserStatus.BANNED);

      expect(user.status).toBe(UserStatus.BANNED);
      expect(abilityCache.invalidateUserRules).toHaveBeenCalledWith('user-1');
    });
  });

  describe('updateAvatar', () => {
    it('should update user avatar', async () => {
      const user = User.create({
        id: 'user-1',
        email: 'user@example.com',
        username: 'user1',
        password: 'hashed-pwd',
        roleId: 'role-1',
        level: 1,
        status: UserStatus.ACTIVE,
        isPasskeyMandatory: false,
        totpSecret: null,
        isTotpEnabled: false,
        createdAt: new Date()
      });
      
      userRepository.findById.mockResolvedValue(user);

      const expectedAvatarUrl = '/uploads/avatars/12345678-1234-5678-1234-567812345678.png';
      const result = await service.updateAvatar('user-1', Buffer.from('image-data'), 'png');

      expect(result).toBe(expectedAvatarUrl);
      expect(user.avatarUrl).toBe(expectedAvatarUrl);
      expect(storagePort.saveAvatar).toHaveBeenCalled();
    });

    it('should delete old avatar when updating', async () => {
      const user = User.create({
        id: 'user-1',
        email: 'user@example.com',
        username: 'user1',
        password: 'hashed-pwd',
        roleId: 'role-1',
        level: 1,
        status: UserStatus.ACTIVE,
        isPasskeyMandatory: false,
        totpSecret: null,
        isTotpEnabled: false,
        avatarUrl: '/uploads/avatars/old-avatar-uuid.png',
        createdAt: new Date()
      });
      
      userRepository.findById.mockResolvedValue(user);

      await service.updateAvatar('user-1', Buffer.from('image-data'), 'png');

      expect(storagePort.deleteAvatar).toHaveBeenCalledWith('/uploads/avatars/old-avatar-uuid.png');
    });
  });

  describe('removeAvatar', () => {
    it('should remove user avatar', async () => {
      const user = User.create({
        id: 'user-1',
        email: 'user@example.com',
        username: 'user1',
        password: 'hashed-pwd',
        roleId: 'role-1',
        level: 1,
        status: UserStatus.ACTIVE,
        isPasskeyMandatory: false,
        totpSecret: null,
        isTotpEnabled: false,
        avatarUrl: '/uploads/avatars/existing-avatar-uuid.png',
        createdAt: new Date()
      });
      
      userRepository.findById.mockResolvedValue(user);

      await service.removeAvatar('user-1');

      expect(user.avatarUrl).toBeNull();
      expect(storagePort.deleteAvatar).toHaveBeenCalled();
    });
  });
});
