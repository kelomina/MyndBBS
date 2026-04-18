import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { adminQueryService } from '../queries/admin/AdminQueryService';
import { moderationApplicationService } from '../registry';

export const getModeratedWords = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const words = await adminQueryService.listModeratedWords(userId);
  res.json({ words });
};

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

// Queue endpoints
export const getPendingPosts = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const posts = await adminQueryService.listPendingPosts(userId);
  res.json({ posts });
};

export const approvePendingPost = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  try {
    await moderationApplicationService.approvePost(id);
    res.json({ message: 'Post approved' });
  } catch (error) {
    res.status(404).json({ error: 'ERR_POST_NOT_FOUND' });
  }
};

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

export const getPendingComments = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const comments = await adminQueryService.listPendingComments(userId);
  res.json({ comments });
};

export const approvePendingComment = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  try {
    await moderationApplicationService.approveComment(id);
    res.json({ message: 'Comment approved' });
  } catch (error) {
    res.status(404).json({ error: 'ERR_COMMENT_NOT_FOUND' });
  }
};

export const rejectPendingComment = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  try {
    await moderationApplicationService.rejectComment(id);
    res.json({ message: 'Comment rejected' });
  } catch (error) {
    res.status(404).json({ error: 'ERR_COMMENT_NOT_FOUND' });
  }
};
