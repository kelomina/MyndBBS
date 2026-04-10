import { AbilityBuilder, PureAbility } from '@casl/ability';
import { createPrismaAbility, PrismaQuery, Subjects } from '@casl/prisma';
import { User, Post, Category, Role, Permission, Comment, UserStatus, PostStatus } from '@prisma/client';

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

type AbilityUser = {
  id: string;
  role: string; // "USER" | "MODERATOR" | "ADMIN" | "SUPER_ADMIN"
  level: number;
  moderatedCategories?: { categoryId: string }[];
};

export function defineAbilityFor(user?: AbilityUser) {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(createPrismaAbility);

  const userLevel = user ? user.level : 0;

  if (!user) {
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
  can('read', 'Post', { authorId: user.id });
  
  can('read', 'Comment', { deletedAt: null, isPending: false, post: { is: { category: { is: { minLevel: { lte: userLevel } } } } } } as any);
  // Author can read their own DELETED comments
  can('read', 'Comment', { authorId: user.id });
  
  // Create and update posts only in categories they have access to
  can('create', 'Post', { category: { is: { minLevel: { lte: userLevel } } } } as any);
  can('update', 'Post', { authorId: user.id });
  can('delete', 'Post', { authorId: user.id });

  can('create', 'Comment', { post: { is: { category: { is: { minLevel: { lte: userLevel } } } } } } as any);
  can('update', 'Comment', { authorId: user.id });
  can('delete', 'Comment', { authorId: user.id });

  // Define based on role
  if (user.role === 'SUPER_ADMIN') {
    can('manage', 'all');
  } else if (user.role === 'ADMIN') {
    can('manage', 'all');
  } else if (user.role === 'MODERATOR') {
    can('read', 'all');
    can('read', 'AdminPanel');
  } else {
    // Regular User
  }

  // Category Moderator logic
  if (user.moderatedCategories && user.moderatedCategories.length > 0) {
    const categoryIds = user.moderatedCategories.map((mc) => mc.categoryId);
    can('manage', 'Post', { categoryId: { in: categoryIds } });
    can('manage', 'Comment', { post: { is: { categoryId: { in: categoryIds } } } } as any);
  }

  return build();
}
