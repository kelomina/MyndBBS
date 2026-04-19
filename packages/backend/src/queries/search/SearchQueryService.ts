import { prisma } from '../../db';
import { rulesToPrisma } from '../../lib/rulesToPrisma';
import type { AppAbility } from '../../lib/casl';
import { GlobalSearchResultDTO } from './dto';
import { PostStatus, UserStatus } from '@myndbbs/shared';

/**
 * Callers: [searchController]
 * Callees: [prisma.post.findMany, prisma.user.findMany, rulesToPrisma]
 * Description: Handles global search queries for posts and users.
 * Keywords: search, global, posts, users, query, service
 */
export class SearchQueryService {
  /**
   * Callers: [searchController.search]
   * Callees: [prisma.post.findMany, prisma.user.findMany, rulesToPrisma]
   * Description: Performs a global search across posts (title/content) and users (username).
   * Keywords: search, query, findMany, posts, users
   */
  public async search(ability: AppAbility, q: string): Promise<GlobalSearchResultDTO> {
    const postWhere = {
      AND: [
        rulesToPrisma(ability, 'read', 'Post'),
        {
          OR: [
            { title: { contains: q, mode: 'insensitive' as const } },
            { content: { contains: q, mode: 'insensitive' as const } },
          ],
        },
      ],
    };

    const posts = await prisma.post.findMany({
      where: postWhere,
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: { id: true, username: true } },
        category: { select: { id: true, name: true, description: true } },
        _count: { select: { comments: true, upvotes: true } },
      },
    });

    const userWhere = {
      username: { contains: q, mode: 'insensitive' as const },
    };

    const users = await prisma.user.findMany({
      where: userWhere,
      take: 20,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        username: true,
        status: true,
        level: true,
        createdAt: true,
      },
    });

    return {
      posts: posts.map((p) => ({
        id: p.id,
        title: p.title,
        content: p.content,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        status: p.status as unknown as PostStatus,
        author: p.author,
        category: p.category,
        _count: p._count,
      })),
      users: users.map((u) => ({
        id: u.id,
        username: u.username,
        status: u.status as unknown as UserStatus,
        level: u.level,
        createdAt: u.createdAt,
      })),
    };
  }
}
