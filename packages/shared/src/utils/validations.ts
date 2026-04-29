/**
 * 密码强度正则：8-128位，至少一个大写字母、一个小写字母、一个数字、一个特殊字符。
 * 注意：此正则仅校验格式，后端 Password 值对象会额外执行 validatePolicy() 进行业务规则校验。
 * Password strength regex: 8-128 chars, at least one uppercase, one lowercase, one digit, and one special character.
 * Note: This regex only validates format. The backend Password value object additionally calls validatePolicy() for business rule validation.
 */
export const STRICT_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,128}$/;

/**
 * Callers: []
 * Callees: [test]
 * Description: Handles the is valid password logic for the application.
 * Keywords: isvalidpassword, is, valid, password, auto-annotated
 */
export const isValidPassword = (password: string): boolean => {
  return STRICT_PASSWORD_REGEX.test(password);
};
