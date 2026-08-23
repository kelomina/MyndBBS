export const APP_NAME = 'MyndBBS'
export const MAX_UPLOAD_SIZE = 5 * 1024 * 1024 // 5MB

/**
 * 徽章图标颜色调色板（前后端共享的合法颜色名）。
 * 前端负责把颜色名映射为具体的 Tailwind 类名（含 dark 变体）。
 */
export const BADGE_COLORS = [
  'gray',
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose',
] as const

export type BadgeColor = (typeof BADGE_COLORS)[number]
