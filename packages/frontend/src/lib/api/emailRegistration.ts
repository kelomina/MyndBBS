import { fetcher } from './fetcher';

export interface StartEmailRegistrationPayload {
  email: string;
  username: string;
  password: string;
  captchaId: string;
}

export interface StartEmailRegistrationResponse {
  message: string;
  email: string;
  expiresAt: string;
}

export interface ResendEmailRegistrationPayload {
  email: string;
}

export interface VerifyEmailRegistrationResponse {
  message: string;
  user: {
    id: string;
    username: string;
    role: string | null;
  };
}

/**
 * Callers: [RegisterClient.handleSubmit]
 * Callees: [fetcher]
 * Description: Starts the email-registration flow and returns the mailbox and expiry metadata used to instruct the user to check their inbox.
 * 描述：发起邮箱注册流程，并返回用于提示用户查收邮箱的邮箱地址和过期时间元数据。
 * Variables: `endpoint` is the backend registration entry point; `payload` contains the email, username, password, and captcha id submitted by the user.
 * 变量：`endpoint` 是后端注册入口；`payload` 包含用户提交的邮箱、用户名、密码和验证码 id。
 * Integration: Use this helper from registration UIs that should remain decoupled from low-level `fetch` options and CSRF headers.
 * 接入方式：在注册界面中调用本方法，避免组件直接处理底层 `fetch` 选项和 CSRF 头。
 * Error Handling: Relies on `fetcher` to throw translated server error codes when the request fails.
 * 错误处理：请求失败时依赖 `fetcher` 抛出服务端返回的错误码。
 * Keywords: email registration api, signup start, verification mail request, mailbox registration, fetch helper, 邮箱注册API, 注册发起, 验证邮件请求, 邮箱注册, 请求辅助
 */
export async function startEmailRegistration(
  endpoint: string,
  payload: StartEmailRegistrationPayload
): Promise<StartEmailRegistrationResponse> {
  return fetcher(endpoint, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Callers: [RegisterClient.handleResendVerificationEmail]
 * Callees: [fetcher]
 * Description: Requests a fresh mailbox verification email for an existing pending registration.
 * 描述：为已有待验证注册请求补发一封新的邮箱验证邮件。
 * Variables: `endpoint` is the resend entry point; `payload.email` is the mailbox whose pending registration should receive the fresh link.
 * 变量：`endpoint` 是补发入口；`payload.email` 是需要接收新链接的待验证邮箱。
 * Integration: Call this from the registration pending or expired states instead of duplicating fetch logic in the page component.
 * 接入方式：在注册页的待验证或过期状态中调用本方法，而不是在页面组件里重复拼装请求。
 * Error Handling: Delegates request failures to `fetcher`, which throws the server-provided error code.
 * 错误处理：请求失败时委托 `fetcher` 抛出服务端返回的错误码。
 * Keywords: resend verification api, mailbox retry, pending signup, fetch helper, registration recovery, 补发验证API, 邮箱重试, 待注册恢复, 请求辅助, 注册恢复
 */
export async function resendEmailRegistration(
  endpoint: string,
  payload: ResendEmailRegistrationPayload
): Promise<StartEmailRegistrationResponse> {
  return fetcher(endpoint, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Callers: [RegisterClient.verifyRegistrationToken]
 * Callees: [fetcher]
 * Description: Submits the mailbox verification token and returns the user payload needed to continue into the existing 2FA setup flow.
 * 描述：提交邮箱验证令牌，并返回继续进入现有 2FA 设置流程所需的用户载荷。
 * Variables: `endpoint` is the backend verification entry point; `token` is the opaque verification token extracted from the registration link.
 * 变量：`endpoint` 是后端邮箱验证入口；`token` 是从注册链接解析出的不透明验证令牌。
 * Integration: Call this from pages or components that consume the `verificationToken` query parameter.
 * 接入方式：在消费 `verificationToken` 查询参数的页面或组件中调用。
 * Error Handling: Delegates request failures to `fetcher`, which throws the server-provided error code.
 * 错误处理：请求失败时委托 `fetcher` 抛出服务端错误码。
 * Keywords: verify registration api, email token verify, 2fa handoff, mailbox callback, fetch wrapper, 验证注册API, 邮件令牌验证, 交接2FA, 邮箱回调, 请求封装
 */
export async function verifyEmailRegistration(
  endpoint: string,
  token: string
): Promise<VerifyEmailRegistrationResponse> {
  return fetcher(endpoint, {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}
