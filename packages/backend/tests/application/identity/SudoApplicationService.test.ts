import { SudoApplicationService } from '../../../src/application/identity/SudoApplicationService';

jest.mock('argon2', () => ({
  verify: jest.fn().mockResolvedValue(true),
}));

class FakeIdentityQueryService {
  async listUserPasskeyIds() { return []; }
  async getUserWithRoleById() { return { password: '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQ$J9g1A4r9XHq5VYb5m4mCkH8Qx4bJ5mC7rYb0T9m0lY0', totpSecret: null }; }
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

describe('SudoApplicationService', () => {
  it('grants sudo when password is valid', async () => {
    const store = new FakeSudoStore();
    const svc = new SudoApplicationService(
      new FakeIdentityQueryService() as any,
      new FakeAuthApplicationService() as any,
      store as any,
      'localhost',
      'http://localhost:3000'
    );

    await svc.verify('u1', 's1', { type: 'password', password: 'password' });
    expect(store.granted).toEqual(['s1']);
  });
});
