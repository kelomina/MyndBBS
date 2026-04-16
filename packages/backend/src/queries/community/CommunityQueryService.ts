import { prisma } from '../../db';
import { accessibleBy } from '@casl/prisma';
import type { AppAbility } from '../../lib/casl';
import {
  CategoryListItemDTO,
  CommentListItemDTO,
  ListPostCommentsParams,
  ListPostsParams,
  PostDetailDTO,
  PostInteractionDTO,
  PostListItemDTO,
} from './dto';

/**
 * Callers: [categoryRouter, postRouter]
 * Callees: [prisma.category, prisma.post, prisma.comment, prisma.upvote, prisma.bookmark]
 * Description: Handles queries for community domain components (categories, posts, comments), abstracting Prisma read operations and providing DTOs.
 * Keywords: query, service, community, categories, posts, comments
 */
export class CommunityQueryService {
  /**
   * Callers: [categoryRouter.get('/')]
   * Callees: [prisma.category.findMany]
   * Description: Fetches a list of all categories ordered by sortOrder.
   * Keywords: category, list, findMany
   */
  public async listCategories(): Promise<CategoryListItemDTO[]> {
    return prisma.category.findMany({ take: 1000, orderBy: { sortOrder: 'asc' } });
  }

  /**
   * Callers: [postRouter.get('/')]
   * Callees: [accessibleBy, prisma.post.findMany]
   * Description: Fetches a list of accessible posts optionally filtered by category and sorted.
   * Keywords: post, list, findMany, filter, sort
   */
  public async listPosts(params: ListPostsParams): Promise<PostListItemDTO[]> {
    const { ability, category, sortBy, take = 1000 } = params;

    const whereClause: any = { AND: [accessibleBy(ability).Post] };
    if (category) {
      whereClause.AND.push({ category: { name: String(category) } });
    }

    let orderByClause: any = { createdAt: 'desc' };
    if (sortBy === 'popular') orderByClause = { id: 'asc' }; // In real app, order by score/upvotes

    const rows = await prisma.post.findMany({
      take,
      where: whereClause,
      orderBy: orderByClause,
      include: {
        author: { select: { id: true, username: true } },
        category: { select: { id: true, name: true, description: true } },
        _count: { select: { comments: true, upvotes: true } },
      },
    });
    return rows.map((p) => ({
      id: p.id,
      title: p.title,
      createdAt: p.createdAt,
      status: p.status,
      author: p.author,
      category: p.category,
      _count: p._count,
    }));
  }

  /**
   * Callers: [postRouter.get('/:id'), CommunityApplicationService]
   * Callees: [accessibleBy, prisma.post.findFirst]
   * Description: Fetches a detailed view of a specific accessible post by ID.
   * Keywords: post, detail, findFirst, id
   */
  public async getPostById(ability: AppAbility, postId: string): Promise<PostDetailDTO | null> {
    const post = await prisma.post.findFirst({
      where: { AND: [{ id: postId }, accessibleBy(ability).Post] },
      include: {
        author: { select: { id: true, username: true } },
        category: { select: { id: true, name: true, description: true } },
        _count: { select: { comments: true, upvotes: true, bookmarks: true } },
      },
    });

    if (!post) return null;

    return {
      id: post.id,
      title: post.title,
      content: post.content,
      createdAt: post.createdAt,
      status: post.status,
      author: post.author,
      category: post.category,
      _count: post._count,
    };
  }

  /**
   * Callers: [postRouter.get('/:id/interactions')]
   * Callees: [accessibleBy, prisma.post.findFirst, prisma.upvote.findUnique, prisma.bookmark.findUnique]
   * Description: Fetches the current user's interaction status (upvoted, bookmarked) for a specific post.
   * Keywords: post, interactions, upvote, bookmark, status
   */
  public async getPostInteractions(ability: AppAbility, postId: string, userId: string): Promise<PostInteractionDTO | null> {
    const post = await prisma.post.findFirst({ where: { AND: [{ id: postId }, accessibleBy(ability).Post] } });
    if (!post) return null;

    const [upvote, bookmark] = await Promise.all([
      prisma.upvote.findUnique({ where: { userId_postId: { userId, postId } } }),
      prisma.bookmark.findUnique({ where: { userId_postId: { userId, postId } } }),
    ]);

    return { upvoted: !!upvote, bookmarked: !!bookmark };
  }

  /**
   * Callers: [postRouter.get('/:id/comments')]
   * Callees: [accessibleBy, prisma.post.findFirst, prisma.comment.findMany, prisma.commentUpvote.findMany, prisma.commentBookmark.findMany]
   * Description: Fetches accessible comments for a specific post and injects the current user's interaction statuses.
   * Keywords: post, comments, interactions, list, findMany
   */
  public async listPostComments(params: ListPostCommentsParams): Promise<CommentListItemDTO[] | null> {
    const { ability, postId, currentUserId, take = 1000 } = params;

    const post = await prisma.post.findFirst({ where: { AND: [{ id: postId }, accessibleBy(ability).Post] } });
    if (!post) return null;

    const comments = await prisma.comment.findMany({
      take,
      where: { AND: [{ postId }, accessibleBy(ability).Comment] },
      orderBy: { createdAt: 'asc' },
      include: {
        author: { select: { id: true, username: true } },
        _count: { select: { upvotes: true, bookmarks: true, replies: true } },
      },
    });

    if (!currentUserId) return comments.map(c => ({
      id: c.id,
      content: c.content,
      createdAt: c.createdAt,
      deletedAt: c.deletedAt,
      isPending: c.isPending,
      author: c.author,
      _count: c._count,
    }));

    const [userUpvotes, userBookmarks] = await Promise.all([
      prisma.commentUpvote.findMany({ where: { userId: currentUserId, comment: { postId } }, select: { commentId: true } }),
      prisma.commentBookmark.findMany({ where: { userId: currentUserId, comment: { postId } }, select: { commentId: true } }),
    ]);

    const upvotedSet = new Set(userUpvotes.map((u) => u.commentId));
    const bookmarkedSet = new Set(userBookmarks.map((b) => b.commentId));

    return comments.map((comment: any) => ({
      id: comment.id,
      content: comment.content,
      createdAt: comment.createdAt,
      deletedAt: comment.deletedAt,
      isPending: comment.isPending,
      author: comment.author,
      _count: comment._count,
      hasUpvoted: upvotedSet.has(comment.id),
      hasBookmarked: bookmarkedSet.has(comment.id),
    }));
  }

  public async getCommentWithPost(commentId: string) {
    return prisma.comment.findUnique({
      where: { id: commentId },
      include: { post: true }
    });
  }

  public async getPostWithCategory(postId: string) {
    return prisma.post.findUnique({
      where: { id: postId },
      include: { category: true }
    });
  }

  public async getUserLevel(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { level: true } });
    return user?.level || 0;
  }

  public async getCommentById(commentId: string) {
    return prisma.comment.findUnique({ where: { id: commentId } });
  }

  public async getPostBasicInfo(postId: string) {
    return prisma.post.findUnique({ where: { id: postId }, select: { authorId: true, title: true } });
  }

  public async getCommentBasicInfo(commentId: string) {
    return prisma.comment.findUnique({ where: { id: commentId }, select: { authorId: true } });
  }
}

export const communityQueryService = new CommunityQueryService();