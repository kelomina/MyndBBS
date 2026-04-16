export interface ICaptchaValidator {
  consumeCaptcha(captchaId: string): Promise<boolean>;
}