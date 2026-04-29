import { IUserSecurityReadModel } from '../../application/identity/ports/IUserSecurityReadModel';
import { prisma } from '../../db';
import { TotpEncryptionService } from '../services/identity/TotpEncryptionService';

export class PrismaUserSecurityReadModel implements IUserSecurityReadModel {
  constructor(private totpEncryptionService?: TotpEncryptionService) {}

  public async listUserPasskeyIds(userId: string): Promise<any[]> {
    return prisma.passkey.findMany({
      where: { userId },
      select: { id: true, counter: true, publicKey: true },
    });
  }

  public async getUserWithRoleById(userId: string): Promise<any | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });
    if (!user) return null;
    if (this.totpEncryptionService && user.totpSecret) {
      return {
        ...user,
        totpSecret: this.totpEncryptionService.decrypt(user.totpSecret),
      };
    }
    return user;
  }

  public async getPasskeyById(passkeyId: string): Promise<any | null> {
    return prisma.passkey.findUnique({
      where: { id: passkeyId },
    });
  }
}
