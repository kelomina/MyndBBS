export class Password {
  private constructor(public readonly value: string) {}

  public static createHashed(hashedPassword: string): Password {
    if (!hashedPassword || hashedPassword.trim() === '') {
      throw new Error('ERR_INVALID_PASSWORD');
    }
    return new Password(hashedPassword);
  }
}
