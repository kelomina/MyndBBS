/**
 * 路由模块：Draft（发帖草稿，每用户单槽）
 *
 * 函数作用：
 *   GET   /api/v1/drafts/post  读取草稿（无草稿返回 null）
 *   PUT   /api/v1/drafts/post  写入/更新草稿
 *   DELETE /api/v1/drafts/post 清除草稿（发布成功后调用）
 */
import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { postDraftRepository } from '../registry';
import { upsertDraftSchema } from '../lib/validation/schemas';
import { validate } from '../middleware/validation';

const router: Router = Router();

router.get('/post', requireAuth, async (req: Request & { user?: { userId?: string } }, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'ERR_UNAUTHORIZED' });
      return;
    }
    res.json({ draft: await postDraftRepository.get(userId) });
  } catch (err) {
    console.error('[drafts] get failed:', err);
    res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
  }
});

router.put(
  '/post',
  requireAuth,
  validate(upsertDraftSchema),
  async (req: Request & { user?: { userId?: string } }, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'ERR_UNAUTHORIZED' });
        return;
      }
      await postDraftRepository.upsert(userId, {
        title: req.body.title,
        content: req.body.content,
        categoryId: req.body.categoryId ?? null,
      });
      res.json({ success: true, savedAt: new Date().toISOString() });
    } catch (err) {
      console.error('[drafts] save failed:', err);
      res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
    }
  }
);

router.delete('/post', requireAuth, async (req: Request & { user?: { userId?: string } }, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'ERR_UNAUTHORIZED' });
      return;
    }
    await postDraftRepository.clear(userId);
    res.json({ success: true });
  } catch (err) {
    console.error('[drafts] clear failed:', err);
    res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
  }
});

export default router;
