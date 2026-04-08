import { AbilityBuilder, PureAbility } from '@casl/ability';
import { createPrismaAbility, PrismaQuery, Subjects } from '@casl/prisma';
import { User, Post, Category, Role, Permission } from '@prisma/client';

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
    can('read', 'Post', { status: 'PUBLISHED', category: { is: { minLevel: 0 } } } as any);
    can('read', 'Category', { minLevel: 0 });
    return build();
  }

  // Baseline permissions for all authenticated users
  can('read', 'Category', { minLevel: { lte: userLevel } });
  can('read', 'Post', { category: { is: { minLevel: { lte: userLevel } } } } as any);
  
  // Create and update posts only in categories they have access to
  can('create', 'Post', { category: { is: { minLevel: { lte: userLevel } } } } as any);
  can('update', 'Post', { authorId: user.id });
  can('delete', 'Post', { authorId: user.id });

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
  }

  return build();
}
