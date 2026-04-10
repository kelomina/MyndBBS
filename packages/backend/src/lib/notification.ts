import { prisma } from '../db';
import { NotificationType } from '@prisma/client';

interface SendNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  content: string;
  relatedId?: string;
}

export const sendNotification = async (params: SendNotificationParams) => {
  return prisma.notification.create({
    data: params
  });
};