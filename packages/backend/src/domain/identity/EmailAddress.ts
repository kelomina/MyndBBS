/**
 * 类名称：EmailAddress
 *
 * 函数作用：
 *   邮箱地址值对象——封装邮箱格式校验逻辑。
 * Purpose:
 *   Email address value object — encapsulates email format validation.
 *
 * 中文关键词：
 *   邮箱，值对象，校验
 * English keywords:
 *   email, value object, validation
 */
export class EmailAddress {
  private constructor(public readonly value: string) {}

  /**
   * 函数名称：create
   *
   * 函数作用：
   *   创建邮箱地址值对象，校验格式。
   * Purpose:
   *   Creates an EmailAddress value object with format validation.
   *
   * 参数说明 / Parameters:
   *   - email: string, 邮箱地址
   *
   * 错误处理 / Error handling:
   *   - ERR_INVALID_EMAIL（邮箱格式不合法）
   *
   * 中文关键词：
   创建邮箱，格式校验
   * English keywords:
   *   create email, format validation
   */
  public static create(email: string): EmailAddress {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('ERR_INVALID_EMAIL');
    }
    return new EmailAddress(email);
  }
}
