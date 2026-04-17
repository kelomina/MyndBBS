import { Password } from '../src/domain/identity/Password';

describe('Password Value Object', () => {
  it('should create a valid hashed password', () => {
    const pass = Password.createHashed('hashed_string');
    expect(pass.value).toBe('hashed_string');
  });

  it('should fail if hashed password is empty', () => {
    expect(() => Password.createHashed('')).toThrow('ERR_INVALID_PASSWORD');
  });
});
