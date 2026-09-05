/**
 * 路由模块：Notification（通知徽标合计）
 *
 * - GET /api/notifications/unread-count → {count}（requireAuth，匿名 401；无 userId 参，仅 session）
 * - 本人 isRead=false 全类型计数，不混私信表；复合索引 (userId,isRead,createdAt) 已迁移
 */
import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { getUnreadNotificationCount } from '../controllers/notification'

const router: Router = Router()

router.get('/unread-count', requireAuth, getUnreadNotificationCount)

export default router
