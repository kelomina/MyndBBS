import { EmailRegistrationTicket } from '../src/domain/identity/EmailRegistrationTicket';

describe('EmailRegistrationTicket', () => {
  it('normalizes email and rejects expired tickets on creation', () => {
    const ticket = EmailRegistrationTicket.create({
      id: 'ticket-1',
      email: 'User@Test.COM',
      username: 'demo-user',
      passwordHash: 'hashed-password',
      verificationToken: 'token-1',
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
    });

    expect(ticket.email).toBe('user@test.com');
  });

  it('throws when completion is attempted after expiry', () => {
    const ticket = EmailRegistrationTicket.load({
      id: 'ticket-1',
      email: 'user@test.com',
      username: 'demo-user',
      passwordHash: 'hashed-password',
      verificationToken: 'token-1',
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
    });

    expect(() => ticket.validateForCompletion(new Date(Date.now() + 120_000))).toThrow('ERR_EMAIL_REGISTRATION_EXPIRED');
  });
});
