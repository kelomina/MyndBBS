import { SudoApplicationService } from '../src/application/identity/SudoApplicationService';

const mockGenerateAuthenticationOptions = jest.fn();
const mockVerifyAuthenticationResponse = jest.fn();

jest.mock('argon2', () => ({
  verify: jest.fn().mockResolvedValue(true),
}));

jest.mock('@simplewebauthn/server', () => ({
  generateAuthenticationOptions: (...args: any[]) => mockGenerateAuthenticationOptions(...args),
  verifyAuthenticationResponse: (...args: any[]) => mockVerifyAuthenticationResponse(...args),
}));

class FakeIdentityQueryService {
  public passkeys: any[] = [];
  public passkeyRecord: any = null;
  async listUserPasskeyIds() { return this.passkeys; }
  async getUserWithRoleById() { return { password: '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQ$J9g1A4r9XHq5VYb5m4mCkH8Qx4bJ5mC7rYb0T9m0lY0', totpSecret: null }; }
  async getPasskeyById() { return this.passkeyRecord; }
}

class FakeAuthApplicationService {
  async generateAuthChallenge(ch: string) { return { id: 'c1', challenge: ch }; }
  async consumeAuthChallenge() { return { id: 'c1', challenge: 'x' }; }
  async updatePasskeyCounter() {}
}

class FakeSudoStore {
  public granted: string[] = [];
  async grant(sessionId: string) { this.granted.push(sessionId); }
  async check() { return false; }
}

describe('SudoApplicationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGenerateAuthenticationOptions.mockResolvedValue({ challenge: 'challenge-1' });
    mockVerifyAuthenticationResponse.mockResolvedValue({
      verified: true,
      authenticationInfo: { newCounter: 2 },
    });
  });

  it('grants sudo when password is valid', async () => {
    const store = new FakeSudoStore();
    const svc = new SudoApplicationService({
      userSecurityReadModel: new FakeIdentityQueryService() as any,
      authApplicationService: new FakeAuthApplicationService() as any,
      sudoStore: store as any,
      getRpID: () => 'localhost',
      getOrigin: () => 'http://localhost:3000',
      totpPort: { verify: jest.fn().mockReturnValue(false) } as any,
    });

    await svc.verify('u1', 's1', { type: 'password', password: 'password' });
    expect(store.granted).toEqual(['s1']);
  });

  it('requires user verification for sudo passkey options', async () => {
    const readModel = new FakeIdentityQueryService();
    readModel.passkeys = [{ id: 'passkey-1' }];
    const svc = new SudoApplicationService({
      userSecurityReadModel: readModel as any,
      authApplicationService: new FakeAuthApplicationService() as any,
      sudoStore: new FakeSudoStore() as any,
      getRpID: () => 'localhost',
      getOrigin: () => 'http://localhost:3000',
      totpPort: { verify: jest.fn().mockReturnValue(false) } as any,
    });

    await svc.getPasskeyOptions('u1');

    expect(mockGenerateAuthenticationOptions).toHaveBeenCalledWith(
      expect.objectContaining({ userVerification: 'required' }),
    );
  });

  it('requires verified device user presence when sudo passkey is checked', async () => {
    const readModel = new FakeIdentityQueryService();
    readModel.passkeyRecord = {
      id: 'passkey-1',
      userId: 'u1',
      publicKey: [1, 2, 3],
      counter: BigInt(1),
    };
    const svc = new SudoApplicationService({
      userSecurityReadModel: readModel as any,
      authApplicationService: new FakeAuthApplicationService() as any,
      sudoStore: new FakeSudoStore() as any,
      getRpID: () => 'localhost',
      getOrigin: () => 'http://localhost:3000',
      totpPort: { verify: jest.fn().mockReturnValue(false) } as any,
    });

    await svc.verify('u1', 's1', {
      type: 'passkey',
      challengeId: 'c1',
      passkeyResponse: { id: 'passkey-1' },
    });

    expect(mockVerifyAuthenticationResponse).toHaveBeenCalledWith(
      expect.objectContaining({ requireUserVerification: true }),
    );
  });
});
