/**
 * 应用服务：BadgeApplicationService
 *
 * 函数作用：
 *   徽章限界上下文的应用服务，编排以下用例：
 *     1. 管理端徽章定义 CRUD（SYSTEM 徽章受领域实体保护不可变）
 *     2. 手动授予 / 撤销用户徽章（管理员全权，全局版主可授予/撤销）
 *     3. 自动评估：按启用中的 AUTO 徽章条件批量计算达标用户并授予（幂等），
 *        授予成功时发送系统通知
 *
 * Purpose:
 *   Application service for the badge bounded context: definition CRUD,
 *   manual grant/revoke, and periodic auto-grant evaluation.
 */
import { randomUUID } from 'crypto';
import { Badge, type BadgeDetailsPatch, type BadgeGrantMode } from '../../domain/badge/Badge';
import { BadgeCondition } from '../../domain/badge/BadgeCondition';
import { IBadgeRepository } from '../../domain/badge/IBadgeRepository';
import { ContentCountsByAuthor, IBadgeStatsPort } from '../../domain/badge/IBadgeStatsPort';
import { IUserBadgeRepository } from '../../domain/badge/IUserBadgeRepository';
import { UserBadge } from '../../domain/badge/UserBadge';
import { INotificationRepository } from '../../domain/notification/INotificationRepository';
import { Notification } from '../../domain/notification/Notification';
import { IUnitOfWork } from '../../domain/shared/IUnitOfWork';

export interface BadgeManagementServiceOptions {
  badgeRepository: IBadgeRepository;
  userBadgeRepository: IUserBadgeRepository;
  statsPort: IBadgeStatsPort;
  notificationRepository: INotificationRepository;
  unitOfWork: IUnitOfWork;
}

export interface CreateBadgeInput {
  code: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  grantType: BadgeGrantMode;
  conditionJson?: unknown;
  isActive?: boolean;
  sortOrder?: number;
}

export interface UpdateBadgeInput extends Partial<Omit<CreateBadgeInput, 'code'>> {}

export interface BadgeWithHolderCount {
  id: string;
  code: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  type: 'SYSTEM' | 'CUSTOM';
  grantType: BadgeGrantMode;
  condition: Record<string, unknown> | null;
  isActive: boolean;
  sortOrder: number;
  holderCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface EvaluationResult {
  evaluatedBadges: number;
  grantedCount: number;
}

/** grantType 与条件 kind 的联动约束：AUTO 必须携带真实条件；MANUAL 一律落为 manual */
function resolveCondition(grantType: BadgeGrantMode, conditionJson: unknown): BadgeCondition {
  if (grantType === 'MANUAL') {
    return BadgeCondition.manual();
  }
  const condition = BadgeCondition.fromJson(conditionJson);
  if (!condition.isAuto) {
    throw new Error('ERR_BADGE_INVALID_CONDITION');
  }
  return condition;
}

export class BadgeApplicationService {
  constructor(private readonly opts: BadgeManagementServiceOptions) {}

  // ── 定义管理 ──

  public async createBadge(input: CreateBadgeInput): Promise<Badge> {
    const condition = resolveCondition(input.grantType, input.conditionJson);
    const existing = await this.opts.badgeRepository.findByCode(input.code);
    if (existing) {
      throw new Error('ERR_BADGE_CODE_ALREADY_EXISTS');
    }
    const badge = Badge.create({
      id: randomUUID(),
      code: input.code,
      name: input.name,
      description: input.description ?? null,
      icon: input.icon ?? null,
      color: input.color ?? null,
      grantType: input.grantType,
      condition,
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? 0,
    });
    await this.opts.unitOfWork.execute(() => this.opts.badgeRepository.save(badge));
    return badge;
  }

  public async updateBadge(badgeId: string, input: UpdateBadgeInput): Promise<Badge> {
    const badge = await this.getBadgeOrThrow(badgeId);

    if (badge.isSystem()) {
      // SYSTEM 徽章只允许启停与排序；任何业务字段变更一律拒绝
      const hasBusinessFieldChange =
        input.name !== undefined ||
        input.description !== undefined ||
        input.icon !== undefined ||
        input.color !== undefined ||
        input.grantType !== undefined ||
        input.conditionJson !== undefined;
      if (hasBusinessFieldChange) {
        throw new Error('ERR_BADGE_SYSTEM_IMMUTABLE');
      }
      if (input.isActive !== undefined) badge.setActive(input.isActive);
      if (input.sortOrder !== undefined) badge.setSortOrder(input.sortOrder);
    } else {
      const patch: BadgeDetailsPatch = {};
      if (input.name !== undefined) patch.name = input.name;
      if (input.description !== undefined) patch.description = input.description ?? null;
      if (input.icon !== undefined) patch.icon = input.icon ?? null;
      if (input.color !== undefined) patch.color = input.color ?? null;
      if (input.grantType !== undefined) {
        patch.grantType = input.grantType;
        patch.condition = resolveCondition(input.grantType, input.conditionJson);
      }
      badge.update(patch);
      if (input.isActive !== undefined) badge.setActive(input.isActive);
      if (input.sortOrder !== undefined) badge.setSortOrder(input.sortOrder);
    }

    await this.opts.unitOfWork.execute(() => this.opts.badgeRepository.save(badge));
    return badge;
  }

  public async deleteBadge(badgeId: string): Promise<void> {
    const badge = await this.getBadgeOrThrow(badgeId);
    if (badge.isSystem()) {
      throw new Error('ERR_BADGE_CANNOT_DELETE_SYSTEM');
    }
    await this.opts.unitOfWork.execute(() => this.opts.badgeRepository.delete(badge.id));
  }

  public async listBadges(): Promise<BadgeWithHolderCount[]> {
    const [badges, holderCounts] = await Promise.all([
      this.opts.badgeRepository.findAll(),
      this.opts.badgeRepository.countHoldersGrouped(),
    ]);
    return badges.map((badge) => ({
      id: badge.id,
      code: badge.code,
      name: badge.name,
      description: badge.description,
      icon: badge.icon,
      color: badge.color,
      type: badge.type,
      grantType: badge.grantType,
      condition: badge.condition.toJson(),
      isActive: badge.isActive,
      sortOrder: badge.sortOrder,
      holderCount: holderCounts.get(badge.id) ?? 0,
      createdAt: badge.createdAt,
      updatedAt: badge.updatedAt,
    }));
  }

  // ── 手动授予 / 撤销 ──

  public async grantBadgeToUser(
    operatorId: string,
    badgeId: string,
    targetUserId: string,
    reason?: string | null,
  ): Promise<UserBadge> {
    return this.opts.unitOfWork.execute(async () => {
      const badge = await this.getBadgeOrThrow(badgeId);
      if (!badge.isActive) {
        throw new Error('ERR_BADGE_INACTIVE');
      }
      const existing = await this.opts.userBadgeRepository.findByUserAndBadge(targetUserId, badgeId);
      if (existing) {
        throw new Error('ERR_BADGE_ALREADY_OWNED');
      }
      const userBadge = UserBadge.grant({
        id: randomUUID(),
        userId: targetUserId,
        badgeId,
        grantedBy: operatorId,
        reason: reason ?? null,
      });
      await this.opts.userBadgeRepository.save(userBadge);
      return userBadge;
    });
  }

  public async revokeBadgeFromUser(
    operatorId: string,
    badgeId: string,
    targetUserId: string,
  ): Promise<void> {
    await this.opts.unitOfWork.execute(async () => {
      await this.getBadgeOrThrow(badgeId);
      const removed = await this.opts.userBadgeRepository.remove(targetUserId, badgeId);
      if (!removed) {
        throw new Error('ERR_BADGE_NOT_OWNED');
      }
      void operatorId;
    });
  }

  // ── 自动评估 ──

  /**
   * 全量评估所有启用的 AUTO 徽章并授予新达标用户。
   * 由周期任务调用；幂等（已有持有记录的用户自动跳过）。
   */
  public async evaluateAndGrantAll(): Promise<EvaluationResult> {
    const autoBadges = await this.opts.badgeRepository.findAllActiveAuto();
    let grantedCount = 0;

    if (autoBadges.length === 0) {
      return { evaluatedBadges: 0, grantedCount: 0 };
    }

    // 按条件类型复用统计查询，避免同一周期重复聚合
    const levelIdsCache = new Map<number, Promise<string[]>>();
    const nightCountsCache = new Map<string, Promise<Map<string, number>>>();
    let contentCountsResult: ContentCountsByAuthor | null = null;

    for (const badge of autoBadges) {
      const eligible = await this.computeEligibleUserIds(badge, {
        getContentCounts: async () => {
          if (!contentCountsResult) {
            contentCountsResult = await this.opts.statsPort.getContentCountsByAuthor();
          }
          return contentCountsResult;
        },
        getLevelIds: (threshold) => {
          let p = levelIdsCache.get(threshold);
          if (!p) {
            p = this.opts.statsPort.getUserIdsWithLevelAtLeast(threshold);
            levelIdsCache.set(threshold, p);
          }
          return p;
        },
        getNightCounts: (startHour, endHour, offset) => {
          const key = `${startHour}-${endHour}-${offset}`;
          let p = nightCountsCache.get(key);
          if (!p) {
            p = this.opts.statsPort.getNightContentCountsByAuthor(startHour, endHour, offset);
            nightCountsCache.set(key, p);
          }
          return p;
        },
      });

      grantedCount += await this.grantEligibleUsers(badge, eligible);
    }

    return { evaluatedBadges: autoBadges.length, grantedCount };
  }

  /**
   * 针对单个用户评估全部 AUTO 徽章。用于等级变更等事件的即时反馈。
   * 返回本次新增授予数量。
   */
  public async evaluateUser(userId: string): Promise<number> {
    const autoBadges = await this.opts.badgeRepository.findAllActiveAuto();
    if (autoBadges.length === 0) return 0;

    let grantedCount = 0;
    for (const badge of autoBadges) {
      const eligible = await this.computeEligibleUserIdsForUser(badge, userId);
      if (eligible) {
        grantedCount += await this.grantEligibleUsers(badge, [userId]);
      }
    }
    return grantedCount;
  }

  private async computeEligibleUserIds(badge: Badge, ctx: EvaluationContext): Promise<string[]> {
    const condition = badge.condition;
    switch (condition.kind) {
      case 'user_level': {
        return ctx.getLevelIds(condition.threshold!);
      }
      case 'post_count':
      case 'comment_count':
      case 'content_count': {
        const counts = await ctx.getContentCounts();
        return filterByThreshold(counts.posts, counts.comments, condition.kind, condition.threshold!);
      }
      case 'night_activity': {
        const map = await ctx.getNightCounts(
          condition.startHour!,
          condition.endHour!,
          condition.utcOffsetHours,
        );
        return [...map.entries()].filter(([, count]) => count >= condition.threshold!).map(([id]) => id);
      }
      case 'upheld_reports': {
        const map = await this.opts.statsPort.getUpheldReportCountsByReporter();
        return [...map.entries()].filter(([, count]) => count >= condition.threshold!).map(([id]) => id);
      }
      default:
        return [];
    }
  }

  private async computeEligibleUserIdsForUser(badge: Badge, userId: string): Promise<boolean> {
    const condition = badge.condition;
    switch (condition.kind) {
      case 'user_level': {
        const ids = await this.opts.statsPort.getUserIdsWithLevelAtLeast(condition.threshold!);
        return ids.includes(userId);
      }
      case 'post_count':
      case 'comment_count':
      case 'content_count': {
        const counts = await this.opts.statsPort.getContentCountsByAuthor();
        const filtered = filterByThreshold(counts.posts, counts.comments, condition.kind, condition.threshold!);
        return filtered.includes(userId);
      }
      case 'night_activity': {
        const map = await this.opts.statsPort.getNightContentCountsByAuthor(
          condition.startHour!,
          condition.endHour!,
          condition.utcOffsetHours,
        );
        return (map.get(userId) ?? 0) >= condition.threshold!;
      }
      case 'upheld_reports': {
        const map = await this.opts.statsPort.getUpheldReportCountsByReporter();
        return (map.get(userId) ?? 0) >= condition.threshold!;
      }
      default:
        return false;
    }
  }

  private async grantEligibleUsers(badge: Badge, userIds: string[]): Promise<number> {
    if (userIds.length === 0) return 0;
    return this.opts.unitOfWork.execute(async () => {
      const existingKeys = await this.opts.userBadgeRepository.findExistingKeys([badge.id]);
      const fresh = userIds.filter((userId) => !existingKeys.has(`${badge.id}:${userId}`));

      for (const userId of fresh) {
        await this.opts.userBadgeRepository.save(
          UserBadge.grant({ id: randomUUID(), userId, badgeId: badge.id }),
        );
        await this.sendGrantNotification(userId, badge);
      }
      return fresh.length;
    });
  }

  private async sendGrantNotification(userId: string, badge: Badge): Promise<void> {
    const notification = Notification.create({
      id: randomUUID(),
      userId,
      type: 'SYSTEM',
      title: `🏅 ${badge.name}`,
      content: badge.description || 'You have earned a new badge.',
      relatedId: null,
      read: false,
      createdAt: new Date(),
    });
    await this.opts.notificationRepository.save(notification);
  }

  private async getBadgeOrThrow(badgeId: string) {
    const badge = await this.opts.badgeRepository.findById(badgeId);
    if (!badge) {
      throw new Error('ERR_BADGE_NOT_FOUND');
    }
    return badge;
  }
}

interface EvaluationContext {
  getContentCounts: () => Promise<ContentCountsByAuthor>;
  getLevelIds: (threshold: number) => Promise<string[]>;
  getNightCounts: (
    startHour: number,
    endHour: number,
    utcOffsetHours: number,
  ) => Promise<Map<string, number>>;
}

function filterByThreshold(
  posts: Map<string, number>,
  comments: Map<string, number>,
  kind: 'post_count' | 'comment_count' | 'content_count',
  threshold: number,
): string[] {
  const result: string[] = [];
  const authorIds = new Set([...posts.keys(), ...comments.keys()]);
  for (const authorId of authorIds) {
    let value: number;
    if (kind === 'post_count') value = posts.get(authorId) ?? 0;
    else if (kind === 'comment_count') value = comments.get(authorId) ?? 0;
    else value = (posts.get(authorId) ?? 0) + (comments.get(authorId) ?? 0);
    if (value >= threshold) result.push(authorId);
  }
  return result;
}
