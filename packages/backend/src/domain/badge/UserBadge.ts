/**
 * 实体：UserBadge
 *
 * 函数作用：
 *   "用户持有徽章"关联实体。记录授予时间、授予者（null 表示系统自动授予）
 *   与可选的授予原因。同一 (userId, badgeId) 组合唯一，由数据库层保证。
 *
 * Purpose:
 *   Entity linking a user to a badge they hold, recording grant metadata.
 */
export interface UserBadgeProps {
  id: string;
  userId: string;
  badgeId: string;
  grantedBy: string | null;
  reason: string | null;
  createdAt: Date;
}

export class UserBadge {
  private constructor(private props: UserBadgeProps) {}

  /**
   * 创建一条新的持有记录。要求 userId/badgeId 非空。
   */
  public static grant(props: {
    id: string;
    userId: string;
    badgeId: string;
    grantedBy?: string | null;
    reason?: string | null;
  }): UserBadge {
    if (!props.userId || !props.badgeId) {
      throw new Error('ERR_BAD_REQUEST');
    }
    return new UserBadge({
      ...props,
      grantedBy: props.grantedBy ?? null,
      reason: props.reason ?? null,
      createdAt: new Date(),
    });
  }

  /**
   * 从持久化记录重建实体。
   */
  public static fromPersistence(props: UserBadgeProps): UserBadge {
    return new UserBadge(props);
  }

  public get id(): string { return this.props.id; }
  public get userId(): string { return this.props.userId; }
  public get badgeId(): string { return this.props.badgeId; }
  public get grantedBy(): string | null { return this.props.grantedBy; }
  public get reason(): string | null { return this.props.reason; }
  public get createdAt(): Date { return this.props.createdAt; }
}
