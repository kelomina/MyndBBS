import { fetcher } from './fetcher';

export interface PasswordResetRequestPayload {
  email: string;
}

export interface PasswordResetRequestResponse {
  message: string;
  email: string;
  expiresAt: string;
}

export interface ResetPasswordPayload {
  token: string;
  password: string;
}

export interface ResetPasswordResponse {
  message: string;
}

/**
 * Callers: [ForgotPasswordClient.handleSubmit]
 * Callees: [fetcher]
 * Description: Starts the forgot-password flow and returns the generic mailbox confirmation payload shown to the user.
 * 描述：发起忘记密码流程，并返回展示给用户的通用邮箱确认载荷。
 * Variables: `endpoint` is the backend forgot-password entry point; `payload.email` is the mailbox submitted by the user.
 * 变量：`endpoint` 是后端忘记密码入口；`payload.email` 是用户提交的邮箱。
 * Integration: Use this helper from password-recovery UIs so components remain decoupled from low-level fetch options and headers.
 * 接入方式：在密码恢复界面中调用本方法，避免组件直接处理底层 fetch 选项和请求头。
 * Error Handling: Relies on `fetcher` to throw translated server error codes when the request fails.
 * 错误处理：请求失败时依赖 `fetcher` 抛出服务端错误码。
 * Keywords: forgot password api, password recovery start, mailbox confirmation, reset request, fetch helper, 忘记密码API, 密码找回发起, 邮箱确认, 重置请求, 请求辅助
 */
export async function requestPasswordReset(
  endpoint: string,
  payload: PasswordResetRequestPayload
): Promise<PasswordResetRequestResponse> {
  return fetcher(endpoint, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Callers: [ResetPasswordClient.handleSubmit]
 * Callees: [fetcher]
 * Description: Submits the reset token and replacement password so the backend can complete the password-reset flow.
 * 描述：提交重置令牌和替换密码，让后端完成重置密码流程。
 * Variables: `endpoint` is the backend reset entry point; `payload` contains the mailbox token and the validated new password.
 * 变量：`endpoint` 是后端重置入口；`payload` 包含邮箱令牌和已校验的新密码。
 * Integration: Call this from pages or components that consume the password-reset link.
 * 接入方式：在消费密码重置链接的页面或组件中调用本方法。
 * Error Handling: Delegates request failures to `fetcher`, which throws the server-provided error code.
 * 错误处理：请求失败时委托 `fetcher` 抛出服务端返回的错误码。
 * Keywords: reset password api, reset token submit, replace password, mailbox recovery, fetch wrapper, 重置密码API, 提交重置令牌, 替换密码, 邮箱恢复, 请求封装
 */
export async function resetPassword(
  endpoint: string,
  payload: ResetPasswordPayload
): Promise<ResetPasswordResponse> {
  return fetcher(endpoint, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
