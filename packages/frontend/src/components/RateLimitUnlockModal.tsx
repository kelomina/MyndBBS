'use client';

import React from 'react';
import { FederalCaptchaModal } from './federal/FederalCaptchaModal';
import { useTranslation } from './TranslationProvider';
import type { Dictionary } from '../types';

export type UnlockModalState = 'idle' | 'verifying' | 'success' | 'error' | 'cooldown';

interface RateLimitUnlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 来自 429 retryAfterSec，本地倒计时展示用 */
  retryAfterSec: number;
  /** 解锁凭证就绪 → 调用方重试原请求（最多 1 次自动重试） */
  onUnlocked: (info: { exemptMinutes: number; expiresAt: string }) => void;
  dict?: Dictionary;
}

/**
 * 读限流解锁弹窗（F1 + 联邦接入 + v1.0.2 去 H2 门控）。
 * 联邦增量：解锁流程按服务端默认题型调 federal issue/verify（替代直调旧 verify），
 * X-RateLimit-Unlock 载体不变（header-only，经 fetcher 自动附头，BFF 零改）。
 * 实现为 FederalCaptchaModal mode=unlock 薄封装：
 * - 三题型均先 federal verify 拿 redeemToken，再凭 {redeemToken,kind} 调 POST /unlock 联邦兑换换 token
 *  （失败统一 error 态 + 1.5s 换题，不静默；兑换超限走 cooldown）；
 * - 旧滑块直兑 {captchaId,dragPath,totalDragTime,finalPosition} 仅 legacy fallbackSlider 保留兼容；
 * - 五态 idle/verifying/success/error/cooldown 由联邦 modal 承接（超集 timeout/degraded 仅内部展示，对外仍五态可断言）。
 * 现有 5 处 SliderCaptcha 调用零改；本文件保留 UnlockModalState 导出供旧岛屿类型兼容。
 */
export function RateLimitUnlockModal({ isOpen, onClose, retryAfterSec, onUnlocked, dict: dictProp }: RateLimitUnlockModalProps) {
  const hookDict = useTranslation();
  const dict = (dictProp ?? hookDict) as Dictionary;
  return (
    <FederalCaptchaModal
      isOpen={isOpen}
      onClose={onClose}
      retryAfterSec={retryAfterSec}
      mode="unlock"
      dict={dict}
      onUnlocked={onUnlocked}
    />
  );
}
