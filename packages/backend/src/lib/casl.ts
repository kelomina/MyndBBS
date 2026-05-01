/**
 * 模块：CASL Ability
 *
 * 函数作用：
 *   CASL 权限引擎的类型定义和能力构建函数。
 *   根据用户上下文（角色、等级、管辖分类）和数据库驱动规则生成细粒度权限能力对象。
 * Purpose:
 *   CASL authorization engine type definitions and ability builder.
 *   Generates fine-grained permission ability objects based on user context
 *   (role, level, moderated categories) and database-driven rules.
 *
 * 中文关键词：
 *   权限，CASL，能力，RBAC，类型
 * English keywords:
 *   permission, CASL, ability, RBAC, types
 */
import { AbilityBuilder, PureAbility, createMongoAbility, MongoQuery } from '@casl/ability';
import { UserStatus, PostStatus } from '@myndbbs/shared';
import { AccessContextDTO, RuleDescriptorDTO } from '../application/identity/contracts/AbilityContracts';

export type Action = 'manage' | 'create' | 'read' | 'update' | 'delete' | 'update_status';

export type AppSubjects =
  | 'all'
  | 'AdminPanel'
  | 'User'
  | 'Post'
  | 'Category'
  | 'Role'
  | 'Permission'
  | 'Comment'
  | 'ModeratedWord';

export type AppAbility = PureAbility<[Action, AppSubjects]>;

/**
 * 函数名称：defineAbilityForContext
 *
 * 函数作用：
 *   基于用户上下文和动态规则构建 CASL 能力对象。
 *   支持：游客基线权限、已认证用户基线权限、角色硬编码规则、分类版主规则、数据库驱动规则。
 * Purpose:
 *   Builds a CASL ability object based on user context and dynamic rules.
 *   Supports: guest baseline, authenticated user baseline, hardcoded role rules,
 *   category moderator rules, and database-driven rules.
 *
 * 调用方 / Called by:
 *   - requireAuth（middleware/auth.ts）
 *   - optionalAuth（middleware/auth.ts）
 *
 * 被调用方 / Calls:
 *   - AbilityBuilder.can / AbilityBuilder.cannot / AbilityBuilder.build
 *
 * 参数说明 / Parameters:
 *   - context: AccessContextDTO | undefined, 用户上下文（等级、角色 ID、管辖分类 ID 列表）
 *   - extraRules: RuleDescriptorDTO[] | undefined, 数据库驱动的额外权限规则
 *
 * 返回值说明 / Returns:
 *   AppAbility CASL 能力对象
 *
 * 错误处理 / Error handling:
 *   无——规则解析异常时静默跳过（console.error）
 *
 * 副作用 / Side effects:
 *   无——纯函数
 *
 * 中文关键词：
 *   CASL，权限，能力构建，游客，角色，规则
 * English keywords:
 *   CASL, permission, ability builder, guest, role, rules
 */
export function defineAbilityForContext(context?: AccessContextDTO, extraRules?: RuleDescriptorDTO[]) {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  const userLevel = context ? context.level : 0;

  if (!context) {
    // Guest can read published posts and categories that allow guests (minLevel 0)
    can('read', 'Post', { status: PostStatus.PUBLISHED, 'category.minLevel': 0 } as any);
    can('read', 'Post', { status: PostStatus.PINNED, 'category.minLevel': 0 } as any);
    can('read', 'Category', { minLevel: 0 } as any);
    can('read', 'Comment', { deletedAt: null, isPending: false, 'post.category.minLevel': 0 } as any);
    return build();
  }

  // Baseline permissions for all authenticated users
  can('read', 'Category', { minLevel: { $lte: userLevel } } as any);
  can('read', 'Post', { status: PostStatus.PUBLISHED, 'category.minLevel': { $lte: userLevel } } as any);
  can('read', 'Post', { status: PostStatus.PINNED, 'category.minLevel': { $lte: userLevel } } as any);
  // Author can read their own DELETED/HIDDEN posts
  can('read', 'Post', { authorId: context.userId } as any);
  
  can('read', 'Comment', { deletedAt: null, isPending: false, 'post.category.minLevel': { $lte: userLevel } } as any);
  // Author can read their own DELETED comments
  can('read', 'Comment', { authorId: context.userId } as any);
  
  // Create and update posts only in categories they have access to
  can('create', 'Post', { 'category.minLevel': { $lte: userLevel } } as any);
  can('update', 'Post', { authorId: context.userId } as any);
  can('delete', 'Post', { authorId: context.userId } as any);

  can('create', 'Comment', { 'post.category.minLevel': { $lte: userLevel } } as any);
  can('update', 'Comment', { authorId: context.userId } as any);
  can('delete', 'Comment', { authorId: context.userId } as any);

  // Baseline hardcoded role logic (Fallback/Defaults)
  if (context.roleName === 'SUPER_ADMIN') {
    can('manage', 'all');
  } else if (context.roleName === 'ADMIN') {
    can('manage', 'all');
  } else if (context.roleName === 'MODERATOR') {
    can('read', 'all');
    can('read', 'AdminPanel');
  }

  // Category Moderator logic
  if (context.moderatedCategoryIds && context.moderatedCategoryIds.length > 0) {
    can('manage', 'Post', { categoryId: { $in: context.moderatedCategoryIds } } as any);
    can('manage', 'Comment', { 'post.categoryId': { $in: context.moderatedCategoryIds } } as any);
    can('manage', 'ModeratedWord', { categoryId: { $in: context.moderatedCategoryIds } } as any);
  }

  // Dynamic DB-driven rules
  if (extraRules && extraRules.length > 0) {
    for (const rule of extraRules) {
      const parts = rule.action.split(':');
      const actionName = parts.length > 1 ? parts[0] : rule.action;
      const subjectName = parts.length > 1 ? parts[1] : (rule as any).subject; // Accommodate old structure where subject might still exist

      // Make sure subjectName is passed as string
      const finalSubjectName = subjectName ? subjectName.toString() : 'all';

      let parsedConditions = (rule as any).conditions;
      if (typeof (rule as any).conditions === 'string') {
        try {
          parsedConditions = JSON.parse((rule as any).conditions);
        } catch {
          console.error('Failed to parse CASL conditions JSON:', (rule as any).conditions);
          continue;
        }
      }

      if (parsedConditions) {
        can(actionName as Action, finalSubjectName as any, parsedConditions);
      } else {
        can(actionName as Action, finalSubjectName as any);
      }
    }
  }

  return build();
}
