import { Response } from 'express';
import { prisma } from '../db';
import { AuthRequest } from '../middleware/auth';

export const getNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) { res.status(401).json({ error: 'ERR_UNAUTHORIZED' }); return; }

  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50
  });
  
  const unreadCount = await prisma.notification.count({ where: { userId, isRead: false } });

  res.json({ notifications, unreadCount });
};

export const markAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) { res.status(401).json({ error: 'ERR_UNAUTHORIZED' }); return; }

  const { id } = req.body;
  
  if (id === 'all') {
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true }
    });
  } else {
    await prisma.notification.update({
      where: { id, userId },
      data: { isRead: true }
    });
  }

  res.json({ success: true });
};