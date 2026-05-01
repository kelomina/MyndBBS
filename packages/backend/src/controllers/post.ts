/**
 * Post Controller
 * Handles post and comment operations.
 */
import { Response, Request } from 'express';
import { AuthRequest } from '../middleware/auth';

import { communityApplicationService } from '../registry';
import { communityQueryService } from '../queries/community/CommunityQueryService';

/**
 * 函数名称：getPostsList
 *
 * 函数作用：
 *   获取分页的帖子列表，支持按分类和排序方式过滤。
 * Purpose:
 *   Fetches a paginated list of posts, with support for filtering by category and sort order.
 *
 * 调用方 / Called by:
 *   GET /api/posts
 *
 * 被调用方 / Calls:
 *   - communityQueryService.listPosts
 *
 * 参数说明 / Parameters:
 *   - req.query.category: string | undefined, 分类过滤
 *   - req.query.sortBy: string | undefined, 排序方式
 *
 * 返回值说明 / Returns:
 *   200: Post[] 帖子数组
 *   500: { error: errorCode }
 *
 * 错误处理 / Error handling:
 *   500: ERR_FAILED_TO_FETCH_POSTS
 *
 * 副作用 / Side effects:
 *   无——只读查询
 *
 * 中文关键词：
 *   帖子，列表，分页，分类过滤，排序
 * English keywords:
 *   post, list, pagination, category filter, sort
 */
export const getPostsList = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const posts = await communityQueryService.listPosts({
      ability: req.ability!,
      category: req.query.category as string,
      sortBy: req.query.sortBy as string,
    });
    res.json(posts);
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ error: 'ERR_FAILED_TO_FETCH_POSTS' });
  }
};

/**
 * 函数名称：createPost
 *
 * 函数作用：
 *   创建新帖子——验证验证码、用户等级和内容审核状态。
 * Purpose:
 *   Creates a new post — validates captcha, user level, and content moderation status.
 *
 * 调用方 / Called by:
 *   POST /api/posts
 *
 * 被调用方 / Calls:
 *   - communityQueryService.getUserLevel
 *   - communityApplicationService.createPost
 *   - communityQueryService.getPostById
 *
 * 参数说明 / Parameters:
 *   - req.body.title: string, 帖子标题（必填）
 *   - req.body.content: string, 帖子内容（必填）
 *   - req.body.categoryId: string, 分类 ID（必填）
 *   - req.body.captchaId: string, 验证码 ID（必填）
 *
 * 返回值说明 / Returns:
 *   201: { post, isModerated } 或 { message, post }
 *   400: { error: errorCode }
 *   500: { error: errorCode }
 *
 * 错误处理 / Error handling:
 *   - 400: 字段校验错误、验证码无效、等级不足、命中敏感词
 *   - 500: ERR_FAILED_TO_CREATE_POST
 *
 * 副作用 / Side effects:
 *   写数据库——创建帖子记录
 *
 * 中文关键词：
 *   帖子，创建，验证码，等级校验，内容审核
 * English keywords:
 *   post, create, captcha, level validation, content moderation
 */
export const createPost = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, content, categoryId, captchaId } = req.body;
    
    if (!title || !content || !categoryId) {
      res.status(400).json({ error: 'ERR_TITLE_CONTENT_AND_CATEGORYID_ARE_REQUIRED' });
      return;
    }

    if (!captchaId) {
      res.status(400).json({ error: 'ERR_CAPTCHA_IS_REQUIRED' });
      return;
    }

    const userLevel = await communityQueryService.getUserLevel(req.user!.userId);
    
    try {
      const result = await communityApplicationService.createPost(
        title, 
        content, 
        categoryId, 
        req.user!.userId, 
        userLevel,
        captchaId
      );
      const postDto = await communityQueryService.getPostById(req.ability!, result.postId);
      if (result.message) {
        res.status(201).json({ message: result.message, post: postDto });
        return;
      }
      res.status(201).json({ post: postDto, isModerated: result.isModerated });
    } catch (error: any) {
      const errorCode = typeof error?.message === 'string' && error.message.startsWith('ERR_')
        ? error.message
        : 'ERR_BAD_REQUEST';
      res.status(400).json({ error: errorCode });
      return;
    }
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ error: 'ERR_FAILED_TO_CREATE_POST' });
  }
};

/**
 * 函数名称：getPostDetails
 *
 * 函数作用：
 *   获取指定帖子的详细信息。
 * Purpose:
 *   Fetches detailed information for a specific post.
 *
 * 调用方 / Called by:
 *   GET /api/posts/:id
 *
 * 被调用方 / Calls:
 *   - communityQueryService.getPostById
 *
 * 参数说明 / Parameters:
 *   - req.params.id: string, 帖子 ID
 *
 * 返回值说明 / Returns:
 *   200: Post 帖子详情对象
 *   403: { error: ERR_POST_NOT_FOUND_OR_ACCESS_DENIED }
 *   500: { error: errorCode }
 *
 * 错误处理 / Error handling:
 *   - 403: 帖子不存在或无权查看
 *   - 500: ERR_FAILED_TO_FETCH_POST
 *
 * 副作用 / Side effects:
 *   无——只读查询
 *
 * 中文关键词：
 *   帖子，详情，查询
 * English keywords:
 *   post, details, query
 */
export const getPostDetails = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const postId = req.params.id as string;
    
    const post = await communityQueryService.getPostById(req.ability!, postId);

    if (!post) {
      res.status(403).json({ error: 'ERR_POST_NOT_FOUND_OR_ACCESS_DENIED' });
      return;
    }

    res.json(post);
  } catch (error) {
    console.error('Error fetching post:', error);
    res.status(500).json({ error: 'ERR_FAILED_TO_FETCH_POST' });
  }
};

/**
 * 函数名称：getPostInteractions
 *
 * 函数作用：
 *   获取当前用户对指定帖子的互动状态（点赞、书签等）。
 * Purpose:
 *   Gets the current user's interaction status (upvote, bookmark, etc.) for a post.
 *
 * 调用方 / Called by:
 *   GET /api/posts/:id/interactions
 *
 * 被调用方 / Calls:
 *   - communityQueryService.getPostInteractions
 *
 * 参数说明 / Parameters:
 *   - req.params.id: string, 帖子 ID
 *
 * 返回值说明 / Returns:
 *   200: PostInteractionDTO 互动状态对象
 *   403: { error: ERR_POST_NOT_FOUND_OR_ACCESS_DENIED }
 *   500: { error: errorCode }
 *
 * 错误处理 / Error handling:
 *   - 403: 帖子不存在或无权访问
 *   - 500: ERR_FAILED_TO_FETCH_INTERACTION_STATUS
 *
 * 副作用 / Side effects:
 *   无——只读查询
 *
 * 中文关键词：
 *   帖子，互动，点赞状态，书签状态
 * English keywords:
 *   post, interaction, upvote status, bookmark status
 */
export const getPostInteractions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const dto = await communityQueryService.getPostInteractions(req.ability!, req.params.id as string, req.user!.userId);
    if (!dto) {
      res.status(403).json({ error: 'ERR_POST_NOT_FOUND_OR_ACCESS_DENIED' });
      return;
    }
    res.json(dto);
  } catch (error) {
    console.error('Error fetching interactions:', error);
    res.status(500).json({ error: 'ERR_FAILED_TO_FETCH_INTERACTION_STATUS' });
  }
};

/**
 * 函数名称：toggleUpvote
 *
 * 函数作用：
 *   切换对指定帖子的点赞状态。
 * Purpose:
 *   Toggles the upvote status on a specific post.
 *
 * 调用方 / Called by:
 *   POST /api/posts/:id/upvote
 *
 * 被调用方 / Calls:
 *   - communityApplicationService.togglePostUpvote
 *
 * 参数说明 / Parameters:
 *   - req.params.id: string, 帖子 ID
 *
 * 返回值说明 / Returns:
 *   200: { upvoted: boolean }
 *   404/403/500: { error: errorCode }
 *
 * 错误处理 / Error handling:
 *   - 404: ERR_POST_NOT_FOUND
 *   - 403: FORBIDDEN
 *   - 500: ERR_FAILED_TO_TOGGLE_UPVOTE
 *
 * 副作用 / Side effects:
 *   写数据库——创建或删除点赞记录
 *
 * 中文关键词：
 *   帖子，点赞，切换
 * English keywords:
 *   post, upvote, toggle
 */
export const toggleUpvote = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const postId = req.params.id as string;
    const userId = req.user!.userId;

    const status = await communityApplicationService.togglePostUpvote(req.ability!, postId, userId);
    res.json({ upvoted: status });
  } catch (error: any) {
    console.error('Error toggling upvote:', error);
    if (error.message === 'ERR_POST_NOT_FOUND') {
      res.status(404).json({ error: error.message });
    } else if (error.message?.includes('FORBIDDEN')) {
      res.status(403).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'ERR_FAILED_TO_TOGGLE_UPVOTE' });
    }
  }
};

/**
 * 函数名称：toggleBookmark
 *
 * 函数作用：
 *   切换对指定帖子的书签状态。
 * Purpose:
 *   Toggles the bookmark status on a specific post.
 *
 * 调用方 / Called by:
 *   POST /api/posts/:id/bookmark
 *
 * 被调用方 / Calls:
 *   - communityApplicationService.togglePostBookmark
 *
 * 参数说明 / Parameters:
 *   - req.params.id: string, 帖子 ID
 *
 * 返回值说明 / Returns:
 *   200: { bookmarked: boolean }
 *   404/403/500: { error: errorCode }
 *
 * 错误处理 / Error handling:
 *   - 404: ERR_POST_NOT_FOUND
 *   - 403: FORBIDDEN
 *   - 500: ERR_FAILED_TO_TOGGLE_BOOKMARK
 *
 * 副作用 / Side effects:
 *   写数据库——创建或删除书签记录
 *
 * 中文关键词：
 *   帖子，书签，切换
 * English keywords:
 *   post, bookmark, toggle
 */
export const toggleBookmark = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const postId = req.params.id as string;
    const userId = req.user!.userId;

    const status = await communityApplicationService.togglePostBookmark(req.ability!, postId, userId);
    res.json({ bookmarked: status });
  } catch (error: any) {
    console.error('Error toggling bookmark:', error);
    if (error.message === 'ERR_POST_NOT_FOUND') {
      res.status(404).json({ error: error.message });
    } else if (error.message?.includes('FORBIDDEN')) {
      res.status(403).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'ERR_FAILED_TO_TOGGLE_BOOKMARK' });
    }
  }
};

/**
 * 函数名称：getComments
 *
 * 函数作用：
 *   获取指定帖子的所有评论，支持可选的当前用户上下文以确定互动状态。
 * Purpose:
 *   Fetches all comments for a specific post, with optional current user context for interaction status.
 *
 * 调用方 / Called by:
 *   GET /api/posts/:id/comments
 *
 * 被调用方 / Calls:
 *   - communityQueryService.listPostComments
 *
 * 参数说明 / Parameters:
 *   - req.params.id: string, 帖子 ID
 *   - req.user.userId: string | undefined, 当前用户 ID（可选，用于识别用户的点赞/书签状态）
 *
 * 返回值说明 / Returns:
 *   200: PostCommentsDTO 评论列表（含互动状态）
 *   403: { error: ERR_POST_NOT_FOUND_OR_ACCESS_DENIED }
 *   500: { error: errorCode }
 *
 * 错误处理 / Error handling:
 *   - 403: 帖子不存在或无权访问
 *   - 500: ERR_FAILED_TO_FETCH_COMMENTS
 *
 * 副作用 / Side effects:
 *   无——只读查询
 *
 * 中文关键词：
 *   帖子，评论列表，查询，互动状态
 * English keywords:
 *   post, comment list, query, interaction status
 */
export const getComments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const dto = await communityQueryService.listPostComments({
      ability: req.ability!,
      postId: req.params.id as string,
      ...(req.user?.userId ? { currentUserId: req.user.userId } : {}),
    });
    if (!dto) {
      res.status(403).json({ error: 'ERR_POST_NOT_FOUND_OR_ACCESS_DENIED' });
      return;
    }
    res.json(dto);
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'ERR_FAILED_TO_FETCH_COMMENTS' });
  }
};

/**
 * 函数名称：createComment
 *
 * 函数作用：
 *   在指定帖子上创建新评论——验证验证码、检查内容审核状态，支持回复父级评论。
 * Purpose:
 *   Creates a new comment on a post — validates captcha, checks content moderation, supports replying to parent comments.
 *
 * 调用方 / Called by:
 *   POST /api/posts/:id/comments
 *
 * 被调用方 / Calls:
 *   - communityApplicationService.createComment
 *   - communityQueryService.getCommentById
 *
 * 参数说明 / Parameters:
 *   - req.params.id: string, 帖子 ID
 *   - req.body.content: string, 评论内容（必填）
 *   - req.body.parentId: string | undefined, 父评论 ID（回复时使用）
 *   - req.body.captchaId: string, 验证码 ID（必填）
 *
 * 返回值说明 / Returns:
 *   201: CommentDTO 或 { message, comment }（待审核时）
 *   400: { error: errorCode }
 *   500: { error: errorCode }
 *
 * 错误处理 / Error handling:
 *   - 400: 缺少内容、缺少验证码、验证码无效、命中敏感词等
 *   - 500: ERR_FAILED_TO_CREATE_COMMENT
 *
 * 副作用 / Side effects:
 *   写数据库——创建评论记录；发布 PostRepliedEvent / CommentRepliedEvent
 *
 * 中文关键词：
 *   评论，创建，回复，验证码，内容审核
 * English keywords:
 *   comment, create, reply, captcha, moderation
 */
export const createComment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const postId = req.params.id as string;
    const { content, parentId, captchaId } = req.body;

    if (!content) {
      res.status(400).json({ error: 'ERR_COMMENT_CONTENT_IS_REQUIRED' });
      return;
    }

    if (!captchaId) {
      res.status(400).json({ error: 'ERR_CAPTCHA_IS_REQUIRED' });
      return;
    }

    try {
      const result = await communityApplicationService.createComment(
        content,
        postId,
        req.user!.userId,
        captchaId,
        parentId || undefined
      );

      const commentDto = await communityQueryService.getCommentById(result.commentId);
      
      if (commentDto?.isPending) {
        res.status(201).json({ message: 'ERR_PENDING_MODERATION', comment: commentDto });
        return;
      }

      res.status(201).json(commentDto);
    } catch (error: any) {
      const errorCode = typeof error?.message === 'string' && error.message.startsWith('ERR_')
        ? error.message
        : 'ERR_BAD_REQUEST';
      res.status(400).json({ error: errorCode });
      return;
    }
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({ error: 'ERR_FAILED_TO_CREATE_COMMENT' });
  }
};

/**
 * 函数名称：updatePost
 *
 * 函数作用：
 *   更新已有帖子——校验 CASL 权限、重新检查内容审核状态。
 * Purpose:
 *   Updates an existing post — validates CASL permissions, re-checks content moderation.
 *
 * 调用方 / Called by:
 *   PUT /api/posts/:id
 *
 * 被调用方 / Calls:
 *   - communityApplicationService.updatePost
 *   - communityQueryService.getPostById
 *
 * 参数说明 / Parameters:
 *   - req.params.id: string, 帖子 ID
 *   - req.body.title: string, 新标题（必填）
 *   - req.body.content: string, 新内容（必填）
 *   - req.body.categoryId: string, 新分类 ID（必填）
 *
 * 返回值说明 / Returns:
 *   200: PostDTO 或 { message, post }（重新进入待审核时）
 *   400/403/404: { error: errorCode }
 *   500: { error: errorCode }
 *
 * 错误处理 / Error handling:
 *   - 404: ERR_POST_NOT_FOUND
 *   - 403: FORBIDDEN
 *   - 400: 字段校验错误
 *   - 500: ERR_FAILED_TO_UPDATE_POST
 *
 * 副作用 / Side effects:
 *   写数据库——更新帖子内容
 *
 * 中文关键词：
 *   帖子，更新，权限校验，内容审核
 * English keywords:
 *   post, update, permission check, moderation
 */
export const updatePost = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const postId = req.params.id as string;
    const { title, content, categoryId } = req.body;
    
    if (!title || !content || !categoryId) {
      res.status(400).json({ error: 'ERR_TITLE_CONTENT_AND_CATEGORYID_ARE_REQUIRED' });
      return;
    }

    const result = await communityApplicationService.updatePost(req.ability!, postId, title, content, categoryId);
    const postDto = await communityQueryService.getPostById(req.ability!, result.postId);
    if (postDto?.status === 'PENDING') {
      res.json({ message: 'ERR_PENDING_MODERATION', post: postDto });
      return;
    }
    res.json(postDto);
  } catch (error: any) {
    console.error('Error updating post:', error);
    if (error.message === 'ERR_POST_NOT_FOUND') {
      res.status(404).json({ error: error.message });
    } else if (error.message?.includes('FORBIDDEN')) {
      res.status(403).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'ERR_FAILED_TO_UPDATE_POST' });
    }
  }
};

/**
 * 函数名称：deletePost
 *
 * 函数作用：
 *   软删除指定帖子及其关联评论——校验 CASL 权限。
 * Purpose:
 *   Soft-deletes a post and its associated comments — validates CASL permissions.
 *
 * 调用方 / Called by:
 *   DELETE /api/posts/:id
 *
 * 被调用方 / Calls:
 *   - communityApplicationService.deletePost
 *
 * 参数说明 / Parameters:
 *   - req.params.id: string, 帖子 ID
 *
 * 返回值说明 / Returns:
 *   200: { message: string }
 *   403/404: { error: errorCode }
 *   500: { error: errorCode }
 *
 * 错误处理 / Error handling:
 *   - 404: ERR_POST_NOT_FOUND
 *   - 403: FORBIDDEN
 *   - 500: ERR_FAILED_TO_DELETE_POST
 *
 * 副作用 / Side effects:
 *   写数据库——标记帖子及评论为已删除
 *
 * 事务边界 / Transaction:
 *   由 communityApplicationService.deletePost 内部通过 UnitOfWork 管理
 *
 * 中文关键词：
 *   帖子，软删除，级联删除评论
 * English keywords:
 *   post, soft delete, cascade delete comments
 */
export const deletePost = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const postId = req.params.id as string;
    
    await communityApplicationService.deletePost(req.ability!, postId);
    res.json({ message: 'Post and its comments deleted' });
  } catch (error: any) {
    if (error.message === 'ERR_POST_NOT_FOUND') {
      res.status(404).json({ error: error.message });
    } else if (error.message?.includes('FORBIDDEN')) {
      res.status(403).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'ERR_FAILED_TO_DELETE_POST' });
    }
  }
};

/**
 * 函数名称：updateComment
 *
 * 函数作用：
 *   更新已有评论——校验 CASL 权限、重新检查内容审核状态。
 * Purpose:
 *   Updates an existing comment — validates CASL permissions, re-checks content moderation.
 *
 * 调用方 / Called by:
 *   PUT /api/posts/comments/:commentId
 *
 * 被调用方 / Calls:
 *   - communityApplicationService.updateComment
 *   - communityQueryService.getCommentById
 *
 * 参数说明 / Parameters:
 *   - req.params.commentId: string, 评论 ID
 *   - req.body.content: string, 新评论内容（必填）
 *
 * 返回值说明 / Returns:
 *   200: CommentDTO 或 { message, comment }（重新进入待审核时）
 *   404/403: { error: errorCode }
 *   500: { error: errorCode }
 *
 * 错误处理 / Error handling:
 *   - 404: ERR_COMMENT_NOT_FOUND
 *   - 403: FORBIDDEN
 *   - 400: ERR_CONTENT_IS_REQUIRED
 *   - 500: ERR_FAILED_TO_UPDATE_COMMENT
 *
 * 副作用 / Side effects:
 *   写数据库——更新评论内容
 *
 * 中文关键词：
 *   评论，更新，权限校验，内容审核
 * English keywords:
 *   comment, update, permission check, moderation
 */
export const updateComment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const commentId = req.params.commentId as string;
    const { content } = req.body;
    
    if (!content) {
      res.status(400).json({ error: 'ERR_CONTENT_IS_REQUIRED' });
      return;
    }

    const result = await communityApplicationService.updateComment(req.ability!, commentId, content);
    const commentDto = await communityQueryService.getCommentById(result.commentId);

    if (commentDto?.isPending) {
      res.json({ message: 'ERR_PENDING_MODERATION', comment: commentDto });
      return;
    }

    res.json(commentDto);
  } catch (error: any) {
    if (error.message === 'ERR_COMMENT_NOT_FOUND') {
      res.status(404).json({ error: error.message });
    } else if (error.message?.includes('FORBIDDEN')) {
      res.status(403).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'ERR_FAILED_TO_UPDATE_COMMENT' });
    }
  }
};

/**
 * 函数名称：deleteComment
 *
 * 函数作用：
 *   软删除指定评论——校验 CASL 权限。
 * Purpose:
 *   Soft-deletes a comment — validates CASL permissions.
 *
 * 调用方 / Called by:
 *   DELETE /api/posts/comments/:commentId
 *
 * 被调用方 / Calls:
 *   - communityApplicationService.deleteComment
 *
 * 参数说明 / Parameters:
 *   - req.params.commentId: string, 评论 ID
 *
 * 返回值说明 / Returns:
 *   200: { message: string }
 *   404/403: { error: errorCode }
 *   500: { error: errorCode }
 *
 * 错误处理 / Error handling:
 *   - 404: ERR_COMMENT_NOT_FOUND
 *   - 403: FORBIDDEN
 *   - 500: ERR_FAILED_TO_DELETE_COMMENT
 *
 * 副作用 / Side effects:
 *   写数据库——设置评论的 deletedAt 字段
 *
 * 中文关键词：
 *   评论，软删除，权限校验
 * English keywords:
 *   comment, soft delete, permission check
 */
export const deleteComment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const commentId = req.params.commentId as string;
    
    await communityApplicationService.deleteComment(req.ability!, commentId);
    res.json({ message: 'Comment deleted' });
  } catch (error: any) {
    if (error.message === 'ERR_COMMENT_NOT_FOUND') {
      res.status(404).json({ error: error.message });
    } else if (error.message?.includes('FORBIDDEN')) {
      res.status(403).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'ERR_FAILED_TO_DELETE_COMMENT' });
    }
  }
};

/**
 * 函数名称：toggleCommentUpvote
 *
 * 函数作用：
 *   切换对指定评论的点赞状态。
 * Purpose:
 *   Toggles the upvote status on a specific comment.
 *
 * 调用方 / Called by:
 *   POST /api/posts/comments/:commentId/upvote
 *
 * 被调用方 / Calls:
 *   - communityApplicationService.toggleCommentUpvote
 *
 * 参数说明 / Parameters:
 *   - req.params.commentId: string, 评论 ID
 *
 * 返回值说明 / Returns:
 *   200: { upvoted: boolean }
 *   404/403: { error: errorCode }
 *   500: { error: errorCode }
 *
 * 错误处理 / Error handling:
 *   - 404: ERR_COMMENT_NOT_FOUND / ERR_POST_NOT_FOUND
 *   - 403: FORBIDDEN
 *   - 500: ERR_FAILED_TO_TOGGLE_COMMENT_UPVOTE
 *
 * 副作用 / Side effects:
 *   写数据库——创建或删除评论点赞记录
 *
 * 中文关键词：
 *   评论，点赞，切换
 * English keywords:
 *   comment, upvote, toggle
 */
export const toggleCommentUpvote = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const commentId = req.params.commentId as string;
    const userId = req.user!.userId;

    const status = await communityApplicationService.toggleCommentUpvote(req.ability!, commentId, userId);
    res.json({ upvoted: status });
  } catch (error: any) {
    console.error('Error toggling comment upvote:', error);
    if (error.message === 'ERR_COMMENT_NOT_FOUND' || error.message === 'ERR_POST_NOT_FOUND') {
      res.status(404).json({ error: error.message });
    } else if (error.message?.includes('FORBIDDEN')) {
      res.status(403).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'ERR_FAILED_TO_TOGGLE_COMMENT_UPVOTE' });
    }
  }
};

/**
 * 函数名称：toggleCommentBookmark
 *
 * 函数作用：
 *   切换对指定评论的书签状态。
 * Purpose:
 *   Toggles the bookmark status on a specific comment.
 *
 * 调用方 / Called by:
 *   POST /api/posts/comments/:commentId/bookmark
 *
 * 被调用方 / Calls:
 *   - communityApplicationService.toggleCommentBookmark
 *
 * 参数说明 / Parameters:
 *   - req.params.commentId: string, 评论 ID
 *
 * 返回值说明 / Returns:
 *   200: { bookmarked: boolean }
 *   404/403: { error: errorCode }
 *   500: { error: errorCode }
 *
 * 错误处理 / Error handling:
 *   - 404: ERR_COMMENT_NOT_FOUND / ERR_POST_NOT_FOUND
 *   - 403: FORBIDDEN
 *   - 500: ERR_FAILED_TO_TOGGLE_COMMENT_BOOKMARK
 *
 * 副作用 / Side effects:
 *   写数据库——创建或删除评论书签记录
 *
 * 中文关键词：
 *   评论，书签，切换
 * English keywords:
 *   comment, bookmark, toggle
 */
export const toggleCommentBookmark = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const commentId = req.params.commentId as string;
    const userId = req.user!.userId;

    const status = await communityApplicationService.toggleCommentBookmark(req.ability!, commentId, userId);
    res.json({ bookmarked: status });
  } catch (error: any) {
    console.error('Error toggling comment bookmark:', error);
    if (error.message === 'ERR_COMMENT_NOT_FOUND' || error.message === 'ERR_POST_NOT_FOUND') {
      res.status(404).json({ error: error.message });
    } else if (error.message?.includes('FORBIDDEN')) {
      res.status(403).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'ERR_FAILED_TO_TOGGLE_COMMENT_BOOKMARK' });
    }
  }
};
