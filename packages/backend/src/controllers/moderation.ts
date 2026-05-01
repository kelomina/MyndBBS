import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { adminQueryService } from '../queries/admin/AdminQueryService';
import { moderationApplicationService } from '../registry';

/**
 * 函数名称：getModeratedWords
 *
 * 函数作用：
 *   获取当前用户可管理的审核敏感词列表。
 * Purpose:
 *   Retrieves the list of moderated words that the current user can manage.
 *
 * 调用方 / Called by:
 *   GET /api/admin/moderation/words
 *
 * 被调用方 / Calls:
 *   - adminQueryService.listModeratedWords
 *
 * 参数说明 / Parameters:
 *   无请求体参数（从 req.user.userId 获取当前用户 ID）
 *
 * 返回值说明 / Returns:
 *   { words: array } 敏感词列表
 *
 * 错误处理 / Error handling:
 *   无显式错误处理（查询失败返回空数组）
 *
 * 副作用 / Side effects:
 *   无——只读查询
 *
 * 中文关键词：
 *   审核，敏感词，列表，查询
 * English keywords:
 *   moderation, moderated words, list, query
 */
export const getModeratedWords = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const words = await adminQueryService.listModeratedWords(userId);
  res.json({ words });
};

/**
 * 函数名称：addModeratedWord
 *
 * 函数作用：
 *   添加一个新的审核敏感词，可限定到指定分类。
 * Purpose:
 *   Adds a new moderated word, optionally scoped to a specific category.
 *
 * 调用方 / Called by:
 *   POST /api/admin/moderation/words
 *
 * 被调用方 / Calls:
 *   - moderationApplicationService.addModeratedWord
 *
 * 参数说明 / Parameters:
 *   - req.body.word: string, 敏感词内容（必填）
 *   - req.body.categoryId: string | undefined, 限定分类 ID（不传则全局）
 *
 * 返回值说明 / Returns:
 *   { word: object } 或 { error: errorCode }
 *
 * 错误处理 / Error handling:
 *   - 400: ERR_MISSING_WORD（缺少敏感词）
 *   - 400: ERR_WORD_ALREADY_EXISTS（Prisma P2002 重复）
 *   - 403: ERR_CANNOT_ADD_GLOBAL_WORD / ERR_NOT_MODERATOR_OF_CATEGORY
 *   - 500: ERR_INTERNAL_SERVER_ERROR
 *
 * 副作用 / Side effects:
 *   写数据库——创建敏感词记录；发布 ModeratedWordAddedEvent
 *
 * 中文关键词：
 *   审核，添加敏感词，分类限定，内容管理
 * English keywords:
 *   moderation, add moderated word, category scope, content management
 */
export const addModeratedWord = async (req: AuthRequest, res: Response): Promise<void> => {
  const { word, categoryId } = req.body;
  if (!word) {
    res.status(400).json({ error: 'ERR_MISSING_WORD' });
    return;
  }
  
  const userId = req.user!.userId;

  try {
    const newWord = await moderationApplicationService.addModeratedWord(word, categoryId, userId, req.ability!);
    res.json({ word: newWord });
  } catch (error: any) {
    if (['ERR_CANNOT_ADD_GLOBAL_WORD', 'ERR_NOT_MODERATOR_OF_CATEGORY'].includes(error.message)) {
      res.status(403).json({ error: error.message });
      return;
    }
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'ERR_WORD_ALREADY_EXISTS' });
      return;
    }
    res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
  }
};

/**
 * 函数名称：deleteModeratedWord
 *
 * 函数作用：
 *   删除指定 ID 的审核敏感词。
 * Purpose:
 *   Deletes a moderated word by its ID.
 *
 * 调用方 / Called by:
 *   DELETE /api/admin/moderation/words/:id
 *
 * 被调用方 / Calls:
 *   - moderationApplicationService.removeModeratedWord
 *
 * 参数说明 / Parameters:
 *   - req.params.id: string, 敏感词 ID
 *
 * 返回值说明 / Returns:
 *   { message: string } 或 { error: errorCode }
 *
 * 错误处理 / Error handling:
 *   - 403: ERR_CANNOT_DELETE_GLOBAL_WORD / ERR_NOT_MODERATOR_OF_CATEGORY
 *   - 404: ERR_WORD_NOT_FOUND
 *
 * 副作用 / Side effects:
 *   写数据库——删除敏感词记录；发布 ModeratedWordDeletedEvent
 *
 * 中文关键词：
 *   审核，删除敏感词，内容管理
 * English keywords:
 *   moderation, delete moderated word, content management
 */
export const deleteModeratedWord = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const userId = req.user!.userId;

  try {
    await moderationApplicationService.removeModeratedWord(id, userId, req.ability!);
    res.json({ message: 'Word deleted successfully' });
  } catch (error: any) {
    if (['ERR_CANNOT_DELETE_GLOBAL_WORD', 'ERR_NOT_MODERATOR_OF_CATEGORY'].includes(error.message)) {
      res.status(403).json({ error: error.message });
      return;
    }
    res.status(404).json({ error: 'ERR_WORD_NOT_FOUND' });
  }
};

/**
 * 函数名称：getPendingPosts
 *
 * 函数作用：
 *   获取当前用户待审核的帖子列表。
 * Purpose:
 *   Retrieves the list of posts pending moderation for the current user.
 *
 * 调用方 / Called by:
 *   GET /api/admin/moderation/posts
 *
 * 被调用方 / Calls:
 *   - adminQueryService.listPendingPosts
 *
 * 参数说明 / Parameters:
 *   无请求体参数（从 req.user.userId 获取）
 *
 * 返回值说明 / Returns:
 *   { posts: array } 待审核帖子列表
 *
 * 错误处理 / Error handling:
 *   无显式错误处理
 *
 * 副作用 / Side effects:
 *   无——只读查询
 *
 * 中文关键词：
 *   审核，待审核帖子，队列
 * English keywords:
 *   moderation, pending posts, queue
 */
export const getPendingPosts = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const posts = await adminQueryService.listPendingPosts(userId);
  res.json({ posts });
};

/**
 * 函数名称：approvePendingPost
 *
 * 函数作用：
 *   审核通过一篇待审核的帖子。
 * Purpose:
 *   Approves a pending post for publication.
 *
 * 调用方 / Called by:
 *   POST /api/admin/moderation/posts/:id/approve
 *
 * 被调用方 / Calls:
 *   - moderationApplicationService.approvePost
 *
 * 参数说明 / Parameters:
 *   - req.params.id: string, 帖子 ID
 *
 * 返回值说明 / Returns:
 *   { message: string } 或 { error: errorCode }
 *
 * 错误处理 / Error handling:
 *   404: ERR_POST_NOT_FOUND（帖子不存在）
 *
 * 副作用 / Side effects:
 *   写数据库——更新帖子状态为已发布；发布 PostApprovedEvent
 *
 * 中文关键词：
 *   审核，通过帖子，待审核
 * English keywords:
 *   moderation, approve post, pending
 */
export const approvePendingPost = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  try {
    await moderationApplicationService.approvePost(id);
    res.json({ message: 'Post approved' });
  } catch (error) {
    res.status(404).json({ error: 'ERR_POST_NOT_FOUND' });
  }
};

/**
 * 函数名称：rejectPendingPost
 *
 * 函数作用：
 *   拒绝一篇待审核的帖子。
 * Purpose:
 *   Rejects a pending post.
 *
 * 调用方 / Called by:
 *   POST /api/admin/moderation/posts/:id/reject
 *
 * 被调用方 / Calls:
 *   - moderationApplicationService.rejectPost
 *
 * 参数说明 / Parameters:
 *   - req.params.id: string, 帖子 ID
 *   - req.body.reason: string | undefined, 拒绝原因
 *
 * 返回值说明 / Returns:
 *   { message: string } 或 { error: errorCode }
 *
 * 错误处理 / Error handling:
 *   404: ERR_POST_NOT_FOUND（帖子不存在）
 *
 * 副作用 / Side effects:
 *   写数据库——将帖子标记为已删除；发布 PostRejectedEvent
 *
 * 中文关键词：
 *   审核，拒绝帖子，待审核
 * English keywords:
 *   moderation, reject post, pending
 */
export const rejectPendingPost = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const { reason } = req.body;
  try {
    await moderationApplicationService.rejectPost(id, reason);
    res.json({ message: 'Post rejected' });
  } catch (error) {
    res.status(404).json({ error: 'ERR_POST_NOT_FOUND' });
  }
};

/**
 * 函数名称：getPendingComments
 *
 * 函数作用：
 *   获取当前用户待审核的评论列表。
 * Purpose:
 *   Retrieves the list of comments pending moderation for the current user.
 *
 * 调用方 / Called by:
 *   GET /api/admin/moderation/comments
 *
 * 被调用方 / Calls:
 *   - adminQueryService.listPendingComments
 *
 * 参数说明 / Parameters:
 *   无请求体参数（从 req.user.userId 获取）
 *
 * 返回值说明 / Returns:
 *   { comments: array } 待审核评论列表
 *
 * 错误处理 / Error handling:
 *   无显式错误处理
 *
 * 副作用 / Side effects:
 *   无——只读查询
 *
 * 中文关键词：
 *   审核，待审核评论，队列
 * English keywords:
 *   moderation, pending comments, queue
 */
export const getPendingComments = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const comments = await adminQueryService.listPendingComments(userId);
  res.json({ comments });
};

/**
 * 函数名称：approvePendingComment
 *
 * 函数作用：
 *   审核通过一条待审核的评论。
 * Purpose:
 *   Approves a pending comment.
 *
 * 调用方 / Called by:
 *   POST /api/admin/moderation/comments/:id/approve
 *
 * 被调用方 / Calls:
 *   - moderationApplicationService.approveComment
 *
 * 参数说明 / Parameters:
 *   - req.params.id: string, 评论 ID
 *
 * 返回值说明 / Returns:
 *   { message: string } 或 { error: errorCode }
 *
 * 错误处理 / Error handling:
 *   404: ERR_COMMENT_NOT_FOUND（评论不存在）
 *
 * 副作用 / Side effects:
 *   写数据库——更新评论状态为已发布
 *
 * 中文关键词：
 *   审核，通过评论，待审核
 * English keywords:
 *   moderation, approve comment, pending
 */
export const approvePendingComment = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  try {
    await moderationApplicationService.approveComment(id);
    res.json({ message: 'Comment approved' });
  } catch (error) {
    res.status(404).json({ error: 'ERR_COMMENT_NOT_FOUND' });
  }
};

/**
 * 函数名称：rejectPendingComment
 *
 * 函数作用：
 *   拒绝一条待审核的评论。
 * Purpose:
 *   Rejects a pending comment.
 *
 * 调用方 / Called by:
 *   POST /api/admin/moderation/comments/:id/reject
 *
 * 被调用方 / Calls:
 *   - moderationApplicationService.rejectComment
 *
 * 参数说明 / Parameters:
 *   - req.params.id: string, 评论 ID
 *
 * 返回值说明 / Returns:
 *   { message: string } 或 { error: errorCode }
 *
 * 错误处理 / Error handling:
 *   404: ERR_COMMENT_NOT_FOUND（评论不存在）
 *
 * 副作用 / Side effects:
 *   写数据库——将评论标记为已删除
 *
 * 中文关键词：
 *   审核，拒绝评论，待审核
 * English keywords:
 *   moderation, reject comment, pending
 */
export const rejectPendingComment = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  try {
    await moderationApplicationService.rejectComment(id);
    res.json({ message: 'Comment rejected' });
  } catch (error) {
    res.status(404).json({ error: 'ERR_COMMENT_NOT_FOUND' });
  }
};
