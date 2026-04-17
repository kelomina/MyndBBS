import { EmailAddress } from '../src/domain/identity/EmailAddress';

describe('EmailAddress Value Object', () => {
  it('should create a valid email address', () => {
    const email = EmailAddress.create('test@example.com');
    expect(email.value).toBe('test@example.com');
  });

  it('should throw an error for invalid email', () => {
    expect(() => EmailAddress.create('invalid-email')).toThrow('ERR_INVALID_EMAIL');
  });
});
