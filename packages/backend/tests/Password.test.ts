import { Password } from '../src/domain/identity/Password';

describe('Password Value Object', () => {
  it('should create a valid hashed password', () => {
    const pass = Password.createHashed('hashed_string');
    expect(pass.value).toBe('hashed_string');
  });

  it('should fail if hashed password is empty', () => {
    expect(() => Password.createHashed('')).toThrow('ERR_INVALID_PASSWORD');
  });

  describe('validatePolicy', () => {
    it('should pass for a valid password', () => {
      expect(() => Password.validatePolicy('StrongPass1!')).not.toThrow();
    });

    it('should throw if password is too short', () => {
      expect(() => Password.validatePolicy('Short1!')).toThrow('ERR_PASSWORD_MUST_BE_BETWEEN_8_AND_128_CHARACTERS');
    });

    it('should throw if password misses uppercase', () => {
      expect(() => Password.validatePolicy('weakpass1!')).toThrow('ERR_PASSWORD_MUST_CONTAIN_UPPERCASE_LOWERCASE_NUMBER_AND_SPECIAL_CHARACTER');
    });

    it('should throw if password contains invalid characters', () => {
      expect(() => Password.validatePolicy('StrongPass1!😊')).toThrow('ERR_PASSWORD_CONTAINS_INVALID_CHARACTERS');
    });
  });
});
