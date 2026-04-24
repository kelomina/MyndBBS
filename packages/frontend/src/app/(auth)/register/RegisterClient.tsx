'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { isValidPassword } from '@myndbbs/shared';

import { SliderCaptcha } from '../../../components/SliderCaptcha';
import { TwoFactorSetup } from '../../../components/TwoFactorSetup';
import {
  resendEmailRegistration,
  startEmailRegistration,
  verifyEmailRegistration,
} from '../../../lib/api/emailRegistration';
import type { Dictionary } from '../../../types';

type RegisterStage =
  | 'form'
  | 'pendingVerification'
  | 'verifyingEmail'
  | 'verificationExpired'
  | 'twoFactor';

export function RegisterClient({ dict }: { dict: Dictionary }) {
  const searchParams = useSearchParams();
  const verificationToken = searchParams.get('verificationToken');
  const verificationEmail = searchParams.get('email');
  const handledVerificationTokenRef = useRef<string | null>(null);
  const [email, setEmail] = useState(verificationEmail ?? '');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [captchaId, setCaptchaId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [registerStage, setRegisterStage] = useState<RegisterStage>('form');
  const [pendingRegistrationEmail, setPendingRegistrationEmail] = useState(verificationEmail ?? '');

  /**
   * Callers: [RegisterClient.verifyRegistrationToken, RegisterClient.handleSubmit, RegisterClient.handleResendVerificationEmail]
   * Callees: []
   * Description: Maps thrown backend errors into translated user-facing copy while preserving server error codes as the fallback.
   * 描述：把后端抛出的错误映射成已翻译的用户可见文案，并在缺少翻译时保留服务端错误码作为回退。
   * Variables: `err` is the unknown failure thrown by the API layer; `errorKey` is the extracted server error code used for dictionary lookup.
   * 变量：`err` 是 API 层抛出的未知失败；`errorKey` 是提取出的服务端错误码，用于词典查找。
   * Integration: Reuse this helper for every registration-side API call so the page keeps one error translation policy.
   * 接入方式：在注册页的所有 API 调用中复用本方法，保持统一的错误翻译策略。
   * Error Handling: Unknown non-Error failures fall back to the generic registration failure copy.
   * 错误处理：未知且非 Error 的失败会回退到通用注册失败文案。
   * Keywords: translate api error, registration fallback, dictionary lookup, user copy, error normalization, 翻译API错误, 注册回退, 词典查找, 用户文案, 错误规范化
   */
  const toTranslatedApiError = useCallback((err: unknown): string => {
    const errorKey = err instanceof Error ? err.message : '';
    return (
      dict.apiErrors?.[errorKey as keyof typeof dict.apiErrors] ||
      errorKey ||
      dict.auth.registrationFailed
    );
  }, [dict]);

  /**
   * Callers: [RegisterClient.verifyRegistrationToken, RegisterClient.handleResendVerificationEmail]
   * Callees: []
   * Description: Resolves the mailbox that should be displayed or used for resend actions across form, pending, and expired states.
   * 描述：解析当前应展示或用于补发动作的邮箱，在表单、待验证和过期状态之间保持一致。
   * Variables: The helper reads `pendingRegistrationEmail`, `verificationEmail`, and `email` in priority order.
   * 变量：本方法按优先级读取 `pendingRegistrationEmail`、`verificationEmail` 和 `email`。
   * Integration: Use this helper whenever the UI needs one canonical mailbox value for registration recovery actions.
   * 接入方式：当界面需要一个规范化邮箱值来执行注册恢复动作时调用本方法。
   * Error Handling: Returns an empty string when no mailbox can be resolved, letting callers choose a safe fallback UI branch.
   * 错误处理：当无法解析邮箱时返回空字符串，由调用方决定安全的回退界面。
   * Keywords: resolve mailbox, resend target, expired link email, register recovery, canonical email, 解析邮箱, 补发目标, 过期链接邮箱, 注册恢复, 规范邮箱
   */
  const getResolvedMailbox = useCallback((): string => {
    return pendingRegistrationEmail || verificationEmail || email;
  }, [email, pendingRegistrationEmail, verificationEmail]);

  /**
   * Callers: [useEffect]
   * Callees: [verifyEmailRegistration, RegisterClient.toTranslatedApiError, RegisterClient.getResolvedMailbox]
   * Description: Consumes the `verificationToken` query parameter, verifies the email registration with the backend, and advances the UI into the existing 2FA setup stage.
   * 描述：消费 `verificationToken` 查询参数，向后端验证邮箱注册，并把界面推进到现有的 2FA 设置阶段。
   * Variables: `token` is the query-string mailbox verification token; `translatedError` is the localized message shown on failure.
   * 变量：`token` 是查询串中的邮箱验证令牌；`translatedError` 是失败时展示的本地化错误文案。
   * Integration: This helper is triggered by the registration page effect whenever the user opens a verification link from their mailbox.
   * 接入方式：当用户从邮箱打开注册链接时，注册页 effect 会自动触发本方法。
   * Error Handling: Expired or stale links with a resolvable mailbox move the UI into the dedicated expired branch; all other failures return to the form.
   * 错误处理：带有可解析邮箱的过期或失效链接会进入专门的过期分支；其他失败则回退到表单页。
   * Keywords: verify mailbox token, email callback, register page effect, expired branch, 2fa transition, 验证邮箱令牌, 邮箱回调, 注册页副作用, 过期分支, 进入2FA
   */
  const verifyRegistrationToken = useCallback(async (token: string): Promise<void> => {
    setLoading(true);
    setError('');
    setStatusMessage('');
    setRegisterStage('verifyingEmail');

    try {
      await verifyEmailRegistration('/api/v1/auth/register/verify-email', token);
      setRegisterStage('twoFactor');
    } catch (err: unknown) {
      const errorKey = err instanceof Error ? err.message : '';
      const translatedError = toTranslatedApiError(err);
      const resolvedMailbox = getResolvedMailbox();

      if (
        (errorKey === 'ERR_EMAIL_REGISTRATION_EXPIRED' ||
          (errorKey === 'ERR_EMAIL_REGISTRATION_NOT_FOUND' && !!resolvedMailbox)) &&
        resolvedMailbox
      ) {
        setPendingRegistrationEmail(resolvedMailbox);
        setError(translatedError);
        setRegisterStage('verificationExpired');
      } else {
        setError(translatedError);
        setRegisterStage('form');
      }
    } finally {
      setLoading(false);
    }
  }, [getResolvedMailbox, toTranslatedApiError]);

  useEffect(() => {
    if (!verificationToken) {
      return;
    }

    if (handledVerificationTokenRef.current === verificationToken) {
      return;
    }

    handledVerificationTokenRef.current = verificationToken;
    const timerId = window.setTimeout(() => {
      void verifyRegistrationToken(verificationToken);
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [verificationToken, verifyRegistrationToken]);

  /**
   * Callers: [registration form onSubmit]
   * Callees: [startEmailRegistration, isValidPassword]
   * Description: Validates the registration form locally, submits the signup request, and transitions the UI into the “check your inbox” waiting state.
   * 描述：在本地校验注册表单后提交注册请求，并把界面切换到“请查收邮箱”的等待状态。
   * Variables: `event` is the form submit event; `response` is the accepted registration response containing the mailbox and expiry time.
   * 变量：`event` 是表单提交事件；`response` 是注册受理响应，包含邮箱与过期时间。
   * Integration: This handler remains bound to the original registration form submit button, so the page keeps the same entry point while the backend flow changes to email verification.
   * 接入方式：本处理函数继续绑定原注册表单提交按钮，使页面保持同一入口，同时把后端流程切换为邮箱验证。
   * Error Handling: Translates backend error codes and clears the captcha state on failure so the user must re-verify before retrying.
   * 错误处理：失败时翻译后端错误码，并清空验证码状态，要求用户重新完成人机验证后再重试。
   * Keywords: register submit, signup validation, check inbox state, captcha reset, frontend auth flow, 注册提交, 表单校验, 查收邮箱状态, 验证码重置, 前端认证流程
   */
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError('');
    setStatusMessage('');

    if (!captchaId) {
      setError(dict.auth.completeSecurityVerificationFirst);
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

    setLoading(true);
    try {
      const response = await startEmailRegistration('/api/v1/auth/register', {
        email,
        username,
        password,
        captchaId,
      });

      setPendingRegistrationEmail(response.email);
      setRegisterStage('pendingVerification');
    } catch (err: unknown) {
      setError(toTranslatedApiError(err));
      setCaptchaId(null);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Callers: [pending verification button, expired verification button]
   * Callees: [resendEmailRegistration, RegisterClient.getResolvedMailbox, RegisterClient.toTranslatedApiError]
   * Description: Requests a fresh mailbox verification email for the resolved registration email and returns the UI to the waiting state.
   * 描述：为当前解析出的注册邮箱补发一封新的验证邮件，并把界面返回到等待状态。
   * Variables: `resolvedMailbox` is the canonical email used for resend; `response` is the accepted resend response containing the refreshed expiry window.
   * 变量：`resolvedMailbox` 是用于补发的规范邮箱；`response` 是包含刷新后有效期的补发响应。
   * Integration: Bind this handler to both the pending and expired registration branches so recovery always uses one code path.
   * 接入方式：把本方法同时绑定到待验证和过期分支，确保恢复流程共用同一套代码路径。
   * Error Handling: Leaves the user in the current recovery branch and surfaces the translated API error when resend fails.
   * 错误处理：补发失败时保留当前恢复分支，并展示翻译后的 API 错误。
   * Keywords: resend verification email, pending recovery, expired link recovery, mailbox retry, registration resend, 补发验证邮件, 待验证恢复, 过期链接恢复, 邮箱重试, 注册补发
   */
  const handleResendVerificationEmail = useCallback(async (): Promise<void> => {
    const resolvedMailbox = getResolvedMailbox();
    if (!resolvedMailbox) {
      setRegisterStage('form');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await resendEmailRegistration('/api/v1/auth/register/resend-email', {
        email: resolvedMailbox,
      });

      setPendingRegistrationEmail(response.email);
      setStatusMessage(dict.auth.registrationEmailResent);
      setRegisterStage('pendingVerification');
    } catch (err: unknown) {
      setError(toTranslatedApiError(err));
    } finally {
      setLoading(false);
    }
  }, [dict.auth.registrationEmailResent, getResolvedMailbox, toTranslatedApiError]);

  if (registerStage === 'twoFactor') {
    return <TwoFactorSetup />;
  }

  if (registerStage === 'verifyingEmail') {
    return (
      <div className="rounded-2xl border border-border/50 bg-card px-8 py-10 shadow-sm">
        <div className="mb-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            {dict.auth.verifyingEmailRegistration}
          </h2>
          <p className="mt-2 text-sm text-muted">{dict.auth.emailVerificationLinkOpened}</p>
        </div>
        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
            {error}
          </div>
        )}
      </div>
    );
  }

  if (registerStage === 'verificationExpired') {
    return (
      <div className="rounded-2xl border border-border/50 bg-card px-8 py-10 shadow-sm">
        <div className="mb-6 text-center">
          <h2
            data-testid="register-verification-expired-title"
            className="text-3xl font-bold tracking-tight text-foreground"
          >
            {dict.auth.verificationLinkExpiredTitle}
          </h2>
          <p className="mt-2 text-sm text-muted">
            {dict.auth.verificationLinkExpiredDesc}
          </p>
        </div>
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
            {error}
          </div>
        )}
        <div
          data-testid="register-verification-expired"
          className="rounded-xl border border-border/60 bg-background/60 px-4 py-4 text-sm text-foreground"
        >
          <p>{getResolvedMailbox()}</p>
        </div>
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => void handleResendVerificationEmail()}
            disabled={loading}
            data-testid="register-resend-verification-button"
            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? dict.auth.creating : dict.auth.resendVerificationEmail}
          </button>
          <button
            type="button"
            onClick={() => setRegisterStage('form')}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/30"
          >
            {dict.auth.retry}
          </button>
        </div>
      </div>
    );
  }

  if (registerStage === 'pendingVerification') {
    return (
      <div
        data-testid="register-pending-verification"
        className="rounded-2xl border border-border/50 bg-card px-8 py-10 shadow-sm"
      >
        <div className="mb-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            {dict.auth.registrationEmailSent}
          </h2>
          <p className="mt-2 text-sm text-muted">{dict.auth.checkInboxForVerification}</p>
        </div>
        {statusMessage && (
          <div
            data-testid="register-status-message"
            className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-300"
          >
            {statusMessage}
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
            {error}
          </div>
        )}
        <div className="rounded-xl border border-border/60 bg-background/60 px-4 py-4 text-sm text-foreground">
          <p>{getResolvedMailbox()}</p>
        </div>
        <p className="mt-4 text-sm text-muted">{dict.auth.reopenEmailVerificationHint}</p>
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => void handleResendVerificationEmail()}
            disabled={loading}
            data-testid="register-resend-verification-button"
            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? dict.auth.creating : dict.auth.resendVerificationEmail}
          </button>
          <button
            type="button"
            onClick={() => setRegisterStage('form')}
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
        <h2 className="text-3xl font-bold tracking-tight text-foreground">{dict.auth.joinMyndbbs}</h2>
        <p className="mt-2 text-sm text-muted">{dict.auth.createAccountToJoin}</p>
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

        <div>
          <label className="block text-sm font-medium text-foreground">{dict.auth.username}</label>
          <input
            type="text"
            required
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground">{dict.auth.password}</label>
          <input
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:text-sm"
          />
          <p className="mt-1 text-xs text-muted">{dict.auth.passwordHint}</p>
        </div>

        {!captchaId ? (
          <SliderCaptcha onSuccess={(nextCaptchaId) => setCaptchaId(nextCaptchaId)} />
        ) : (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-50 px-4 py-3.5 text-sm font-medium text-emerald-700 shadow-[0_0_15px_rgba(52,211,153,0.1)] dark:bg-emerald-500/15 dark:text-emerald-300">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-xs text-white shadow-[0_0_10px_rgba(52,211,153,0.5)]">
              OK
            </div>
            <span>{dict.auth.securityVerificationPassed}</span>
          </div>
        )}

        <div>
          <button
            type="submit"
            disabled={loading || !captchaId}
            className="flex w-full justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? dict.auth.creating : dict.auth.createAccount}
          </button>
        </div>
      </form>

      <p className="mt-8 text-center text-sm text-muted">
        {dict.auth.alreadyHaveAccount}{' '}
        <Link href="/login" className="font-medium text-primary hover:text-primary/80">
          {dict.auth.signIn}
        </Link>
      </p>
    </div>
  );
}
