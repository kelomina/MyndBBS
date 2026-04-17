import { IModeratorReadModel } from '../../application/notification/ports/IModeratorReadModel';
import { prisma } from '../../db';

export class PrismaModeratorReadModel implements IModeratorReadModel {
  public async listUserIdsByLevel(minLevel: number): Promise<{ id: string }[]> {
    return prisma.user.findMany({
      where: { level: { gte: minLevel } },
      select: { id: true },
    });
  }
}
