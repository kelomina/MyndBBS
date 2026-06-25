import { prisma } from '../../db';
import { rulesToPrisma } from '../../lib/rulesToPrisma';
import type { AppAbility } from '../../lib/casl';
import {
  CategoryListItemDTO,
  CommentListItemDTO,
  ListPostCommentsParams,
  ListPostsParams,
  PaginatedCommentsDTO,
  PostDetailDTO,
  PostInteractionDTO,
  PostListItemDTO,
} from './dto';

type LocalPostWhereInput = {
  AND?: any[];
};

type LocalPostOrderByInput = {
  id?: 'asc' | 'desc';
  createdAt?: 'asc' | 'desc';
};

const NORMAL_READABLE_POST_STATUSES = ['PUBLISHED', 'PINNED'];
const DEFAULT_READ_PAGE_SIZE = 20;
const MAX_READ_PAGE_SIZE = 100;

function clampReadTake(take: number | undefined): number {
  if (!Number.isFinite(take)) {
    return DEFAULT_READ_PAGE_SIZE;
  }
  return Math.min(Math.max(Math.floor(take!), 1), MAX_READ_PAGE_SIZE);
}

function clampReadSkip(skip: number | undefined): number {
  if (!Number.isFinite(skip)) {
    return 0;
  }
  return Math.max(Math.floor(skip!), 0);
}

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
   * Description: Fetches a list of posts filtered by category and sorted by creation date or popularity.
   * Keywords: list, posts, filter, category, popular, findMany
   */
  public async listPosts(params: ListPostsParams): Promise<PostListItemDTO[]> {
    const { ability, category, sortBy, take } = params;
    const boundedTake = clampReadTake(take);

    const whereClause: LocalPostWhereInput = {
      AND: [
        { status: { in: NORMAL_READABLE_POST_STATUSES } },
        rulesToPrisma(ability, 'read', 'Post'),
      ],
    };
    if (category) {
      whereClause.AND!.push({ category: { name: String(category) } });
    }

    let rows = await prisma.post.findMany({
      take: boundedTake,
      where: whereClause,
      orderBy: { createdAt: 'desc' }, // default to fetching latest first before sorting if popular
      include: {
        author: { select: { username: true, avatarUrl: true } },
        category: { select: { id: true, name: true, description: true } },
        _count: { select: { comments: true, upvotes: true } },
      },
    });

    if (sortBy === 'popular') {
      const now = new Date().getTime();
      rows.sort((a, b) => {
        // Reddit-like hot ranking algorithm:
        // Score = (Upvotes * 2 + Comments * 3) / (AgeInHours + 2)^1.8
        const aAgeHours = (now - new Date(a.createdAt).getTime()) / (1000 * 60 * 60);
        const bAgeHours = (now - new Date(b.createdAt).getTime()) / (1000 * 60 * 60);

        const aScore = (a._count.upvotes * 2 + a._count.comments * 3) / Math.pow(aAgeHours + 2, 1.8);
        const bScore = (b._count.upvotes * 2 + b._count.comments * 3) / Math.pow(bAgeHours + 2, 1.8);

        return bScore - aScore; // Descending
      });
    }

    return rows.map((p) => ({
      id: p.id,
      title: p.title,
      content: p.content,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      status: p.status as unknown as import('@myndbbs/shared').PostStatus,
      author: { username: p.author.username, avatarUrl: p.author.avatarUrl },
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
      where: {
        AND: [
          { id: postId },
          { status: { in: NORMAL_READABLE_POST_STATUSES } },
          rulesToPrisma(ability, 'read', 'Post'),
        ],
      },
      include: {
        author: { select: { username: true, avatarUrl: true } },
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
      updatedAt: post.updatedAt,
      status: post.status as unknown as import('@myndbbs/shared').PostStatus,
      author: { username: post.author.username, avatarUrl: post.author.avatarUrl },
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
    const post = await prisma.post.findFirst({
      where: {
        AND: [
          { id: postId },
          { status: { in: NORMAL_READABLE_POST_STATUSES } },
          rulesToPrisma(ability, 'read', 'Post'),
        ],
      },
    });
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
  public async listPostComments(params: ListPostCommentsParams): Promise<PaginatedCommentsDTO | null> {
    const { ability, postId, currentUserId, parentId, skip, take } = params;
    const boundedSkip = clampReadSkip(skip);
    const boundedTake = clampReadTake(take);

    const post = await prisma.post.findFirst({
      where: {
        AND: [
          { id: postId },
          { status: { in: NORMAL_READABLE_POST_STATUSES } },
          rulesToPrisma(ability, 'read', 'Post'),
        ],
      },
    });
    if (!post) return null;

    const whereConditions: any[] = [{ postId }, rulesToPrisma(ability, 'read', 'Comment')];
    if (parentId !== undefined) {
      whereConditions.push({ parentId });
    }
    const where = { AND: whereConditions };

    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        skip: boundedSkip,
        take: boundedTake,
        where,
        orderBy: { createdAt: 'asc' },
        include: {
          author: { select: { username: true, avatarUrl: true } },
          _count: { select: { upvotes: true, bookmarks: true, replies: true } },
        },
      }),
      prisma.comment.count({ where }),
    ]);

    const mapComment = (c: any): CommentListItemDTO => ({
      id: c.id,
      content: c.deletedAt === null ? c.content : '',
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      deletedAt: c.deletedAt,
      isPending: c.isPending,
      parentId: c.parentId,
      author: { username: c.author.username, avatarUrl: c.author.avatarUrl },
      _count: c._count,
      ...(c.hasUpvoted !== undefined ? { hasUpvoted: c.hasUpvoted } : {}),
      ...(c.hasBookmarked !== undefined ? { hasBookmarked: c.hasBookmarked } : {}),
    });

    if (!currentUserId) {
      return { data: comments.map(mapComment), total };
    }

    const [userUpvotes, userBookmarks] = await Promise.all([
      prisma.commentUpvote.findMany({ where: { userId: currentUserId, comment: { postId } }, select: { commentId: true } }),
      prisma.commentBookmark.findMany({ where: { userId: currentUserId, comment: { postId } }, select: { commentId: true } }),
    ]);

    const upvotedSet = new Set(userUpvotes.map((u) => u.commentId));
    const bookmarkedSet = new Set(userBookmarks.map((b) => b.commentId));

    return {
      data: comments.map((comment) => ({
        ...mapComment(comment),
        hasUpvoted: upvotedSet.has(comment.id),
        hasBookmarked: bookmarkedSet.has(comment.id),
      })),
      total,
    };
  }

  /**
   * 函数名称：getCommentWithPost
   *
   * 函数作用：
   *   按 ID 获取评论及其关联的帖子信息。
   * Purpose:
   *   Fetches a comment by ID with its associated post.
   *
   * 调用方 / Called by:
   *   - postController（更新/删除评论时的权限校验）
   *
   * 参数说明 / Parameters:
   *   - commentId: string, 评论 ID
   *
   * 返回值说明 / Returns:
   *   comment & { post } | null
   *
   * 副作用 / Side effects:
   *   无——只读查询
   *
   * 中文关键词：
   *   评论，帖子，关联查询
   * English keywords:
   *   comment, post, include query
   */
  public async getCommentWithPost(commentId: string) {
    return prisma.comment.findUnique({
      where: { id: commentId },
      include: { post: true }
    });
  }

  /**
   * 函数名称：getPostWithCategory
   *
   * 函数作用：
   *   按 ID 获取帖子及其所属分类信息。
   * Purpose:
   *   Fetches a post by ID with its category info.
   *
   * 调用方 / Called by:
   *   postController（权限校验）
   *
   * 参数说明 / Parameters:
   *   - postId: string, 帖子 ID
   *
   * 返回值说明 / Returns:
   *   post & { category } | null
   *
   * 中文关键词：
   *   帖子，分类，关联查询
   * English keywords:
   *   post, category, include query
   */
  public async getPostWithCategory(postId: string) {
    return prisma.post.findUnique({
      where: { id: postId },
      include: { category: true }
    });
  }

  /**
   * 函数名称：getUserLevel
   *
   * 函数作用：
   *   获取用户的等级。
   * Purpose:
   *   Gets a user's level.
   *
   * 调用方 / Called by:
   *   postController.createPost
   *
   * 参数说明 / Parameters:
   *   - userId: string, 用户 ID
   *
   * 返回值说明 / Returns:
   *   number，用户等级（默认 0）
   *
   * 中文关键词：
   *   用户等级，查询
   * English keywords:
   *   user level, query
   */
  public async getUserLevel(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { level: true } });
    return user?.level || 0;
  }

  /**
   * 函数名称：getCommentById
   *
   * 函数作用：
   *   按 ID 获取评论。
   * Purpose:
   *   Fetches a comment by ID.
   *
   * 调用方 / Called by:
   *   postController.createComment / updateComment
   *
   * 参数说明 / Parameters:
   *   - commentId: string, 评论 ID
   *
   * 返回值说明 / Returns:
   *   comment | null
   *
   * 中文关键词：
   *   评论，ID 查询
   * English keywords:
   *   comment, ID query
   */
  public async getCommentById(commentId: string) {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        author: { select: { id: true, username: true, avatarUrl: true } },
        _count: { select: { upvotes: true, bookmarks: true, replies: true } },
      },
    });
    if (!comment) return null;
    return {
      id: comment.id,
      content: comment.content,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      deletedAt: comment.deletedAt,
      isPending: comment.isPending,
      parentId: comment.parentId,
      author: comment.author,
      _count: comment._count,
      hasUpvoted: false,
      hasBookmarked: false,
    };
  }

  /**
   * 函数名称：getPostBasicInfo
   *
   * 函数作用：
   *   获取帖子的基本信息（作者 ID 和标题）。
   * Purpose:
   *   Gets basic post info (author ID and title).
   *
   * 调用方 / Called by:
   *   postController.createComment（用于发布事件）
   *
   * 参数说明 / Parameters:
   *   - postId: string, 帖子 ID
   *
   * 返回值说明 / Returns:
   *   { authorId, title } | null
   *
   * 中文关键词：
   *   帖子基本信息
   * English keywords:
   *   post basic info
   */
  public async getPostBasicInfo(postId: string) {
    return prisma.post.findUnique({ where: { id: postId }, select: { authorId: true, title: true } });
  }

  /**
   * 函数名称：getCommentBasicInfo
   *
   * 函数作用：
   *   获取评论的基本信息（作者 ID）。
   * Purpose:
   *   Gets basic comment info (author ID).
   *
   * 调用方 / Called by:
   *   postController.createComment（用于发布事件）
   *
   * 参数说明 / Parameters:
   *   - commentId: string, 评论 ID
   *
   * 返回值说明 / Returns:
   *   { authorId } | null
   *
   * 中文关键词：
   *   评论基本信息
   * English keywords:
   *   comment basic info
   */
  public async getCommentBasicInfo(commentId: string) {
    return prisma.comment.findUnique({ where: { id: commentId }, select: { authorId: true } });
  }
}

export const communityQueryService = new CommunityQueryService();
