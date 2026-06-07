'use client';

import React, { useState } from 'react';
import Link from 'next/link';

import { requestPasswordReset } from '../../../lib/api/passwordReset';
import type { Dictionary } from '../../../types';

export function ForgotPasswordClient({ dict }: { dict: Dictionary }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [requestAcceptedEmail, setRequestAcceptedEmail] = useState('');
  const [requestAccepted, setRequestAccepted] = useState(false);

  /**
   * Callers: [forgot-password form onSubmit]
   * Callees: [requestPasswordReset]
   * Description: Starts the forgot-password flow and moves the page into a generic mailbox confirmation state.
   * 描述：发起忘记密码流程，并把页面切换到通用的邮箱确认状态。
   * Variables: `event` is the form submit event; `response` is the accepted reset-request payload returned by the backend.
   * 变量：`event` 是表单提交事件；`response` 是后端返回的已受理重置请求载荷。
   * Integration: Keep this handler bound to the public forgot-password form so users can recover access without authentication.
   * 接入方式：保持本处理函数绑定在公开的忘记密码表单上，使用户无需登录即可找回访问权限。
   * Error Handling: Translates backend error codes and leaves the user on the same form when the request fails.
   * 错误处理：失败时翻译后端错误码，并让用户停留在当前表单重新提交。
   * Keywords: forgot password submit, mailbox confirmation, public recovery, email request, frontend auth flow, 忘记密码提交, 邮箱确认, 公开找回, 邮件请求, 前端认证流程
   */
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await requestPasswordReset('/api/v1/auth/password/forgot', { email });
      setRequestAcceptedEmail(response.email);
      setRequestAccepted(true);
    } catch (err: unknown) {
      const errorKey = err instanceof Error ? err.message : '';
      setError(
        dict.apiErrors?.[errorKey as keyof typeof dict.apiErrors] ||
        errorKey ||
        dict.auth.passwordResetRequestFailed
      );
    } finally {
      setLoading(false);
    }
  };

  if (requestAccepted) {
    return (
      <div className="rounded-2xl border border-border/50 bg-card px-8 py-10 shadow-sm">
        <div className="mb-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            {dict.auth.passwordResetEmailSent}
          </h2>
          <p className="mt-2 text-sm text-muted">
            {dict.auth.passwordResetEmailSentDesc}
          </p>
        </div>
        <div className="rounded-xl border border-border/60 bg-background/60 px-4 py-4 text-sm text-foreground">
          <p>{requestAcceptedEmail || email}</p>
        </div>
        <div className="mt-6 flex flex-col gap-3">
          <Link
            href="/login"
            className="rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            {dict.auth.backToLogin}
          </Link>
          <button
            type="button"
            onClick={() => setRequestAccepted(false)}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/30"
          >
            {dict.auth.retry}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/50 bg-card px-8 py-10 shadow-sm">
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-foreground">
          {dict.auth.forgotPasswordTitle}
        </h2>
        <p className="mt-2 text-sm text-muted">
          {dict.auth.forgotPasswordDesc}
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-foreground">{dict.auth.emailAddress}</label>
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="flex w-full justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? dict.auth.sendingResetEmail : dict.auth.sendResetEmail}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-muted">
        <Link href="/login" className="font-medium text-primary hover:text-primary/80">
          {dict.auth.backToLogin}
        </Link>
      </p>
    </div>
  );
}
