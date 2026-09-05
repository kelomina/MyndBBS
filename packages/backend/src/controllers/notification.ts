/**
 * 控制器：Notification（通知徽标合计）
 *
 * - GET /api/notifications/unread-count → {count}（requireAuth，匿名 401；无 userId 参，仅 session 身份）
 * - 本人 isRead=false 全类型计数（POST_REPLIED/COMMENT_REPLIED/MENTION 全含，不混私信表）
 * - 匿名 401 {success:false, error:ERR_UNAUTHORIZED}（与 messages/unread 同口径意图；不用 requireAuthHidden 404）
 */
import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { prisma } from '../db'

export const getUnreadNotificationCount = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  const userId = req.user?.userId
  if (!userId) {
    res.status(401).json({ success: false, error: 'ERR_UNAUTHORIZED' })
    return
  }
  try {
    const count = await prisma.notification.count({ where: { userId, isRead: false } })
    res.json({ count })
  } catch (error) {
    console.error('[notification] unread-count failed:', error)
    res.status(500).json({ success: false, error: 'ERR_INTERNAL_SERVER_ERROR' })
  }
}
