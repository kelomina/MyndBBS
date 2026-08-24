'use client'

import React, { useState } from 'react'
import { Flag } from 'lucide-react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { useTranslation } from './TranslationProvider'
import { useToast } from './ui/Toast'
import { submitReport } from '../lib/api/reports'
import type { ReportReason, ReportTargetType } from '../types/reports'

const REPORT_REASONS: ReportReason[] = [
  'SPAM',
  'PORNOGRAPHY',
  'ILLEGAL',
  'ABUSE',
  'COPYRIGHT',
  'OTHER',
]

const REASON_FALLBACK: Record<ReportReason, string> = {
  SPAM: 'Spam or advertising',
  PORNOGRAPHY: 'Pornography or inappropriate content',
  ILLEGAL: 'Illegal content',
  ABUSE: 'Harassment or abuse',
  COPYRIGHT: 'Copyright infringement',
  OTHER: 'Other',
}

interface ReportDialogProps {
  isOpen: boolean
  onClose: () => void
  targetType: ReportTargetType
  postId: string
  commentId?: string
}

/**
 * 用户举报弹窗：理由单选 + OTHER 补充说明。
 * 成功后关闭弹窗并 toast 反馈；失败保留弹窗展示原因。
 */
export function ReportDialog({ isOpen, onClose, targetType, postId, commentId }: ReportDialogProps) {
  const dict = useTranslation()
  const { toast } = useToast()
  const [reason, setReason] = useState<ReportReason>('SPAM')
  const [detail, setDetail] = useState('')
  const [loading, setLoading] = useState(false)

  const reasonLabel = (key: ReportReason): string =>
    dict.report?.reasons?.[key] || REASON_FALLBACK[key]

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try {
      setLoading(true)
      await submitReport({
        targetType,
        postId,
        ...(commentId ? { commentId } : {}),
        reason,
        ...(reason === 'OTHER' ? { detail: detail.trim() || undefined } : {}),
      })
      toast(dict.report?.submitted || 'Report submitted. Thank you!', 'success')
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      toast(
        (dict.apiErrors as Record<string, string>)?.[msg] ||
          dict.report?.failed ||
          msg ||
          'Failed to submit report',
        'error',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        targetType === 'POST'
          ? dict.report?.postTitle || 'Report this post'
          : dict.report?.commentTitle || 'Report this comment'
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          {REPORT_REASONS.map((key) => (
            <label
              key={key}
              className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                reason === key
                  ? 'border-primary bg-primary/5 text-foreground'
                  : 'border-border hover:bg-accent/50'
              }`}
            >
              <input
                type="radio"
                name="report-reason"
                value={key}
                checked={reason === key}
                onChange={() => setReason(key)}
                className="accent-primary"
              />
              {reasonLabel(key)}
            </label>
          ))}
        </div>

        {reason === 'OTHER' && (
          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            rows={3}
            maxLength={500}
            required
            placeholder={dict.report?.detailPlaceholder || 'Please describe the issue (required)'}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        )}

        <p className="text-xs text-muted">
          {dict.report?.notice || 'Abuse of the report system may lead to action on your account.'}
        </p>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" disabled={loading} onClick={onClose}>
            {dict.common?.cancel || 'Cancel'}
          </Button>
          <Button type="submit" loading={loading} leftIcon={<Flag className="h-4 w-4" />}>
            {dict.report?.submit || 'Submit report'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
