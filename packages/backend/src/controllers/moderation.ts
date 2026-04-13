import { Response } from 'express';
import { prisma } from '../db';
import { AuthRequest } from '../middleware/auth';
import { adminQueryService } from '../queries/admin/AdminQueryService';
import { clearModerationCache } from '../lib/moderation';
import { globalEventBus } from '../infrastructure/events/InMemoryEventBus';
import { ModerationApplicationService } from '../application/community/ModerationApplicationService';
import { PrismaPostRepository } from '../infrastructure/repositories/PrismaPostRepository';
import { PrismaCommentRepository } from '../infrastructure/repositories/PrismaCommentRepository';
import { PrismaModeratedWordRepository } from '../infrastructure/repositories/PrismaModeratedWordRepository';

const moderationApplicationService = new ModerationApplicationService(
  new PrismaPostRepository(),
  new PrismaCommentRepository(),
  new PrismaModeratedWordRepository(),
  globalEventBus
);

/**
 * Callers: []
 * Callees: [findUnique, map, findMany, json]
 * Description: Handles the get moderated words logic for the application.
 * Keywords: getmoderatedwords, get, moderated, words, auto-annotated
 */
export const getModeratedWords = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const words = await adminQueryService.listModeratedWords(userId);
  res.json({ words });
};

/**
 * Callers: []
 * Callees: [json, status, findUnique, some, create, clearModerationCache]
 * Description: Handles the add moderated word logic for the application.
 * Keywords: addmoderatedword, add, moderated, word, auto-annotated
 */
export const addModeratedWord = async (req: AuthRequest, res: Response): Promise<void> => {
  const { word, categoryId } = req.body;
  if (!word) {
    res.status(400).json({ error: 'ERR_MISSING_WORD' });
    return;
  }
  
  const userId = req.user!.userId;
  const { isSuperAdmin, categoryIds } = await adminQueryService.getModeratorScope(userId);
  
  if (!isSuperAdmin) {
    if (!categoryId) {
      res.status(403).json({ error: 'ERR_CANNOT_ADD_GLOBAL_WORD' });
      return;
    }
    const isMod = categoryIds?.includes(categoryId);
    if (!isMod) {
      res.status(403).json({ error: 'ERR_NOT_MODERATOR_OF_CATEGORY' });
      return;
    }
  }

  try {
    const newWord = await moderationApplicationService.addModeratedWord(word, categoryId);
    await clearModerationCache();
    res.json({ word: newWord });
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'ERR_WORD_ALREADY_EXISTS' });
      return;
    }
    res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
  }
};

/**
 * Callers: []
 * Callees: [findUnique, json, status, some, delete, clearModerationCache]
 * Description: Handles the delete moderated word logic for the application.
 * Keywords: deletemoderatedword, delete, moderated, word, auto-annotated
 */
export const deleteModeratedWord = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  
  const userId = req.user!.userId;
  const { isSuperAdmin, categoryIds } = await adminQueryService.getModeratorScope(userId);

  const word = await adminQueryService.getModeratedWordById(id);
  if (!word) {
    res.status(404).json({ error: 'ERR_WORD_NOT_FOUND' });
    return;
  }

  if (!isSuperAdmin) {
    if (!word.categoryId) {
      res.status(403).json({ error: 'ERR_CANNOT_DELETE_GLOBAL_WORD' });
      return;
    }
    const isMod = categoryIds?.includes(word.categoryId);
    if (!isMod) {
      res.status(403).json({ error: 'ERR_NOT_MODERATOR_OF_CATEGORY' });
      return;
    }
  }

  try {
    await moderationApplicationService.removeModeratedWord(id);
    await clearModerationCache();
    res.json({ message: 'Word deleted successfully' });
  } catch (error) {
    res.status(404).json({ error: 'ERR_WORD_NOT_FOUND' });
  }
};

// Queue endpoints
/**
 * Callers: []
 * Callees: [findUnique, map, findMany, json]
 * Description: Handles the get pending posts logic for the application.
 * Keywords: getpendingposts, get, pending, posts, auto-annotated
 */
export const getPendingPosts = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const posts = await adminQueryService.listPendingPosts(userId);
  res.json({ posts });
};

/**
 * Callers: []
 * Callees: [update, sendNotification, json, status]
 * Description: Handles the approve pending post logic for the application.
 * Keywords: approvependingpost, approve, pending, post, auto-annotated
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
 * Callers: []
 * Callees: [update, sendNotification, json, status]
 * Description: Handles the reject pending post logic for the application.
 * Keywords: rejectpendingpost, reject, pending, post, auto-annotated
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
 * Callers: []
 * Callees: [findUnique, map, findMany, json]
 * Description: Handles the get pending comments logic for the application.
 * Keywords: getpendingcomments, get, pending, comments, auto-annotated
 */
export const getPendingComments = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const comments = await adminQueryService.listPendingComments(userId);
  res.json({ comments });
};

/**
 * Callers: []
 * Callees: [update, json, status]
 * Description: Handles the approve pending comment logic for the application.
 * Keywords: approvependingcomment, approve, pending, comment, auto-annotated
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
 * Callers: []
 * Callees: [update, json, status]
 * Description: Handles the reject pending comment logic for the application.
 * Keywords: rejectpendingcomment, reject, pending, comment, auto-annotated
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
