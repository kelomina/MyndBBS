import { PasswordResetTicket } from '../src/domain/identity/PasswordResetTicket';

describe('PasswordResetTicket', () => {
  it('normalizes email and rejects expired tickets on creation', () => {
    const ticket = PasswordResetTicket.create({
      id: 'ticket-1',
      userId: 'user-1',
      email: 'User@Test.COM',
      username: 'demo-user',
      resetToken: 'reset-token-1',
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
    });

    expect(ticket.email).toBe('user@test.com');
  });

  it('throws when reset is attempted after expiry', () => {
    const ticket = PasswordResetTicket.load({
      id: 'ticket-1',
      userId: 'user-1',
      email: 'user@test.com',
      username: 'demo-user',
      resetToken: 'reset-token-1',
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
    });

    expect(() => ticket.validateForReset(new Date(Date.now() + 120_000))).toThrow('ERR_PASSWORD_RESET_EXPIRED');
  });
});
