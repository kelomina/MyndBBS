import { isValidPassword, STRICT_PASSWORD_REGEX } from '../src/utils/validations'

describe('isValidPassword', () => {
  it('should accept passwords with at least one uppercase, one lowercase, one digit, and one special character', () => {
    expect(isValidPassword('StrongPass1!')).toBe(true)
    expect(isValidPassword('MyPass123!')).toBe(true)
    expect(isValidPassword('Abcd@1234')).toBe(true)
    expect(isValidPassword('XyZ!2345')).toBe(true)
  })

  it('should accept minimum length of 8 characters', () => {
    expect(isValidPassword('Ab@1efgh')).toBe(true)
  })

  it('should accept maximum length of 128 characters', () => {
    const longPass = 'Aa1!' + 'x'.repeat(124)
    expect(longPass.length).toBe(128)
    expect(isValidPassword(longPass)).toBe(true)
  })

  it('should reject passwords shorter than 8 characters', () => {
    expect(isValidPassword('Ab@12')).toBe(false)
    expect(isValidPassword('A1!a')).toBe(false)
  })

  it('should reject passwords longer than 128 characters', () => {
    const tooLong = 'Aa1!' + 'x'.repeat(125)
    expect(tooLong.length).toBe(129)
    expect(isValidPassword(tooLong)).toBe(false)
  })

  it('should reject passwords missing uppercase letters', () => {
    expect(isValidPassword('weakpass1!')).toBe(false)
    expect(isValidPassword('alllowercase1!')).toBe(false)
  })

  it('should reject passwords missing lowercase letters', () => {
    expect(isValidPassword('ALLUPPERCASE1!')).toBe(false)
    expect(isValidPassword('STRONG123!')).toBe(false)
  })

  it('should reject passwords missing digits', () => {
    expect(isValidPassword('NoNumber!')).toBe(false)
    expect(isValidPassword('MissingDigit!')).toBe(false)
  })

  it('should reject passwords missing special characters', () => {
    expect(isValidPassword('NoSpecial1')).toBe(false)
    expect(isValidPassword('Abcd1234')).toBe(false)
  })

  it('should reject empty string', () => {
    expect(isValidPassword('')).toBe(false)
  })

  it('should reject whitespace-only strings', () => {
    expect(isValidPassword('        ')).toBe(false)
  })

  it('should support all special characters in the allowed set', () => {
    expect(isValidPassword('Abcd1@234')).toBe(true)
    expect(isValidPassword('Abcd1#234')).toBe(true)
    expect(isValidPassword('Abcd1$234')).toBe(true)
    expect(isValidPassword('Abcd1%234')).toBe(true)
    expect(isValidPassword('Abcd1^234')).toBe(true)
    expect(isValidPassword('Abcd1&234')).toBe(true)
    expect(isValidPassword('Abcd1*234')).toBe(true)
  })
})

describe('STRICT_PASSWORD_REGEX', () => {
  it('should require at minimum 8 characters', () => {
    expect('Ab@12ef'.match(STRICT_PASSWORD_REGEX)).toBeNull()
    expect('Ab@12efg'.match(STRICT_PASSWORD_REGEX)).not.toBeNull()
  })

  it('should not match strings longer than 128 characters', () => {
    const tooLong = 'Aa1!' + 'x'.repeat(125)
    expect(tooLong.match(STRICT_PASSWORD_REGEX)).toBeNull()
  })
})
