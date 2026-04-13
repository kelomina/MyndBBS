import { AbilityBuilder, PureAbility } from '@casl/ability';
import { createPrismaAbility, PrismaQuery, Subjects } from '@casl/prisma';
import { User, Post, Category, Role, Permission, Comment, UserStatus, PostStatus } from '@prisma/client';
import { AccessContextDTO, RuleDescriptorDTO } from '../queries/identity/dto';

export type Action = 'manage' | 'create' | 'read' | 'update' | 'delete' | 'update_status';

export type AppSubjects =
  | 'all'
  | 'AdminPanel'
  | Subjects<{
      User: User;
      Post: Post;
      Category: Category;
      Role: Role;
      Permission: Permission;
      Comment: Comment;
    }>;

export type AppAbility = PureAbility<[Action, AppSubjects], PrismaQuery>;

/**
 * Callers: [requireAuth, optionalAuth]
 * Callees: [can, build]
 * Description: Builds the CASL ability for a user based on their context and dynamic DB-driven rules.
 * Keywords: defineabilityforcontext, define, ability, casl, rules, context
 */
export function defineAbilityForContext(context?: AccessContextDTO, extraRules?: RuleDescriptorDTO[]) {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(createPrismaAbility);

  const userLevel = context ? context.level : 0;

  if (!context) {
    // Guest can read published posts and categories that allow guests (minLevel 0)
    can('read', 'Post', { status: PostStatus.PUBLISHED, category: { is: { minLevel: 0 } } } as any);
    can('read', 'Post', { status: PostStatus.PINNED, category: { is: { minLevel: 0 } } } as any);
    can('read', 'Category', { minLevel: 0 });
    can('read', 'Comment', { deletedAt: null, isPending: false, post: { is: { category: { is: { minLevel: 0 } } } } } as any);
    return build();
  }

  // Baseline permissions for all authenticated users
  can('read', 'Category', { minLevel: { lte: userLevel } });
  can('read', 'Post', { status: PostStatus.PUBLISHED, category: { is: { minLevel: { lte: userLevel } } } } as any);
  can('read', 'Post', { status: PostStatus.PINNED, category: { is: { minLevel: { lte: userLevel } } } } as any);
  // Author can read their own DELETED/HIDDEN posts
  can('read', 'Post', { authorId: context.userId });
  
  can('read', 'Comment', { deletedAt: null, isPending: false, post: { is: { category: { is: { minLevel: { lte: userLevel } } } } } } as any);
  // Author can read their own DELETED comments
  can('read', 'Comment', { authorId: context.userId });
  
  // Create and update posts only in categories they have access to
  can('create', 'Post', { category: { is: { minLevel: { lte: userLevel } } } } as any);
  can('update', 'Post', { authorId: context.userId });
  can('delete', 'Post', { authorId: context.userId });

  can('create', 'Comment', { post: { is: { category: { is: { minLevel: { lte: userLevel } } } } } } as any);
  can('update', 'Comment', { authorId: context.userId });
  can('delete', 'Comment', { authorId: context.userId });

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
    can('manage', 'Post', { categoryId: { in: context.moderatedCategoryIds } });
    can('manage', 'Comment', { post: { is: { categoryId: { in: context.moderatedCategoryIds } } } } as any);
  }

  // Dynamic DB-driven rules
  if (extraRules && extraRules.length > 0) {
    for (const rule of extraRules) {
      const parts = rule.action.split(':');
      const actionName = parts.length > 1 ? parts[0] : rule.action;
      const subjectName = parts.length > 1 ? parts[1] : (rule as any).subject; // Accommodate old structure where subject might still exist

      // Make sure subjectName is passed as string
      const finalSubjectName = subjectName ? subjectName.toString() : 'all';

      const parsedConditions = typeof (rule as any).conditions === 'string' 
        ? JSON.parse((rule as any).conditions) 
        : (rule as any).conditions;

      if (parsedConditions) {
        can(actionName as Action, finalSubjectName as any, parsedConditions);
      } else {
        can(actionName as Action, finalSubjectName as any);
      }
    }
  }

  return build();
}
