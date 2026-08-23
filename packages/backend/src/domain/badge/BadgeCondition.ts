/**
 * 值对象：BadgeCondition
 *
 * 函数作用：
 *   用户徽章的自动授予条件配置。解析并校验存储在 Badge.condition (Json) 中的条件，
 *   支持的条件类型（kind）：
 *     - manual          无自动条件，仅管理员/版主手动授予
 *     - user_level      用户安全等级达到 threshold（1-6）
 *     - post_count      已发布帖子数达到 threshold
 *     - comment_count   有效评论数达到 threshold
 *     - content_count   帖子+评论总数达到 threshold
 *     - night_activity  夜间时段（[startHour, endHour]，支持跨零点）发布内容达到 threshold
 *
 * Purpose:
 *   Value object describing the auto-grant condition of a badge. Parses and validates
 *   the JSON stored in Badge.condition.
 */
export type BadgeConditionKind =
  | 'manual'
  | 'user_level'
  | 'post_count'
  | 'comment_count'
  | 'content_count'
  | 'night_activity';

export interface BadgeConditionProps {
  kind: BadgeConditionKind;
  /** 达标阈值（user_level: 1-6；计数类: >=1） */
  threshold?: number;
  /** night_activity：夜间窗口起始小时 0-23（含） */
  startHour?: number;
  /** night_activity：夜间窗口结束小时 0-23（含），支持 startHour > endHour 表示跨零点 */
  endHour?: number;
  /** night_activity：用于本地化"夜间"的 UTC 偏移小时数，默认 +8（北京时间） */
  utcOffsetHours?: number;
}

const AUTO_KINDS: ReadonlySet<string> = new Set([
  'user_level',
  'post_count',
  'comment_count',
  'content_count',
  'night_activity',
]);

function isIntInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

/**
 * 判断 hour 是否落在 [startHour, endHour] 窗口内（支持跨零点的环形窗口）。
 * 纯函数，供评估器与测试复用。
 */
export function isHourInNightWindow(hour: number, startHour: number, endHour: number): boolean {
  if (!Number.isInteger(hour)) return false;
  if (startHour <= endHour) {
    return hour >= startHour && hour <= endHour;
  }
  // 跨零点：如 21 -> 6 表示 [21..23] ∪ [0..6]
  return hour >= startHour || hour <= endHour;
}

export class BadgeCondition {
  private constructor(private readonly props: BadgeConditionProps) {}

  /**
   * 构造一个"仅手动授予"的空条件。
   */
  public static manual(): BadgeCondition {
    return new BadgeCondition({ kind: 'manual' });
  }

  /**
   * 从持久化的 Json 值解析条件；不合法时抛出 ERR_BADGE_INVALID_CONDITION。
   */
  public static fromJson(json: unknown): BadgeCondition {
    if (json === null || json === undefined) {
      throw new Error('ERR_BADGE_INVALID_CONDITION');
    }
    const raw = json as Record<string, unknown>;
    const kind = raw.kind;

    if (kind === 'manual') {
      return new BadgeCondition({ kind: 'manual' });
    }

    if (typeof kind !== 'string' || !AUTO_KINDS.has(kind)) {
      throw new Error('ERR_BADGE_INVALID_CONDITION');
    }

    const props: BadgeConditionProps = { kind: kind as BadgeConditionKind };

    if (!isIntInRange(raw.threshold, 1, 1_000_000)) {
      throw new Error('ERR_BADGE_INVALID_CONDITION');
    }
    props.threshold = raw.threshold;

    if (kind === 'user_level' && !isIntInRange(props.threshold, 1, 6)) {
      throw new Error('ERR_BADGE_INVALID_CONDITION');
    }

    if (kind === 'night_activity') {
      if (!isIntInRange(raw.startHour, 0, 23) || !isIntInRange(raw.endHour, 0, 23)) {
        throw new Error('ERR_BADGE_INVALID_CONDITION');
      }
      props.startHour = raw.startHour;
      props.endHour = raw.endHour;
      if (raw.utcOffsetHours !== undefined) {
        if (!isIntInRange(raw.utcOffsetHours, -12, 14)) {
          throw new Error('ERR_BADGE_INVALID_CONDITION');
        }
        props.utcOffsetHours = raw.utcOffsetHours;
      }
    }

    return new BadgeCondition(props);
  }

  public get kind(): BadgeConditionKind {
    return this.props.kind;
  }

  public get isAuto(): boolean {
    return this.props.kind !== 'manual';
  }

  public get threshold(): number | undefined {
    return this.props.threshold;
  }

  public get startHour(): number | undefined {
    return this.props.startHour;
  }

  public get endHour(): number | undefined {
    return this.props.endHour;
  }

  public get utcOffsetHours(): number {
    return this.props.utcOffsetHours ?? 8;
  }

  /**
   * 序列化为可存入 Prisma Json 字段的普通对象。
   */
  public toJson(): Record<string, unknown> {
    if (this.props.kind === 'manual') {
      return { kind: 'manual' };
    }
    const out: Record<string, unknown> = { kind: this.props.kind, threshold: this.props.threshold };
    if (this.props.kind === 'night_activity') {
      out.startHour = this.props.startHour;
      out.endHour = this.props.endHour;
      out.utcOffsetHours = this.utcOffsetHours;
    }
    return out;
  }
}
