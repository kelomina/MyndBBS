import { PasskeyAdapter } from '../../src/infrastructure/services/identity/PasskeyAdapter';

const mockGenerateRegistrationOptions = jest.fn();
const mockGenerateAuthenticationOptions = jest.fn();
const mockVerifyRegistrationResponse = jest.fn();
const mockVerifyAuthenticationResponse = jest.fn();

jest.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: (...args: any[]) => mockGenerateRegistrationOptions(...args),
  verifyRegistrationResponse: (...args: any[]) => mockVerifyRegistrationResponse(...args),
  generateAuthenticationOptions: (...args: any[]) => mockGenerateAuthenticationOptions(...args),
  verifyAuthenticationResponse: (...args: any[]) => mockVerifyAuthenticationResponse(...args),
}));

beforeEach(() => {
  mockGenerateRegistrationOptions.mockImplementation((options) => ({
    rp: { name: options.rpName, id: options.rpID },
    user: { id: options.userID, name: options.userName, displayName: options.userName },
    challenge: 'test-challenge',
    pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
    timeout: 60000,
    excludeCredentials: options.excludeCredentials || [],
    authenticatorSelection: {
      authenticatorAttachment: undefined,
      residentKey: 'required',
      requireResidentKey: true,
      userVerification: 'preferred',
    },
    attestation: 'none',
    extensions: {},
  }));

  mockGenerateAuthenticationOptions.mockImplementation((options) => ({
    rpId: options.rpID,
    challenge: 'auth-challenge',
    timeout: 60000,
    userVerification: 'preferred',
    allowCredentials: options.allowCredentials || [],
    extensions: {},
  }));

  mockVerifyRegistrationResponse.mockResolvedValue({
    verified: true,
    registrationInfo: {
      credentialID: new Uint8Array([1, 2, 3, 4]),
      counter: 0,
      aaguid: 'test-aaguid',
      credentialPublicKey: new Uint8Array([5, 6, 7, 8]),
      attestationObject: new Uint8Array([9, 10, 11, 12]),
      userAgent: 'test-agent',
    },
  });

  mockVerifyAuthenticationResponse.mockResolvedValue({
    verified: true,
    authenticationInfo: {
      newCounter: 1,
      credentialID: new Uint8Array([1, 2, 3, 4]),
      authenticatorData: new Uint8Array([13, 14, 15, 16]),
      userVerified: true,
    },
  });
});

describe('PasskeyAdapter', () => {
  let adapter: PasskeyAdapter;
  const originalRPId = process.env.RP_ID;

  beforeEach(() => {
    adapter = new PasskeyAdapter();
    process.env.RP_ID = 'test.example.com';
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (originalRPId) {
      process.env.RP_ID = originalRPId;
    } else {
      delete process.env.RP_ID;
    }
  });

  describe('generateRegistrationOptions', () => {
    it('should generate registration options with correct RP name', async () => {
      const user = { id: 'user-123', email: 'test@example.com' };
      const excludeCredentials: any[] = [];

      const options = await adapter.generateRegistrationOptions(user, excludeCredentials);

      expect(options).toBeDefined();
      expect(options.rp).toBeDefined();
      expect(options.rp.name).toBe('MyndBBS');
    });

    it('should generate registration options with user ID and email', async () => {
      const user = { id: 'user-456', email: 'user@example.com' };
      const excludeCredentials: any[] = [];

      const options = await adapter.generateRegistrationOptions(user, excludeCredentials);

      expect(options.user).toBeDefined();
      expect(options.user.name).toBe('user@example.com');
    });

    it('should set residentKey to required', async () => {
      const user = { id: 'user-789', email: 'test@example.com' };
      const excludeCredentials: any[] = [];

      const options = await adapter.generateRegistrationOptions(user, excludeCredentials);

      expect(options.authenticatorSelection).toBeDefined();
      expect(options.authenticatorSelection.residentKey).toBe('required');
      expect(options.authenticatorSelection.requireResidentKey).toBe(true);
    });

    it('should set userVerification to preferred', async () => {
      const user = { id: 'user-101', email: 'test@example.com' };
      const excludeCredentials: any[] = [];

      const options = await adapter.generateRegistrationOptions(user, excludeCredentials);

      expect(options.authenticatorSelection).toBeDefined();
      expect(options.authenticatorSelection.userVerification).toBe('preferred');
    });

    it('should use RP_ID from environment', async () => {
      process.env.RP_ID = 'custom.example.com';
      const user = { id: 'user-202', email: 'test@example.com' };

      const options = await adapter.generateRegistrationOptions(user, []);

      expect(options.rp.id).toBe('custom.example.com');
    });

    it('should default to localhost when RP_ID not set', async () => {
      delete process.env.RP_ID;
      const user = { id: 'user-303', email: 'test@example.com' };

      const options = await adapter.generateRegistrationOptions(user, []);

      expect(options.rp.id).toBe('localhost');
    });

    it('should call simplewebauthn with correct parameters', async () => {
      const user = { id: 'user-404', email: 'test@example.com' };
      const excludeCredentials = [{ id: new Uint8Array([1, 2]), type: 'public-key' }];

      await adapter.generateRegistrationOptions(user, excludeCredentials);

      expect(mockGenerateRegistrationOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          rpName: 'MyndBBS',
          rpID: 'test.example.com',
          userName: 'test@example.com',
          excludeCredentials,
        })
      );
    });
  });

  describe('verifyRegistrationResponse', () => {
    it('should verify registration response successfully', async () => {
      const response = { id: 'credential-id' };
      const expectedChallenge = 'test-challenge';
      const expectedOrigin = 'https://test.example.com';
      const expectedRPID = 'test.example.com';

      const result = await adapter.verifyRegistrationResponse(
        response,
        expectedChallenge,
        expectedOrigin,
        expectedRPID
      );

      expect(result.verified).toBe(true);
      expect(result.registrationInfo).toBeDefined();
    });

    it('should call verifyRegistrationResponse with correct parameters', async () => {
      const response = { id: 'credential-id' };

      await adapter.verifyRegistrationResponse(
        response,
        'challenge-123',
        'https://origin.com',
        'rp-id.com'
      );

      expect(mockVerifyRegistrationResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          response,
          expectedChallenge: 'challenge-123',
          expectedOrigin: 'https://origin.com',
          expectedRPID: 'rp-id.com',
          requireUserVerification: false,
        })
      );
    });
  });

  describe('generateAuthenticationOptions', () => {
    it('should generate authentication options', async () => {
      const allowCredentials: any[] = [];

      const options = await adapter.generateAuthenticationOptions(allowCredentials);

      expect(options).toBeDefined();
      expect(options.rpId).toBeDefined();
    });

    it('should use RP_ID from environment', async () => {
      process.env.RP_ID = 'auth.example.com';

      const options = await adapter.generateAuthenticationOptions([]);

      expect(options.rpId).toBe('auth.example.com');
    });

    it('should set userVerification to preferred', async () => {
      const options = await adapter.generateAuthenticationOptions([]);

      expect(options.userVerification).toBe('preferred');
    });

    it('should call simplewebauthn with correct parameters', async () => {
      const credentials = [{ id: new Uint8Array([1, 2]), type: 'public-key' }];

      await adapter.generateAuthenticationOptions(credentials);

      expect(mockGenerateAuthenticationOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          rpID: 'test.example.com',
          allowCredentials: credentials,
          userVerification: 'preferred',
        })
      );
    });
  });

  describe('verifyAuthenticationResponse', () => {
    it('should verify authentication response successfully', async () => {
      const response = { id: 'credential-id' };
      const credential = { id: 'credential-id' };

      const result = await adapter.verifyAuthenticationResponse(
        response,
        'challenge-456',
        'https://auth.example.com',
        'auth.example.com',
        credential
      );

      expect(result.verified).toBe(true);
      expect(result.authenticationInfo).toBeDefined();
    });

    it('should call verifyAuthenticationResponse with correct parameters', async () => {
      const response = { id: 'credential-id' };
      const credential = { id: 'credential-id' };

      await adapter.verifyAuthenticationResponse(
        response,
        'challenge-789',
        'https://verify.com',
        'verify.com',
        credential
      );

      expect(mockVerifyAuthenticationResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          response,
          expectedChallenge: 'challenge-789',
          expectedOrigin: 'https://verify.com',
          expectedRPID: 'verify.com',
          credential,
        })
      );
    });
  });
});
