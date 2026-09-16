export const APP_NAME = 'MyndBBS'
/**
 * 帖子正文插图/附件的上传上限（字节），单一真源，前后端共用。
 * 语义为「含边界」：size <= POST_ATTACHMENT_MAX_BYTES 必须通过，+1 字节必须被拒（FREEZE R1/R2）。
 * 工程面写裸字节 10485760，用户可见面显示 10MB。
 * 注意：multer/busboy 的 limits.fileSize 是「排他」语义（恰好等于即拒），
 * 使用本常量配置 multer 时必须 +1，该换算只允许出现在路由构造的收敛点（FREEZE R2）。
 */
export const POST_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024 // 10485760

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
