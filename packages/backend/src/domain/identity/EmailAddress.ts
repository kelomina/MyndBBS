export class EmailAddress {
  private constructor(public readonly value: string) {}

  public static create(email: string): EmailAddress {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('ERR_INVALID_EMAIL');
    }
    return new EmailAddress(email);
  }
}
