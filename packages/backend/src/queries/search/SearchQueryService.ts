import { prisma } from '../../db';
import { rulesToPrisma } from '../../lib/rulesToPrisma';
import type { AppAbility } from '../../lib/casl';
import { GlobalSearchResultDTO } from './dto';
import { PostStatus, UserStatus } from '@myndbbs/shared';
import {
    isMeilisearchAvailable,
    searchPosts,
    searchUsers,
} from '../../infrastructure/search/SearchIndexer';

const SEARCH_READABLE_POST_STATUSES = [PostStatus.PUBLISHED, PostStatus.PINNED] as const;

export interface SearchParams {
  q: string
  type?: 'all' | 'posts' | 'users'
  page?: number
  limit?: number
  categoryId?: string
}

export class SearchQueryService {
  public async search(ability: AppAbility, params: SearchParams | string): Promise<GlobalSearchResultDTO> {
    const sp: SearchParams = typeof params === 'string' ? { q: params } : params
    const { q, type = 'all', page = 1, limit = 20, categoryId } = sp
    const offset = (page - 1) * limit

    if (isMeilisearchAvailable()) {
      return this.searchWithMeilisearch(ability, q, type, limit, offset, categoryId);
    }
    return this.searchWithPrisma(ability, q, type, limit, offset, categoryId);
  }

  private async searchWithMeilisearch(
    ability: AppAbility,
    q: string,
    type: 'all' | 'posts' | 'users',
    limit: number,
    offset: number,
    categoryId?: string,
  ): Promise<GlobalSearchResultDTO> {
    const searchPosts$ = type !== 'users'
      ? searchPosts(q, limit, offset, this.buildPostFilter(categoryId), ['title', 'content'])
      : Promise.resolve([]);
    const searchUsers$ = type !== 'posts'
      ? searchUsers(q, limit, offset, 'status = ACTIVE', ['username'])
      : Promise.resolve([]);

    const [postHits, userHits] = await Promise.all([searchPosts$, searchUsers$]);

    const postIds = (postHits as Array<{ id: string }>).map((h) => h.id);
    const userIds = (userHits as Array<{ id: string }>).map((h) => h.id);

    const [posts, users] = await Promise.all([
      postIds.length > 0
        ? prisma.post.findMany({
            where: {
              AND: [
                rulesToPrisma(ability, 'read', 'Post'),
                { id: { in: postIds } },
                { status: { in: [...SEARCH_READABLE_POST_STATUSES] } },
                ...(categoryId ? [{ categoryId }] : []),
              ],
            },
            include: {
              author: { select: { id: true, username: true, avatarUrl: true } },
              category: { select: { id: true, name: true, description: true } },
              _count: { select: { comments: true, upvotes: true } },
            },
          })
        : [],
      userIds.length > 0
        ? prisma.user.findMany({
            where: {
              id: { in: userIds },
              status: UserStatus.ACTIVE,
            },
            select: {
              id: true,
              username: true,
              level: true,
            },
          })
        : [],
    ]);

    const postOrder = new Map(postIds.map((id, i) => [id, i]));
    const postHighlights = new Map(
      (postHits as Array<{ id: string; _formatted?: { title?: string; content?: string } }>)
        .map((hit) => [hit.id, hit._formatted]),
    );
    const sortedPosts = [...posts].sort(
      (a, b) => (postOrder.get(a.id) ?? Infinity) - (postOrder.get(b.id) ?? Infinity),
    );

    const userOrder = new Map(userIds.map((id, i) => [id, i]));
    const sortedUsers = [...users].sort(
      (a, b) => (userOrder.get(a.id) ?? Infinity) - (userOrder.get(b.id) ?? Infinity),
    );

    return {
      posts: sortedPosts.map((p) => {
        const highlight = postHighlights.get(p.id);
        return {
          id: p.id,
          title: p.title,
          content: p.content,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
          status: p.status as unknown as PostStatus,
          author: p.author,
          category: p.category,
          _count: p._count,
          ...(highlight ? { highlight } : {}),
        };
      }),
      users: sortedUsers.map((u) => ({
        id: u.id,
        username: u.username,
        level: u.level,
      })),
    };
  }

  private buildPostFilter(categoryId?: string): string {
    const filters = ['(status = PUBLISHED OR status = PINNED)'];
    if (categoryId) {
      filters.push(`categoryId = "${categoryId.replace(/"/g, '\\"')}"`);
    }
    return filters.join(' AND ');
  }

  private async searchWithPrisma(
    ability: AppAbility,
    q: string,
    type: 'all' | 'posts' | 'users',
    limit: number,
    offset: number,
    categoryId?: string,
  ): Promise<GlobalSearchResultDTO> {
    const posts = type !== 'users' ? await prisma.post.findMany({
      where: {
        AND: [
          rulesToPrisma(ability, 'read', 'Post'),
          { status: { in: [...SEARCH_READABLE_POST_STATUSES] } },
          {
            OR: [
              { title: { contains: q, mode: 'insensitive' as const } },
              { content: { contains: q, mode: 'insensitive' as const } },
            ],
          },
          ...(categoryId ? [{ categoryId }] : []),
        ],
      },
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: { id: true, username: true, avatarUrl: true } },
        category: { select: { id: true, name: true, description: true } },
        _count: { select: { comments: true, upvotes: true } },
      },
    }) : [];

    const users = type !== 'posts' ? await prisma.user.findMany({
      where: {
        username: { contains: q, mode: 'insensitive' as const },
        status: UserStatus.ACTIVE,
      },
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        username: true,
        level: true,
      },
    }) : [];

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
        level: u.level,
      })),
    };
  }
}
