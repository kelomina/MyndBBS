import { UserKey, UserKeyProps } from '../src/domain/messaging/UserKey';

describe('UserKey Aggregate Root', () => {
  const validProps: UserKeyProps = {
    userId: 'user-123',
    scheme: 'RSA_OAEP',
    publicKey: 'pub-key-123',
    encryptedPrivateKey: 'enc-priv-key-123',
    mlKemPublicKey: null,
    encryptedMlKemPrivateKey: null,
  };

  describe('create', () => {
    it('should create a UserKey when all required fields and conditions are met', () => {
      const userKey = UserKey.create(validProps, 1);
      
      expect(userKey.userId).toBe(validProps.userId);
      expect(userKey.scheme).toBe(validProps.scheme);
      expect(userKey.publicKey).toBe(validProps.publicKey);
      expect(userKey.encryptedPrivateKey).toBe(validProps.encryptedPrivateKey);
      expect(userKey.mlKemPublicKey).toBeNull();
      expect(userKey.encryptedMlKemPrivateKey).toBeNull();
    });

    it('should throw ERR_USER_KEY_MISSING_REQUIRED_FIELDS if required fields are missing', () => {
      const invalidProps = { ...validProps, publicKey: '' };
      
      expect(() => {
        UserKey.create(invalidProps, 1);
      }).toThrow('ERR_USER_KEY_MISSING_REQUIRED_FIELDS');
    });

    it('should throw ERR_LEVEL_TOO_LOW_FOR_X_WING if scheme is X_WING_HYBRID and userLevel is < 4', () => {
      const xWingProps = { ...validProps, scheme: 'X_WING_HYBRID' };
      
      expect(() => {
        UserKey.create(xWingProps, 3);
      }).toThrow('ERR_LEVEL_TOO_LOW_FOR_X_WING');
    });

    it('should create a UserKey if scheme is X_WING_HYBRID and userLevel is >= 4', () => {
      const xWingProps = { ...validProps, scheme: 'X_WING_HYBRID' };
      
      const userKey = UserKey.create(xWingProps, 4);
      expect(userKey.scheme).toBe('X_WING_HYBRID');
    });
  });

  describe('load', () => {
    it('should load a UserKey without validation', () => {
      // Intentionally missing some required fields that would fail in `create`
      const incompleteProps = {
        userId: 'user-123',
        scheme: 'X_WING_HYBRID',
        publicKey: '',
        encryptedPrivateKey: '',
        mlKemPublicKey: null,
        encryptedMlKemPrivateKey: null,
      };

      const userKey = UserKey.load(incompleteProps);
      expect(userKey.userId).toBe('user-123');
      expect(userKey.scheme).toBe('X_WING_HYBRID');
      expect(userKey.publicKey).toBe('');
    });
  });

  describe('updateKeys', () => {
    let userKey: UserKey;

    beforeEach(() => {
      userKey = UserKey.create(validProps, 1);
    });

    it('should update keys when all required fields and conditions are met', () => {
      userKey.updateKeys('ECDH', 'new-pub-key', 'new-enc-priv-key', null, null, 1);
      
      expect(userKey.scheme).toBe('ECDH');
      expect(userKey.publicKey).toBe('new-pub-key');
      expect(userKey.encryptedPrivateKey).toBe('new-enc-priv-key');
    });

    it('should throw ERR_USER_KEY_MISSING_REQUIRED_FIELDS if required fields are missing', () => {
      expect(() => {
        userKey.updateKeys('ECDH', '', 'new-enc-priv-key', null, null, 1);
      }).toThrow('ERR_USER_KEY_MISSING_REQUIRED_FIELDS');
    });

    it('should throw ERR_LEVEL_TOO_LOW_FOR_X_WING if scheme is X_WING_HYBRID and userLevel is < 4', () => {
      expect(() => {
        userKey.updateKeys('X_WING_HYBRID', 'new-pub-key', 'new-enc-priv-key', 'ml-pub', 'ml-priv', 3);
      }).toThrow('ERR_LEVEL_TOO_LOW_FOR_X_WING');
    });

    it('should update keys if scheme is X_WING_HYBRID and userLevel is >= 4', () => {
      userKey.updateKeys('X_WING_HYBRID', 'new-pub-key', 'new-enc-priv-key', 'ml-pub', 'ml-priv', 4);
      
      expect(userKey.scheme).toBe('X_WING_HYBRID');
      expect(userKey.mlKemPublicKey).toBe('ml-pub');
      expect(userKey.encryptedMlKemPrivateKey).toBe('ml-priv');
    });
  });
});
