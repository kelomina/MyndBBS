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
  moderatedCategories?: { categoryId: string }[];
};

export function defineAbilityFor(user?: AbilityUser) {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(createPrismaAbility);

  if (!user) {
    // Guest can read published posts and categories
    can('read', 'Post', { status: 'PUBLISHED' });
    can('read', 'Category');
    return build();
  }

  // Baseline permissions for all authenticated users
  can('read', 'Post');
  can('create', 'Post');
  can('update', 'Post', { authorId: user.id });
  can('delete', 'Post', { authorId: user.id });
  can('read', 'Category');

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
