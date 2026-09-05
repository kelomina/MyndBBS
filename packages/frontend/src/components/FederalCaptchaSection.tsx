'use client';

import React from 'react';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { useToast } from './ui/Toast';
import { useTranslation } from './TranslationProvider';
import { getFederalPolicy, updateFederalPolicy } from '../lib/api/admin';
import {
  FEDERAL_POLICY_DEFAULTS,
  type FederalProtectionConfig,
  type FederalKind,
} from '../types/protection';

type SaveState = 'idle' | 'saving' | 'success' | 'error';
type ConfirmKind = 'disable' | 'lowBits' | 'highBits' | 'reset' | null;

function isIntegerInRange(value: string, min: number, max: number): boolean {
  if (value.trim() === '') return false;
  // 严格语义：禁止 coerce——必须为十进制整数字符串，不接受 "16"/"16.0"/1.5
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
 * 联邦验证配置区（第五节，进站）。
 * 沿 RateLimitPolicySection：三开关至少保 1 + 默认题型 select + bits 8–24 + 复杂度 1–3 + timeoutSec 5–60，
 * strict zod 前端镜像（越界行内红错不 clamp）+ 危险二次确认 + 保存四态 + 60s 生效行。
 * 注：任务书“strictTimeout”仅为前端行为提示（几何 idle 默认 60s/严格 15s；PoW 统一 10s），
 * 不属 API 字段（6 字段 additionalProperties:false），此处仅 hint 展示不参与 PUT。
 * 仅 isAdmin 可见由路由层保证；MODERATOR/匿名由后端 403/404 兜底。
 */
export function FederalCaptchaSection() {
  const { toast } = useToast();
  const dict = useTranslation();
  const admin = React.useMemo(
    () => ((dict.admin as unknown as Record<string, unknown>).federal ?? {}) as Record<string, string>,
    [dict.admin],
  );
  const adminRoot = React.useMemo(() => (dict.admin ?? {}) as unknown as Record<string, string>, [dict.admin]);
  const apiErrors = React.useMemo(
    () => (dict.apiErrors ?? {}) as unknown as Record<string, string>,
    [dict.apiErrors],
  );

  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState('');
  const [saved, setSaved] = React.useState<FederalProtectionConfig | null>(null);
  const [enabled, setEnabled] = React.useState(true);
  const [sliderOn, setSliderOn] = React.useState(true);
  const [geometryOn, setGeometryOn] = React.useState(true);
  const [powOn, setPowOn] = React.useState(true);
  const [defaultKind, setDefaultKind] = React.useState<FederalKind>('slider');
  const [powBitsRaw, setPowBitsRaw] = React.useState('16');
  const [levelRaw, setLevelRaw] = React.useState('1');
  const [timeoutRaw, setTimeoutRaw] = React.useState('10');
  const [saveState, setSaveState] = React.useState<SaveState>('idle');
  const [fieldError, setFieldError] = React.useState('');
  const [confirmKind, setConfirmKind] = React.useState<ConfirmKind>(null);
  const [confirming, setConfirming] = React.useState(false);
  const [lastSavedAt, setLastSavedAt] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const policy = await getFederalPolicy();
      setSaved(policy);
      setEnabled(policy.enabled);
      setSliderOn(policy.kinds.sliderEnabled);
      setGeometryOn(policy.kinds.geometryEnabled);
      setPowOn(policy.kinds.powEnabled);
      setDefaultKind(policy.defaultKind);
      setPowBitsRaw(String(policy.powBits));
      setLevelRaw(String(policy.geometryLevel));
      setTimeoutRaw(String(policy.timeoutSec));
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

  const powValid = isIntegerInRange(powBitsRaw, 8, 24);
  const levelValid = isIntegerInRange(levelRaw, 1, 3);
  const timeoutValid = isIntegerInRange(timeoutRaw, 5, 60);
  const kindsCount = (sliderOn ? 1 : 0) + (geometryOn ? 1 : 0) + (powOn ? 1 : 0);
  const kindsValid = kindsCount >= 1;
  const defaultKindValid =
    (defaultKind === 'slider' && sliderOn) ||
    (defaultKind === 'geometry' && geometryOn) ||
    (defaultKind === 'pow' && powOn);
  const formValid = powValid && levelValid && timeoutValid && kindsValid && defaultKindValid;

  const powNum = parseStrictInt(powBitsRaw);
  const showPowError = powBitsRaw.trim() !== '' && !powValid;
  const showLevelError = levelRaw.trim() !== '' && !levelValid;
  const showTimeoutError = timeoutRaw.trim() !== '' && !timeoutValid;

  const current: FederalProtectionConfig = React.useMemo(
    () => ({
      enabled,
      kinds: { sliderEnabled: sliderOn, geometryEnabled: geometryOn, powEnabled: powOn },
      defaultKind,
      powBits: powNum ?? FEDERAL_POLICY_DEFAULTS.powBits,
      geometryLevel: (parseStrictInt(levelRaw) ?? FEDERAL_POLICY_DEFAULTS.geometryLevel) as 1 | 2 | 3,
      timeoutSec: parseStrictInt(timeoutRaw) ?? FEDERAL_POLICY_DEFAULTS.timeoutSec,
    }),
    [enabled, sliderOn, geometryOn, powOn, defaultKind, powNum, levelRaw, timeoutRaw],
  );

  const dirty = React.useMemo(() => {
    if (!saved) return formValid;
    return (
      saved.enabled !== current.enabled ||
      saved.kinds.sliderEnabled !== current.kinds.sliderEnabled ||
      saved.kinds.geometryEnabled !== current.kinds.geometryEnabled ||
      saved.kinds.powEnabled !== current.kinds.powEnabled ||
      saved.defaultKind !== current.defaultKind ||
      saved.powBits !== current.powBits ||
      saved.geometryLevel !== current.geometryLevel ||
      saved.timeoutSec !== current.timeoutSec
    );
  }, [saved, current, formValid]);

  const needsDisableConfirm = saved?.enabled === true && enabled === false;
  const needsLowBitsConfirm = powValid && powNum !== null && powNum <= 8;
  const needsHighBitsConfirm = powValid && powNum !== null && powNum >= 24;

  const doSave = React.useCallback(async () => {
    if (!formValid) return;
    setSaveState('saving');
    setFieldError('');
    try {
      const result = await updateFederalPolicy(current);
      const policy = (result as { policy?: FederalProtectionConfig }).policy ?? (result as unknown as FederalProtectionConfig);
      setSaved(policy);
      setLastSavedAt(new Date().toLocaleTimeString());
      setSaveState('success');
      toast(admin.saved || 'Federal config saved (effective ≤60s)', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      const mapped = apiErrors[msg] || msg || admin.failedToSave || 'Failed to save federal config';
      setFieldError(mapped);
      setSaveState('error');
      toast(mapped, 'error');
    }
  }, [formValid, current, toast, admin.saved, admin.failedToSave, apiErrors]);

  const handleSaveClick = React.useCallback(() => {
    if (!formValid || !dirty || saveState === 'saving') return;
    if (needsDisableConfirm) {
      setConfirmKind('disable');
      return;
    }
    if (needsLowBitsConfirm) {
      setConfirmKind('lowBits');
      return;
    }
    if (needsHighBitsConfirm) {
      setConfirmKind('highBits');
      return;
    }
    void doSave();
  }, [formValid, dirty, saveState, needsDisableConfirm, needsLowBitsConfirm, needsHighBitsConfirm, doSave]);

  const handleConfirm = React.useCallback(async () => {
    if (confirmKind === 'reset') {
      setConfirming(true);
      try {
        setEnabled(FEDERAL_POLICY_DEFAULTS.enabled);
        setSliderOn(FEDERAL_POLICY_DEFAULTS.kinds.sliderEnabled);
        setGeometryOn(FEDERAL_POLICY_DEFAULTS.kinds.geometryEnabled);
        setPowOn(FEDERAL_POLICY_DEFAULTS.kinds.powEnabled);
        setDefaultKind(FEDERAL_POLICY_DEFAULTS.defaultKind);
        setPowBitsRaw(String(FEDERAL_POLICY_DEFAULTS.powBits));
        setLevelRaw(String(FEDERAL_POLICY_DEFAULTS.geometryLevel));
        setTimeoutRaw(String(FEDERAL_POLICY_DEFAULTS.timeoutSec));
        setFieldError('');
        setSaveState('idle');
      } finally {
        setConfirming(false);
        setConfirmKind(null);
      }
      return;
    }
    setConfirming(true);
    try {
      await doSave();
    } finally {
      setConfirming(false);
      setConfirmKind(null);
    }
  }, [confirmKind, doSave]);

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h2 className="font-semibold">{admin.title || 'Federal challenge types & difficulty'}</h2>
        <div className="text-sm text-muted">{dict.common?.loading || 'Loading...'}</div>
      </div>
    );
  }

  if (loadError && !saved) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h2 className="font-semibold">{admin.title || 'Federal challenge types & difficulty'}</h2>
        <div className="text-sm text-red-500" role="alert">{loadError}</div>
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => void load()}>{dict.common?.confirm || 'Retry'}</Button>
        </div>
      </div>
    );
  }

  const confirmText =
    confirmKind === 'disable'
      ? admin.confirmDisable || 'Disabling federal stops new types; users only see slider. Save anyway?'
      : confirmKind === 'lowBits'
        ? admin.powBitsDanger || 'Very low bits (≤8) make scripts pass easily. Save anyway?'
        : confirmKind === 'highBits'
          ? admin.powBitsHighWarn || 'Max bits (24) may take minutes on low-end devices. Save anyway?'
          : confirmKind === 'reset'
            ? admin.confirmReset || 'Reset to defaults? Current edits will be overwritten.'
            : '';

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-4">
      <div>
        <h2 className="font-semibold">{admin.title || 'Federal challenge types & difficulty'}</h2>
        <p className="text-sm text-muted">{admin.desc || 'Toggle slider/geometry/PoW, default type, PoW difficulty and geometry complexity. Takes effect within 60s.'}</p>
      </div>

      {/* Row1：总开关 */}
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          disabled={saveState === 'saving'}
          className="mt-0.5 accent-primary"
        />
        <span>
          <span className="font-medium">{admin.enabled || 'Enable federal challenges'}</span>
          <span className="block text-xs text-muted">{admin.enabledHint || 'Off = all fall back to slider-low, no new types'}</span>
        </span>
      </label>

      {/* Row2：三开关（至少保 1） */}
      <div className="space-y-2">
        <span className="text-sm font-medium" id="federal-kinds-label">{admin.kindsTitle || 'Challenge switches (keep at least 1)'}</span>
        <div role="group" aria-labelledby="federal-kinds-label" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={sliderOn} onChange={(e) => setSliderOn(e.target.checked)} disabled={saveState === 'saving'} className="accent-primary" />
            {admin.sliderEnabled || 'Slider'}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={geometryOn} onChange={(e) => setGeometryOn(e.target.checked)} disabled={saveState === 'saving'} className="accent-primary" />
            {admin.geometryEnabled || 'Geometry & spatial'}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={powOn} onChange={(e) => setPowOn(e.target.checked)} disabled={saveState === 'saving'} className="accent-primary" />
            {admin.powEnabled || 'Proof-of-work'}
          </label>
        </div>
        {!kindsValid && (
          <p role="alert" className="text-sm text-red-500">{admin.confirmAllOff || 'Keep at least 1 type enabled; all-off cannot be saved.'}</p>
        )}
      </div>

      {/* Row3：默认题型 select（选项随开关联动禁用） */}
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="federal-default">{admin.defaultKind || 'Default challenge'}</label>
        <select
          id="federal-default"
          value={defaultKind}
          onChange={(e) => setDefaultKind(e.target.value as FederalKind)}
          disabled={saveState === 'saving'}
          aria-invalid={!defaultKindValid}
          className="w-full rounded-md border border-border bg-background px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="slider" disabled={!sliderOn}>{admin.kindSlider || 'Slider'}</option>
          <option value="geometry" disabled={!geometryOn}>{admin.kindGeometry || 'Geometry'}</option>
          <option value="pow" disabled={!powOn}>{admin.kindPow || 'Proof-of-work'}</option>
        </select>
        <p className="text-xs text-muted">{admin.defaultKindHint || 'Issued when kind omitted; falls back slider→geometry→PoW if disabled'}</p>
        {!defaultKindValid && (
          <p role="alert" className="text-sm text-red-500">{admin.confirmDefaultKindOff || 'Default type points to a disabled type and cannot be saved.'}</p>
        )}
      </div>

      {/* Row4：PoW bits + 几何复杂度 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="federal-bits">
            {admin.powBits || 'PoW difficulty bits'}
            <output aria-live="polite" className="ml-2 rounded bg-muted/40 px-2 py-0.5 text-xs">{powBitsRaw}</output>
          </label>
          <input
            id="federal-bits"
            type="range"
            min={8}
            max={24}
            step={1}
            value={powNum ?? 8}
            onChange={(e) => setPowBitsRaw(e.target.value)}
            disabled={saveState === 'saving'}
            className="w-full accent-primary"
          />
          <div className="flex gap-2">
            <input
              type="number"
              min={8}
              max={24}
              step={1}
              value={powBitsRaw}
              onChange={(e) => setPowBitsRaw(e.target.value)}
              disabled={saveState === 'saving'}
              aria-label={admin.powBits || 'PoW difficulty bits'}
              aria-invalid={showPowError}
              className="w-28 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <p className="self-center text-xs text-muted">{admin.powBitsHint || 'Integer 8–24, default 16; lowering to 8 weakens bot defense'}</p>
          </div>
          {showPowError && (
            <p role="alert" className="text-sm text-red-500">{admin.invalidPowBits || 'PoW difficulty must be an integer 8–24'}</p>
          )}
          {powValid && powNum !== null && powNum <= 8 && !showPowError && (
            <p className="text-xs text-amber-600 dark:text-amber-400">{admin.powBitsDanger || 'Very low bits (≤8) make scripts pass easily. Save anyway?'}</p>
          )}
          {powValid && powNum !== null && powNum >= 24 && !showPowError && (
            <p className="text-xs text-amber-600 dark:text-amber-400">{admin.powBitsHighWarn || 'Max bits (24) may take minutes on low-end devices. Save anyway?'}</p>
          )}
        </div>
        <div className="space-y-2">
          <span className="text-sm font-medium" id="federal-level-label">{admin.geometryLevel || 'Geometry complexity'}</span>
          <div role="radiogroup" aria-labelledby="federal-level-label" className="flex rounded-lg bg-muted/40 p-1 gap-1">
            {(['1', '2', '3'] as const).map((lv) => {
              const selected = levelRaw === lv;
              const label = lv === '1' ? admin.level1 || 'Easy' : lv === '2' ? admin.level2 || 'Normal' : admin.level3 || 'Strict';
              return (
                <button
                  key={lv}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={saveState === 'saving'}
                  onClick={() => setLevelRaw(lv)}
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
          <p className="text-xs text-muted" aria-live="polite">{admin.geometryLevelHint || 'Levels 1–3, default 1; complexity only, not tolerance'}</p>
          {showLevelError && (
            <p role="alert" className="text-sm text-red-500">{admin.invalidLevel || 'Geometry complexity must be an integer 1–3'}</p>
          )}
        </div>
      </div>

      {/* Row5：timeoutSec + strictTimeoutHint（仅展示，不参与 PUT，见文件头注） */}
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="federal-timeout">{admin.timeoutSec || 'Solve timeout (sec)'}</label>
        <input
          id="federal-timeout"
          type="number"
          min={5}
          max={60}
          step={1}
          value={timeoutRaw}
          onChange={(e) => setTimeoutRaw(e.target.value)}
          disabled={saveState === 'saving'}
          aria-invalid={showTimeoutError}
          aria-describedby="federal-timeout-hint federal-timeout-error"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <p id="federal-timeout-hint" className="text-xs text-muted">
          {(admin.timeoutSecHint || 'Integer 5–60, default 10; exceeded falls back to slider') + ' · ' + (admin.strictTimeoutHint || 'Geometry idle timeout: 60s default, 15s strict; PoW always 10s')}
        </p>
        {showTimeoutError && (
          <p id="federal-timeout-error" role="alert" className="text-sm text-red-500">{admin.invalidTimeout || 'Solve timeout must be an integer 5–60'}</p>
        )}
      </div>

      {fieldError && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
          {fieldError}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="ghost" disabled={saveState === 'saving'} onClick={() => setConfirmKind('reset')}>
          {adminRoot.resetDefaults || 'Reset to defaults'}
        </Button>
        <Button
          type="button"
          loading={saveState === 'saving'}
          disabled={!formValid || !dirty || saveState === 'saving'}
          title={!formValid ? (admin.invalidPowBits || 'Fix invalid fields') : !dirty ? (dict.common?.noData || 'No changes') : undefined}
          onClick={handleSaveClick}
        >
          {dict.common?.save || 'Save'}
        </Button>
      </div>
      <p className="text-xs text-muted text-right">
        {lastSavedAt
          ? (admin.effectiveHint || 'Effective within 60s · last saved {time}').replace('{time}', lastSavedAt)
          : admin.notSavedYet || 'Not saved yet; changes take effect within 60s'}
      </p>

      <Modal
        isOpen={confirmKind !== null}
        onClose={() => {
          if (!confirming) setConfirmKind(null);
        }}
        title={adminRoot.confirmRiskyTitle || 'Confirm risky change?'}
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
