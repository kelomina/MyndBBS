/**
 * 实体：Badge
 *
 * 函数作用：
 *   用户徽章定义的聚合根。封装徽章的基本信息（名称/图标/颜色）、
 *   类型（SYSTEM 内置 / CUSTOM 自定义）、获取方式（AUTO 自动 / MANUAL 手动）
 *   以及自动授予条件，并维护相关不变量：
 *     - code 稳定且唯一，格式为小写字母/数字/下划线（2-64 位）
 *     - SYSTEM 徽章的业务字段不可变（仅允许启停/排序调整）
 *
 * Purpose:
 *   Aggregate root for badge definitions. Encapsulates display info, type,
 *   grant mode and auto-grant condition invariants.
 */
import { BadgeCondition } from './BadgeCondition';

export type BadgeType = 'SYSTEM' | 'CUSTOM';
export type BadgeGrantMode = 'AUTO' | 'MANUAL';

export interface BadgeProps {
  id: string;
  code: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  type: BadgeType;
  grantType: BadgeGrantMode;
  condition: BadgeCondition;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface BadgeDetailsPatch {
  name?: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  grantType?: BadgeGrantMode;
  condition?: BadgeCondition;
}

const CODE_REGEX = /^[a-z0-9_]{2,64}$/;

export class Badge {
  private constructor(private props: BadgeProps) {}

  /**
   * 从持久化记录重建实体（信任数据库中的既有值）。
   */
  public static fromPersistence(props: BadgeProps): Badge {
    return new Badge(props);
  }

  /**
   * 创建新徽章（仅 CUSTOM）。校验字段格式与长度。
   */
  public static create(props: Omit<BadgeProps, 'type' | 'createdAt' | 'updatedAt'>): Badge {
    if (!CODE_REGEX.test(props.code)) {
      throw new Error('ERR_BADGE_INVALID_CONDITION');
    }
    if (!props.name || props.name.length > 64) {
      throw new Error('ERR_BADGE_NAME_TOO_LONG');
    }
    if (props.description && props.description.length > 500) {
      throw new Error('ERR_BADGE_DESCRIPTION_TOO_LONG');
    }
    if (props.icon && props.icon.length > 8) {
      throw new Error('ERR_BADGE_ICON_TOO_LONG');
    }
    return new Badge({
      ...props,
      description: props.description ?? null,
      icon: props.icon ?? null,
      color: props.color ?? null,
      type: 'CUSTOM',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /**
   * 创建内置（SYSTEM）徽章。仅供启动种子使用；业务字段由代码定义，不可变。
   */
  public static createSystem(props: Omit<BadgeProps, 'type' | 'createdAt' | 'updatedAt'>): Badge {
    const badge = Badge.create(props);
    (badge as unknown as { props: BadgeProps }).props.type = 'SYSTEM';
    return badge;
  }

  // --- 访问器 ---
  public get id(): string { return this.props.id; }
  public get code(): string { return this.props.code; }
  public get name(): string { return this.props.name; }
  public get description(): string | null { return this.props.description; }
  public get icon(): string | null { return this.props.icon; }
  public get color(): string | null { return this.props.color; }
  public get type(): BadgeType { return this.props.type; }
  public get grantType(): BadgeGrantMode { return this.props.grantType; }
  public get condition(): BadgeCondition { return this.props.condition; }
  public get isActive(): boolean { return this.props.isActive; }
  public get sortOrder(): number { return this.props.sortOrder; }

  public isSystem(): boolean {
    return this.props.type === 'SYSTEM';
  }

  public get createdAt(): Date { return this.props.createdAt; }
  public get updatedAt(): Date { return this.props.updatedAt; }

  /**
   * 更新业务字段。SYSTEM 徽章仅允许启停与排序调整，
   * 其余字段变更抛出 ERR_BADGE_SYSTEM_IMMUTABLE。
   */
  public update(patch: BadgeDetailsPatch): void {
    if (this.isSystem()) {
      throw new Error('ERR_BADGE_SYSTEM_IMMUTABLE');
    }
    if (patch.name !== undefined) {
      if (!patch.name || patch.name.length > 64) {
        throw new Error('ERR_BADGE_NAME_TOO_LONG');
      }
      this.props.name = patch.name;
    }
    if (patch.description !== undefined) {
      if (patch.description && patch.description.length > 500) {
        throw new Error('ERR_BADGE_DESCRIPTION_TOO_LONG');
      }
      this.props.description = patch.description;
    }
    if (patch.icon !== undefined) {
      if (patch.icon && patch.icon.length > 8) {
        throw new Error('ERR_BADGE_ICON_TOO_LONG');
      }
      this.props.icon = patch.icon;
    }
    if (patch.color !== undefined) {
      this.props.color = patch.color;
    }
    if (patch.grantType !== undefined) {
      this.props.grantType = patch.grantType;
    }
    if (patch.condition !== undefined) {
      this.props.condition = patch.condition;
    }
    this.props.updatedAt = new Date();
  }

  public setActive(isActive: boolean): void {
    this.props.isActive = isActive;
    this.props.updatedAt = new Date();
  }

  /**
   * 同步内置徽章的定义字段（仅 SYSTEM 徽章可调用，与 update 的限制互逆）。
   * 供启动种子在代码演进时刷新内置定义；不影响启停状态与排序。
   */
  public syncSystemDefinition(patch: BadgeDetailsPatch): void {
    if (!this.isSystem()) {
      throw new Error('ERR_BADGE_SYSTEM_IMMUTABLE');
    }
    if (patch.name !== undefined) this.props.name = patch.name;
    if (patch.description !== undefined) this.props.description = patch.description;
    if (patch.icon !== undefined) this.props.icon = patch.icon;
    if (patch.color !== undefined) this.props.color = patch.color;
    if (patch.grantType !== undefined) this.props.grantType = patch.grantType;
    if (patch.condition !== undefined) this.props.condition = patch.condition;
    this.props.updatedAt = new Date();
  }

  public setSortOrder(sortOrder: number): void {
    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      throw new Error('ERR_BADGE_INVALID_CONDITION');
    }
    this.props.sortOrder = sortOrder;
    this.props.updatedAt = new Date();
  }
}
