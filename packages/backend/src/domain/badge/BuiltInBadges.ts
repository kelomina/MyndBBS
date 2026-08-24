/**
 * 模块：内置徽章定义
 *
 * 函数作用：
 *   定义系统内置徽章的种子数据。服务启动时通过 bootstrapBadgeSeed 幂等播种：
 *   - kolostudio_official  KoloStudio 官方徽章（手动授予）
 *   - level_1 ~ level_6    对应用户安全等级 1-6（自动授予）
 *   - anti_drug_guardian   缉毒卫士（手动授予）
 *   - night_owl            夜猫子：北京时间 0-6 点发布内容 >= 10 条（自动授予）
 *   - chatterbox           话痨：发帖+评论总数 >= 100 条（自动授予）
 *
 * Purpose:
 *   Seed data for built-in (SYSTEM) badges, upserted idempotently at startup.
 */
import { BadgeCondition } from './BadgeCondition';
import { BadgeGrantMode } from './Badge';

export interface BuiltInBadgeDefinition {
  code: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  grantType: BadgeGrantMode;
  condition: BadgeCondition;
  sortOrder: number;
}

const LEVEL_METAS: ReadonlyArray<{ icon: string; color: string }> = [
  { icon: 'I', color: 'gray' },
  { icon: 'II', color: 'green' },
  { icon: 'III', color: 'sky' },
  { icon: 'IV', color: 'purple' },
  { icon: 'V', color: 'orange' },
  { icon: 'VI', color: 'rose' },
];

function levelMeta(level: number): { icon: string; color: string } {
  return LEVEL_METAS[level - 1] ?? { icon: String(level), color: 'gray' };
}

const LEVEL_BADGES: BuiltInBadgeDefinition[] = [1, 2, 3, 4, 5, 6].map((level) => ({
  code: `level_${level}`,
  name: `Level ${level}`,
  description: `Account security level reached ${level}.`,
  icon: levelMeta(level).icon,
  color: levelMeta(level).color,
  grantType: 'AUTO',
  condition: BadgeCondition.fromJson({ kind: 'user_level', threshold: level }),
  sortOrder: level,
}));

export const BUILT_IN_BADGES: BuiltInBadgeDefinition[] = [
  {
    code: 'kolostudio_official',
    name: 'KoloStudio Official',
    description: 'Official badge granted by KoloStudio team.',
    icon: '✦',
    color: 'amber',
    grantType: 'MANUAL',
    condition: BadgeCondition.manual(),
    sortOrder: 0,
  },
  ...LEVEL_BADGES,
  {
    code: 'anti_drug_guardian',
    name: 'Anti-Drug Guardian',
    description: 'Awarded to guardians whose reports were confirmed 3 times.',
    icon: '🛡️',
    color: 'emerald',
    grantType: 'AUTO',
    condition: BadgeCondition.fromJson({ kind: 'upheld_reports', threshold: 3 }),
    sortOrder: 100,
  },
  {
    code: 'night_owl',
    name: 'Night Owl',
    description: 'Published at least 10 posts or comments between 00:00 and 06:00.',
    icon: '🦉',
    color: 'indigo',
    grantType: 'AUTO',
    condition: BadgeCondition.fromJson({
      kind: 'night_activity',
      threshold: 10,
      startHour: 0,
      endHour: 6,
      utcOffsetHours: 8,
    }),
    sortOrder: 101,
  },
  {
    code: 'chatterbox',
    name: 'Chatterbox',
    description: 'Published at least 100 posts and comments in total.',
    icon: '💬',
    color: 'pink',
    grantType: 'AUTO',
    condition: BadgeCondition.fromJson({ kind: 'content_count', threshold: 100 }),
    sortOrder: 102,
  },
];
