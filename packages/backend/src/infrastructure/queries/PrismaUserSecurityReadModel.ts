/**
 * 类名称：PrismaUserSecurityReadModel
 *
 * 函数作用：
 *   Prisma 实现的用户安全读模型——为 Sudo 模式提供 Passkey 和用户身份查询。
 * Purpose:
 *   Prisma-based user security read model — provides passkey and user identity queries for sudo mode.
 *
 * 中文关键词：
 *   Prisma，用户安全，读模型，Sudo
 * English keywords:
 *   Prisma, user security, read model, sudo
 */
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
