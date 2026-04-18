import { SudoApplicationService } from '../src/application/identity/SudoApplicationService';

class FakeIdentityQueryService {
  async listUserPasskeyIds() { return []; }
  async getUserWithRoleById() { return { password: 'hashed', totpSecret: null }; }
  async getPasskeyById() { return null; }
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

class FakePasswordHasher {
  async verify(hash: string, plain: string) { return true; }
  async hash(plain: string) { return 'hashed'; }
}

class FakeTotpPort {
  generateSecret() { return 'secret'; }
  generateURI() { return 'uri'; }
  async generateQRCode() { return 'qrcode'; }
  verify() { return true; }
}

class FakePasskeyPort {
  async generateRegistrationOptions() { return {}; }
  async verifyRegistrationResponse() { return { verified: true }; }
  async generateAuthenticationOptions() { return { challenge: 'x' }; }
  async verifyAuthenticationResponse() { return { verified: true }; }
}

describe('SudoApplicationService', () => {
  it('grants sudo when password is valid', async () => {
    const store = new FakeSudoStore();
    const svc = new SudoApplicationService(
      new FakeIdentityQueryService() as any,
      new FakeAuthApplicationService() as any,
      store as any,
      new FakePasswordHasher(),
      new FakeTotpPort(),
      new FakePasskeyPort(),
      'localhost',
      'http://localhost:3000'
    );

    await svc.verify('u1', 's1', { type: 'password', password: 'password' });
    expect(store.granted).toEqual(['s1']);
  });
});
