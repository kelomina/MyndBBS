'use client';

import React from 'react';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { useToast } from './ui/Toast';
import { useTranslation } from './TranslationProvider';
import {
  getRateLimitPolicy,
  updateRateLimitPolicy,
} from '../lib/api/admin';
import {
  RATE_LIMIT_POLICY_DEFAULTS,
  RATE_LIMIT_WINDOW_OPTIONS,
  type RateLimitProtectionConfig,
  type CaptchaStrength,
} from '../types/protection';

type SaveState = 'idle' | 'saving' | 'success' | 'error';
type ConfirmKind = 'disable' | 'lowThreshold' | 'reset' | null;

const LOW_THRESHOLD_WARN = 20;

function isIntegerInRange(value: string, min: number, max: number): boolean {
  if (value.trim() === '') return false;
  // 严格语义：禁止 coerce——必须为十进制整数字符串（可选负号），不接受 "30.0"/" 30 "/"30abc"/1.5
  if (!/^-?\d+$/.test(value.trim())) return false;
  const n = Number(value.trim());
  if (!Number.isSafeInteger(n)) return false;
  return n >= min && n <= max;
}

function parseStrictInt(value: string): number | null {
  if (!/^-?\d+$/.test(value.trim())) return null;
  const n = Number(value.trim());
  return Number.isSafeInteger(n) ? n : null;
}

/**
 * 读接口限流与解锁配置区（F4）。
 * 冻结契约 7 字段；zod 严格语义前端镜像：越界行内报错不 clamp；危险三件二次确认；保存四态。
 * 仅 isAdmin 可见由路由层保证（layout 侧栏门禁）；MODERATOR/匿名由后端 403/404 兜底。
 */
export function RateLimitPolicySection() {
  const { toast } = useToast();
  const dict = useTranslation();
  const admin = React.useMemo(
    () => (dict.admin ?? {}) as unknown as Record<string, string>,
    [dict.admin],
  );
  const apiErrors = React.useMemo(
    () => (dict.apiErrors ?? {}) as unknown as Record<string, string>,
    [dict.apiErrors],
  );

  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState('');
  const [saved, setSaved] = React.useState<RateLimitProtectionConfig | null>(null);
  const [enabled, setEnabled] = React.useState(true);
  const [publicReadMaxRaw, setPublicReadMaxRaw] = React.useState('30');
  const [windowSecRaw, setWindowSecRaw] = React.useState('60');
  const [strength, setStrength] = React.useState<CaptchaStrength>('low');
  const [exemptionRaw, setExemptionRaw] = React.useState('15');
  const [saveState, setSaveState] = React.useState<SaveState>('idle');
  const [fieldError, setFieldError] = React.useState('');
  const [confirmKind, setConfirmKind] = React.useState<ConfirmKind>(null);
  const [confirming, setConfirming] = React.useState(false);
  const [lastSavedAt, setLastSavedAt] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const policy = await getRateLimitPolicy();
      setSaved(policy);
      setEnabled(policy.enabled);
      setPublicReadMaxRaw(String(policy.publicReadMax));
      setWindowSecRaw(String(policy.windowSec));
      setStrength(policy.captchaStrength);
      setExemptionRaw(String(policy.exemptionMinutes));
      setSaveState('idle');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setLoadError(apiErrors[msg] || msg || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [apiErrors]);

  React.useEffect(() => {
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [load]);

  const thresholdValid = isIntegerInRange(publicReadMaxRaw, 10, 1000);
  const exemptionValid = isIntegerInRange(exemptionRaw, 1, 120);
  const windowValid = (RATE_LIMIT_WINDOW_OPTIONS as readonly number[]).includes(Number(windowSecRaw));
  const formValid = thresholdValid && exemptionValid && windowValid;

  const thresholdNum = parseStrictInt(publicReadMaxRaw);
  const showLowWarn = thresholdValid && thresholdNum !== null && thresholdNum < LOW_THRESHOLD_WARN;
  const showThresholdError = publicReadMaxRaw.trim() !== '' && !thresholdValid;
  const showExemptionError = exemptionRaw.trim() !== '' && !exemptionValid;

  const current: RateLimitProtectionConfig = React.useMemo(
    () => ({
      enabled,
      publicReadMax: thresholdNum ?? RATE_LIMIT_POLICY_DEFAULTS.publicReadMax,
      windowSec: (Number(windowSecRaw) as RateLimitProtectionConfig['windowSec']) || 60,
      captchaStrength: strength,
      exemptionMinutes: parseStrictInt(exemptionRaw) ?? RATE_LIMIT_POLICY_DEFAULTS.exemptionMinutes,
      exemptionScope: 'ip',
      loginRelaxed: false,
    }),
    [enabled, thresholdNum, windowSecRaw, strength, exemptionRaw],
  );

  const dirty = React.useMemo(() => {
    if (!saved) return formValid;
    return (
      saved.enabled !== current.enabled ||
      saved.publicReadMax !== current.publicReadMax ||
      saved.windowSec !== current.windowSec ||
      saved.captchaStrength !== current.captchaStrength ||
      saved.exemptionMinutes !== current.exemptionMinutes
    );
  }, [saved, current, formValid]);

  const needsDisableConfirm = saved?.enabled === true && enabled === false;
  const needsLowConfirm = thresholdValid && thresholdNum !== null && thresholdNum < LOW_THRESHOLD_WARN;

  const doSave = React.useCallback(async () => {
    if (!formValid) return;
    setSaveState('saving');
    setFieldError('');
    try {
      const result = await updateRateLimitPolicy(current);
      const policy = (result as { policy?: RateLimitProtectionConfig }).policy ?? (result as unknown as RateLimitProtectionConfig);
      setSaved(policy);
      setLastSavedAt(new Date().toLocaleTimeString());
      setSaveState('success');
      toast(admin.rateLimitSaved || 'Rate-limit config saved (effective ≤60s)', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      const mapped = apiErrors[msg] || msg || admin.failedToSaveRateLimit || 'Failed to save rate-limit config';
      setFieldError(mapped);
      setSaveState('error');
      toast(mapped, 'error');
    }
  }, [formValid, current, toast, admin.rateLimitSaved, admin.failedToSaveRateLimit, apiErrors]);

  const handleSaveClick = React.useCallback(() => {
    if (!formValid || !dirty || saveState === 'saving') return;
    if (needsDisableConfirm) {
      setConfirmKind('disable');
      return;
    }
    if (needsLowConfirm) {
      setConfirmKind('lowThreshold');
      return;
    }
    void doSave();
  }, [formValid, dirty, saveState, needsDisableConfirm, needsLowConfirm, doSave]);

  const handleConfirm = React.useCallback(async () => {
    if (confirmKind === 'reset') {
      setConfirming(true);
      try {
        setEnabled(RATE_LIMIT_POLICY_DEFAULTS.enabled);
        setPublicReadMaxRaw(String(RATE_LIMIT_POLICY_DEFAULTS.publicReadMax));
        setWindowSecRaw(String(RATE_LIMIT_POLICY_DEFAULTS.windowSec));
        setStrength(RATE_LIMIT_POLICY_DEFAULTS.captchaStrength);
        setExemptionRaw(String(RATE_LIMIT_POLICY_DEFAULTS.exemptionMinutes));
        setFieldError('');
        setSaveState('idle');
      } finally {
        setConfirming(false);
        setConfirmKind(null);
      }
      return;
    }
    // disable / lowThreshold：确认后执行保存
    setConfirming(true);
    try {
      await doSave();
    } finally {
      setConfirming(false);
      setConfirmKind(null);
    }
  }, [confirmKind, doSave]);

  const perMin = React.useMemo(() => {
    const max = thresholdNum ?? 0;
    const win = Number(windowSecRaw) || 60;
    if (!thresholdValid || !windowValid) return '–';
    return String(Math.round((max * 60) / win));
  }, [thresholdNum, windowSecRaw, thresholdValid, windowValid]);

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h2 className="font-semibold">{admin.rateLimitTitle || 'Read rate limit & unlock'}</h2>
        <div className="text-sm text-muted">{dict.common?.loading || 'Loading...'}</div>
      </div>
    );
  }

  if (loadError && !saved) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h2 className="font-semibold">{admin.rateLimitTitle || 'Read rate limit & unlock'}</h2>
        <div className="text-sm text-red-500" role="alert">{loadError}</div>
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => void load()}>{dict.common?.confirm || 'Retry'}</Button>
        </div>
      </div>
    );
  }

  const confirmText =
    confirmKind === 'disable'
      ? admin.confirmDisableUnlock || 'Off = no verify popup for 60s+; users only see wait state.'
      : confirmKind === 'lowThreshold'
        ? admin.confirmLowThreshold || 'Low threshold will pop up very often. Save anyway?'
        : confirmKind === 'reset'
          ? admin.confirmResetDefaults || 'Reset to defaults? Current edits will be overwritten.'
          : '';

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-4">
      <div>
        <h2 className="font-semibold">{admin.rateLimitTitle || 'Read rate limit & unlock'}</h2>
        <p className="text-sm text-muted">{admin.rateLimitDesc || 'Public read threshold, window, challenge strength and exemption. Takes effect within 60s.'}</p>
      </div>

      {/* Row1：总开关 + 豁免时长 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            disabled={saveState === 'saving'}
            className="mt-0.5 accent-primary"
          />
          <span>
            <span className="font-medium">{admin.readUnlockEnabled || 'Enable verify-to-unlock'}</span>
            <span className="block text-xs text-muted">{admin.readUnlockEnabledHint || 'Off = classic wait-only 429, no popup'}</span>
          </span>
        </label>
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="ratelimit-exemption">
            {admin.exemptionMinutes || 'Exemption (minutes)'}
          </label>
          <input
            id="ratelimit-exemption"
            type="number"
            min={1}
            max={120}
            step={1}
            value={exemptionRaw}
            onChange={(e) => setExemptionRaw(e.target.value)}
            disabled={saveState === 'saving'}
            aria-invalid={showExemptionError}
            aria-describedby="ratelimit-exemption-hint ratelimit-exemption-error"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <p id="ratelimit-exemption-hint" className="text-xs text-muted">
            {admin.exemptionMinutesHint || '1–120; default 15'}
          </p>
          {showExemptionError && (
            <p id="ratelimit-exemption-error" role="alert" className="text-sm text-red-500">
              {admin.invalidExemption || 'Exemption must be an integer 1–120'}
            </p>
          )}
        </div>
      </div>

      {/* Row2：阈值滑杆 + 窗口下拉 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="ratelimit-max">
            {admin.publicReadMax || 'Threshold (requests)'}
            <output aria-live="polite" className="ml-2 rounded bg-muted/40 px-2 py-0.5 text-xs">{publicReadMaxRaw}</output>
          </label>
          <input
            id="ratelimit-max"
            type="range"
            min={10}
            max={1000}
            step={1}
            value={thresholdNum ?? 10}
            onChange={(e) => setPublicReadMaxRaw(e.target.value)}
            disabled={saveState === 'saving'}
            aria-invalid={showThresholdError}
            aria-describedby="ratelimit-max-hint ratelimit-max-error"
            className="w-full accent-primary"
          />
          <div className="flex gap-2">
            <input
              type="number"
              min={10}
              max={1000}
              step={1}
              value={publicReadMaxRaw}
              onChange={(e) => setPublicReadMaxRaw(e.target.value)}
              disabled={saveState === 'saving'}
              aria-label={admin.publicReadMax || 'Threshold (requests)'}
              className="w-28 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <p id="ratelimit-max-hint" className="text-xs text-muted self-center">
              {admin.publicReadMaxHint || '10–1000 per window; current 30'}
            </p>
          </div>
          {showLowWarn && !showThresholdError && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {admin.thresholdTooLowWarn || 'Below 20 will pop up very often'}
            </p>
          )}
          {showThresholdError && (
            <p id="ratelimit-max-error" role="alert" className="text-sm text-red-500">
              {admin.invalidThreshold || 'Threshold must be an integer 10–1000'}
            </p>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="ratelimit-window">
            {admin.publicReadWindowSec || 'Window'}
          </label>
          <select
            id="ratelimit-window"
            value={windowSecRaw}
            onChange={(e) => setWindowSecRaw(e.target.value)}
            disabled={saveState === 'saving'}
            className="w-full rounded-md border border-border bg-background px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {RATE_LIMIT_WINDOW_OPTIONS.map((v) => (
              <option key={v} value={String(v)}>{v}s</option>
            ))}
          </select>
          <p className="text-xs text-muted">
            {(admin.publicReadWindowHint || 'About {perMin}/min (display only)').replace('{perMin}', perMin)}
          </p>
        </div>
      </div>

      {/* Row3：强度 segmented */}
      <div className="space-y-2">
        <span className="text-sm font-medium" id="ratelimit-strength-label">
          {admin.captchaStrength || 'Challenge strength'}
        </span>
        <div role="radiogroup" aria-labelledby="ratelimit-strength-label" className="flex rounded-lg bg-muted/40 p-1 gap-1">
          {(['low', 'normal', 'strict'] as const).map((level) => {
            const selected = strength === level;
            const label =
              level === 'low' ? admin.strengthEasy || 'Easy'
              : level === 'normal' ? admin.strengthNormal || 'Normal'
              : admin.strengthStrict || 'Strict';
            return (
              <button
                key={level}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={saveState === 'saving'}
                onClick={() => setStrength(level)}
                className={
                  selected
                    ? 'flex-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow'
                    : 'flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-50'
                }
              >
                {label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted" aria-live="polite">
          {strength === 'low'
            ? admin.strengthEasyHint || 'Fewest false blocks'
            : strength === 'normal'
              ? admin.strengthNormalHint || 'Current live params'
              : admin.strengthStrictHint || 'Strongest bot defense'}
        </p>
      </div>

      {/* Row4：search 只读占位 */}
      <div className="grid grid-cols-1 gap-4 rounded-md bg-muted/20 p-3 sm:grid-cols-2">
        <div className="space-y-1 opacity-70">
          <label className="text-sm font-medium" htmlFor="ratelimit-search-max">searchMax</label>
          <input id="ratelimit-search-max" type="number" value={20} disabled className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
        </div>
        <div className="space-y-1 opacity-70">
          <label className="text-sm font-medium" htmlFor="ratelimit-search-window">searchWindowSec</label>
          <input id="ratelimit-search-window" type="number" value={60} disabled className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
        </div>
        <p className="text-xs text-muted sm:col-span-2">
          <span className="mr-2 inline-block rounded bg-secondary px-2 py-0.5 text-xs">预留</span>
          {admin.searchLinkReserved || 'Search linkage reserved (v1 read-only)'}
        </p>
      </div>

      {/* Row5：loginRelaxed 置灰 + exemptionScope 只读 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex items-start gap-3 text-sm opacity-60" title={admin.loginRelaxedReserved || 'Login relaxation reserved, stays off'}>
          <input type="checkbox" checked={false} disabled className="mt-0.5 accent-primary" />
          <span>
            <span className="font-medium">{admin.loginRelaxed || 'Login relaxed'}</span>
            <span className="block text-xs text-muted">{admin.loginRelaxedReserved || 'Login relaxation reserved, stays off'}</span>
          </span>
        </label>
        <div className="space-y-1 opacity-70">
          <span className="text-sm font-medium">{admin.exemptionScope || 'Exemption scope'}</span>
          <div className="flex items-center gap-2">
            <code className="rounded bg-muted/40 px-2 py-1 font-mono text-sm">ip</code>
            <span className="text-xs text-muted">{admin.exemptionScopeHint || 'v1 fixed to ip, read-only'}</span>
          </div>
        </div>
      </div>

      {fieldError && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
          {fieldError}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="ghost"
          disabled={saveState === 'saving'}
          onClick={() => setConfirmKind('reset')}
        >
          {admin.resetDefaults || 'Reset to defaults'}
        </Button>
        <Button
          type="button"
          loading={saveState === 'saving'}
          disabled={!formValid || !dirty || saveState === 'saving'}
          title={!formValid ? (admin.invalidThreshold || 'Fix invalid fields') : !dirty ? (dict.common?.noData || 'No changes') : undefined}
          onClick={handleSaveClick}
        >
          {dict.common?.save || 'Save'}
        </Button>
      </div>
      <p className="text-xs text-muted text-right">
        {lastSavedAt
          ? (admin.rateLimitEffectiveHint || 'Effective within 60s · last saved {time}').replace('{time}', lastSavedAt)
          : admin.rateLimitNotSavedYet || 'Not saved yet; changes take effect within 60s'}
      </p>

      <Modal
        isOpen={confirmKind !== null}
        onClose={() => {
          if (!confirming) setConfirmKind(null);
        }}
        title={admin.confirmRiskyTitle || 'Confirm risky change?'}
      >
        <p className="text-sm text-muted">{confirmText}</p>
        <div className="mt-4 flex justify-end gap-3">
          <Button type="button" variant="ghost" disabled={confirming} onClick={() => setConfirmKind(null)}>
            {dict.common?.cancel || 'Cancel'}
          </Button>
          <Button type="button" variant="destructive" loading={confirming} onClick={() => void handleConfirm()}>
            {dict.common?.confirm || 'Confirm'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
