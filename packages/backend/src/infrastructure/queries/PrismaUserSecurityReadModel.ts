import { IUserSecurityReadModel } from '../../application/identity/ports/IUserSecurityReadModel';
import { prisma } from '../../db';

export class PrismaUserSecurityReadModel implements IUserSecurityReadModel {
  public async listUserPasskeyIds(userId: string): Promise<any[]> {
    return prisma.passkey.findMany({
      where: { userId },
      select: { id: true, counter: true, publicKey: true },
    });
  }

  public async getUserWithRoleById(userId: string): Promise<any | null> {
    return prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });
  }

  public async getPasskeyById(passkeyId: string): Promise<any | null> {
    return prisma.passkey.findUnique({
      where: { id: passkeyId },
    });
  }
}
