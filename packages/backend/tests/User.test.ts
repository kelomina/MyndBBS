import { User } from '../src/domain/identity/User';
import { UserStatus } from '@myndbbs/shared';

describe('User Domain Entity', () => {
  const defaultProps = {
    id: 'user-123',
    email: 'test@example.com',
    username: 'testuser',
    password: 'hashedpassword',
    roleId: null,
    status: UserStatus.ACTIVE,
    level: 1,
    isPasskeyMandatory: false,
    totpSecret: null,
    isTotpEnabled: false,
    createdAt: new Date(),
  };

  it('should create a User with valid properties', () => {
    const user = User.create(defaultProps);
    expect(user.id).toBe(defaultProps.id);
    expect(user.email).toBe(defaultProps.email);
    expect(user.username).toBe(defaultProps.username);
    expect(user.password).toBe(defaultProps.password);
    expect(user.roleId).toBe(defaultProps.roleId);
    expect(user.status).toBe(defaultProps.status);
    expect(user.level).toBe(defaultProps.level);
    expect(user.isPasskeyMandatory).toBe(defaultProps.isPasskeyMandatory);
    expect(user.totpSecret).toBe(defaultProps.totpSecret);
    expect(user.isTotpEnabled).toBe(defaultProps.isTotpEnabled);
    expect(user.createdAt).toBe(defaultProps.createdAt);
  });

  describe('updateProfile', () => {
    it('should update email, username, and password when provided', () => {
      const user = User.create(defaultProps);
      user.updateProfile('new@example.com', 'newuser', 'newhashedpassword');
      expect(user.email).toBe('new@example.com');
      expect(user.username).toBe('newuser');
      expect(user.password).toBe('newhashedpassword');
    });

    it('should only update provided fields', () => {
      const user = User.create(defaultProps);
      user.updateProfile('new@example.com');
      expect(user.email).toBe('new@example.com');
      expect(user.username).toBe('testuser'); // Unchanged
      expect(user.password).toBe('hashedpassword'); // Unchanged
    });
  });

  describe('TOTP management', () => {
    it('should enable TOTP with a secret', () => {
      const user = User.create(defaultProps);
      user.enableTotp('my-secret');
      expect(user.totpSecret).toBe('my-secret');
      expect(user.isTotpEnabled).toBe(true);
    });

    it('should throw an error when enabling TOTP without a secret', () => {
      const user = User.create(defaultProps);
      expect(() => user.enableTotp('')).toThrow('ERR_TOTP_SECRET_REQUIRED');
    });

    it('should disable TOTP', () => {
      const user = User.create({ ...defaultProps, totpSecret: 'my-secret', isTotpEnabled: true });
      user.disableTotp();
      expect(user.totpSecret).toBeNull();
      expect(user.isTotpEnabled).toBe(false);
    });
  });

  describe('Role management', () => {
    it('should change role', () => {
      const user = User.create(defaultProps);
      user.changeRole('role-123');
      expect(user.roleId).toBe('role-123');
      user.changeRole(null);
      expect(user.roleId).toBeNull();
    });
  });

  describe('Level management', () => {
    it('should change level within valid bounds', () => {
      const user = User.create(defaultProps);
      user.changeLevel(3);
      expect(user.level).toBe(3);
      user.changeLevel(6);
      expect(user.level).toBe(6);
    });

    it('should throw an error when changing level out of bounds', () => {
      const user = User.create(defaultProps);
      expect(() => user.changeLevel(0)).toThrow('ERR_LEVEL_OUT_OF_BOUNDS');
      expect(() => user.changeLevel(7)).toThrow('ERR_LEVEL_OUT_OF_BOUNDS');
    });
  });

  describe('Status management', () => {
    it('should change status', () => {
      const user = User.create(defaultProps);
      user.changeStatus(UserStatus.BANNED);
      expect(user.status).toBe(UserStatus.BANNED);
    });
  });
});
