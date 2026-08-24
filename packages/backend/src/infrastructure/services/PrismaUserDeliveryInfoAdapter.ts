/**
 * 适配器：PrismaUserDeliveryInfoAdapter
 */
import { prisma } from '../../db';
import { IUserDeliveryInfoPort } from '../../application/notification/ports/IUserDeliveryInfoPort';

export class PrismaUserDeliveryInfoAdapter implements IUserDeliveryInfoPort {
  public async getDeliveryInfo(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, emailNotificationsEnabled: true },
    });
    if (!user) return null;
    return { email: user.email, emailNotificationsEnabled: user.emailNotificationsEnabled };
  }
}
