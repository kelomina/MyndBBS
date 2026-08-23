'use client'

import { BADGE_COLORS } from '@myndbbs/shared'
import type { ProfileBadge } from '../types/badges'

/**
 * 徽章颜色名 → Tailwind 类名（含 dark 变体）映射。
 * 合法颜色名集合与 @myndbbs/shared 的 BADGE_COLORS 保持一致。
 */
const BADGE_COLOR_CLASSES: Record<(typeof BADGE_COLORS)[number], string> = {
  gray: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  red: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  orange: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  lime: 'bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-300',
  green: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  emerald: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  teal: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  cyan: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  sky: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
  blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  indigo: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  violet: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
  purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  fuchsia: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-300',
  pink: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  rose: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
}

export interface BadgeDictSlice {
  badges?: {
    builtin?: Record<string, { name?: string; desc?: string }>
  }
}

/**
 * 解析徽章的本地化显示名：SYSTEM 徽章优先使用字典中的内置翻译，
 * 否则回退到数据库中的名称。
 */
export function resolveBadgeName(
  badge: Pick<ProfileBadge, 'code' | 'name' | 'type'>,
  dict?: BadgeDictSlice,
): string {
  if (badge.type === 'SYSTEM') {
    const builtin = dict?.badges?.builtin?.[badge.code]
    if (builtin?.name) return builtin.name
  }
  return badge.name
}

/** 解析徽章的本地化描述（用于悬浮提示） */
export function resolveBadgeDescription(
  badge: Pick<ProfileBadge, 'code' | 'type'> & { description?: string | null },
  dict?: BadgeDictSlice,
): string | null {
  if (badge.type === 'SYSTEM') {
    const builtin = dict?.badges?.builtin?.[badge.code]
    if (builtin?.desc) return builtin.desc
  }
  return badge.description ?? null
}

interface BadgeChipProps {
  badge: Pick<ProfileBadge, 'code' | 'name' | 'icon' | 'color' | 'type'> & {
    description?: string | null
  }
  dict?: BadgeDictSlice
  /** 紧凑模式：仅显示图标，悬浮提示本地化名称/描述（用于评论区等窄空间） */
  compact?: boolean
}

/** 徽章胶囊：图标 + 名称，按调色板着色；compact 模式仅图标 + 悬浮提示 */
export function BadgeChip({ badge, dict, compact = false }: BadgeChipProps) {
  const colorClass =
    BADGE_COLOR_CLASSES[(badge.color ?? 'gray') as keyof typeof BADGE_COLOR_CLASSES] ??
    BADGE_COLOR_CLASSES.gray
  const label = resolveBadgeName(badge, dict)
  const tip = resolveBadgeDescription(badge, dict)
  const title = tip ? `${label} · ${tip}` : label

  if (compact) {
    return (
      <span
        className={`inline-flex h-4 items-center rounded-full px-1 text-[10px] leading-none ${colorClass}`}
        title={title}
      >
        {badge.icon && <span aria-hidden>{badge.icon}</span>}
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass}`}
      title={tip ?? label}
    >
      {badge.icon && <span aria-hidden>{badge.icon}</span>}
      <span>{label}</span>
    </span>
  )
}
