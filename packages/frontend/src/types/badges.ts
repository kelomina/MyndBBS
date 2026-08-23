/**
 * 用户徽章相关的前端类型定义。
 */

export type BadgeColorName =
  | 'gray'
  | 'red'
  | 'orange'
  | 'amber'
  | 'yellow'
  | 'lime'
  | 'green'
  | 'emerald'
  | 'teal'
  | 'cyan'
  | 'sky'
  | 'blue'
  | 'indigo'
  | 'violet'
  | 'purple'
  | 'fuchsia'
  | 'pink'
  | 'rose';

/** 管理面板中的徽章定义 */
export interface BadgeDto {
  id: string;
  code: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  type: 'SYSTEM' | 'CUSTOM';
  grantType: 'AUTO' | 'MANUAL';
  condition: BadgeConditionJson | null;
  isActive: boolean;
  sortOrder: number;
  holderCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface BadgeConditionJson {
  kind:
    | 'manual'
    | 'user_level'
    | 'post_count'
    | 'comment_count'
    | 'content_count'
    | 'night_activity';
  threshold?: number;
  startHour?: number;
  endHour?: number;
  utcOffsetHours?: number;
}

/** 公开资料中返回的用户徽章（精简展示字段） */
export interface ProfileBadge {
  id: string;
  code: string;
  name: string;
  icon: string | null;
  color: string | null;
  type: 'SYSTEM' | 'CUSTOM';
}

/** 某徽章的持有人记录 */
export interface BadgeHolder {
  userId: string;
  username: string;
  avatarUrl: string | null;
  grantedBy: string | null;
  grantedByUsername: string | null;
  reason: string | null;
  grantedAt: string;
}
