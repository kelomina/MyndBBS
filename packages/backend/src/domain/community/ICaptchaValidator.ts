/**
 * 接口名称：ICaptchaValidator
 *
 * 函数作用：
 *   验证码校验接口——用于消费（校验并删除）人机验证码。
 * Purpose:
 *   Captcha validator interface — used to consume (validate and delete) captcha challenges.
 *
 * 中文关键词：
 *   验证码，校验，接口
 * English keywords:
 *   captcha, validation, interface
 */
export interface ICaptchaValidator {
  consumeCaptcha(captchaId: string): Promise<boolean>;
}