'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { isValidPassword } from '@myndbbs/shared';

import { resetPassword } from '../../../lib/api/passwordReset';
import type { Dictionary } from '../../../types';

type ResetPasswordStage = 'form' | 'expired' | 'success';

export function ResetPasswordClient({ dict }: { dict: Dictionary }) {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const email = searchParams.get('email') ?? '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<ResetPasswordStage>(token ? 'form' : 'expired');

  /**
   * Callers: [reset-password form onSubmit]
   * Callees: [resetPassword, isValidPassword]
   * Description: Validates the replacement password locally, submits the reset token to the backend, and transitions the page into success or expired-link states.
   * 描述：在本地校验替换密码后向后端提交重置令牌，并把页面切换到成功或链接过期状态。
   * Variables: `event` is the form submit event; `errorKey` is the backend error code used for translated feedback.
   * 变量：`event` 是表单提交事件；`errorKey` 是用于翻译反馈的后端错误码。
   * Integration: Keep this handler bound to the public reset-password form consumed from mailbox links.
   * 接入方式：保持本处理函数绑定在公开的重置密码表单上，供邮箱链接页面直接消费。
   * Error Handling: Password validation failures stay local; expired or missing tickets move the UI into the dedicated expired branch.
   * 错误处理：密码校验失败会留在本地处理；过期或缺失的票据会把界面切换到专门的过期分支。
   * Keywords: reset password submit, replacement password, expired link branch, public recovery, backend token, 重置密码提交, 替换密码, 过期分支, 公开找回, 后端令牌
   */
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError('');

    if (!token) {
      setStage('expired');
      return;
    }

    if (password.length < 8 || password.length > 128) {
      setError(dict.auth.passwordLengthError);
      return;
    }

    if (!isValidPassword(password)) {
      setError(dict.auth.passwordComplexityError);
      return;
    }

    if (password !== confirmPassword) {
      setError(dict.auth.passwordMismatch);
      return;
    }

    setLoading(true);
    try {
      await resetPassword('/api/v1/auth/password/reset', {
        token,
        password,
      });
      setStage('success');
    } catch (err: unknown) {
      const errorKey = err instanceof Error ? err.message : '';
      const translatedError =
        dict.apiErrors?.[errorKey as keyof typeof dict.apiErrors] ||
        errorKey ||
        dict.auth.passwordResetFailed;

      if (
        errorKey === 'ERR_PASSWORD_RESET_EXPIRED' ||
        errorKey === 'ERR_PASSWORD_RESET_NOT_FOUND' ||
        errorKey === 'ERR_PASSWORD_RESET_TOKEN_REQUIRED'
      ) {
        setError(translatedError);
        setStage('expired');
      } else {
        setError(translatedError);
      }
    } finally {
      setLoading(false);
    }
  };

  if (stage === 'success') {
    return (
      <div className="rounded-2xl border border-border/50 bg-card px-8 py-10 shadow-sm">
        <div className="mb-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            {dict.auth.passwordResetCompletedTitle}
          </h2>
          <p className="mt-2 text-sm text-muted">
            {dict.auth.passwordResetCompletedDesc}
          </p>
        </div>
        <Link
          href="/login"
          className="block rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          {dict.auth.backToLogin}
        </Link>
      </div>
    );
  }

  if (stage === 'expired') {
    return (
      <div
        data-testid="reset-password-expired"
        className="rounded-2xl border border-border/50 bg-card px-8 py-10 shadow-sm"
      >
        <div className="mb-6 text-center">
          <h2
            data-testid="reset-password-expired-title"
            className="text-3xl font-bold tracking-tight text-foreground"
          >
            {dict.auth.passwordResetLinkExpiredTitle}
          </h2>
          <p className="mt-2 text-sm text-muted">
            {dict.auth.passwordResetLinkExpiredDesc}
          </p>
        </div>
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
            {error}
          </div>
        )}
        {email && (
          <div className="mb-6 rounded-xl border border-border/60 bg-background/60 px-4 py-4 text-sm text-foreground">
            <p>{email}</p>
          </div>
        )}
        <div className="flex flex-col gap-3">
          <Link
            href="/forgot-password"
            data-testid="reset-password-request-new-link"
            className="rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            {dict.auth.requestNewResetLink}
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-border px-4 py-2 text-center text-sm font-medium text-foreground hover:bg-muted/30"
          >
            {dict.auth.backToLogin}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/50 bg-card px-8 py-10 shadow-sm">
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-foreground">
          {dict.auth.resetPasswordTitle}
        </h2>
        <p className="mt-2 text-sm text-muted">
          {dict.auth.resetPasswordDesc}
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
          {error}
        </div>
      )}

      {email && (
        <div className="mb-6 rounded-xl border border-border/60 bg-background/60 px-4 py-4 text-sm text-foreground">
          <p>{email}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-foreground">
            {dict.auth.newPasswordLabel}
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            data-testid="reset-password-new-password"
            className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:text-sm"
          />
          <p className="mt-1 text-xs text-muted">{dict.auth.passwordHint}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground">
            {dict.auth.confirmNewPasswordLabel}
          </label>
          <input
            type="password"
            required
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            data-testid="reset-password-confirm-password"
            className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          data-testid="reset-password-submit"
          className="flex w-full justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? dict.auth.resettingPassword : dict.auth.resetPasswordSubmit}
        </button>
      </form>
    </div>
  );
}
