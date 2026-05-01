/**
 * 类名称：PrismaUserKeyRepository
 *
 * 函数作用：
 *   Prisma 实现的用户密钥仓储。
 * Purpose:
 *   Prisma-based user key repository.
 *
 * 中文关键词：
 *   Prisma，用户密钥，仓储
 * English keywords:
 *   Prisma, user key, repository
 */
import { IUserKeyRepository } from '../../domain/messaging/IUserKeyRepository';
import { UserKey, UserKeyProps } from '../../domain/messaging/UserKey';
import { prisma } from '../../db';

export class PrismaUserKeyRepository implements IUserKeyRepository {
  private toDomain(raw: any): UserKey {
    const props: UserKeyProps = {
      userId: raw.userId,
      scheme: raw.scheme,
      publicKey: raw.publicKey,
      encryptedPrivateKey: raw.encryptedPrivateKey,
      mlKemPublicKey: raw.mlKemPublicKey,
      encryptedMlKemPrivateKey: raw.encryptedMlKemPrivateKey,
    };
    return UserKey.load(props);
  }

  public async findByUserId(userId: string): Promise<UserKey | null> {
    const raw = await prisma.userKey.findUnique({ where: { userId } });
    if (!raw) return null;
    return this.toDomain(raw);
  }

  public async save(userKey: UserKey): Promise<void> {
    await prisma.userKey.upsert({
      where: { userId: userKey.userId },
      create: {
        userId: userKey.userId,
        scheme: userKey.scheme,
        publicKey: userKey.publicKey,
        encryptedPrivateKey: userKey.encryptedPrivateKey,
        mlKemPublicKey: userKey.mlKemPublicKey,
        encryptedMlKemPrivateKey: userKey.encryptedMlKemPrivateKey,
      },
      update: {
        scheme: userKey.scheme,
        publicKey: userKey.publicKey,
        encryptedPrivateKey: userKey.encryptedPrivateKey,
        mlKemPublicKey: userKey.mlKemPublicKey,
        encryptedMlKemPrivateKey: userKey.encryptedMlKemPrivateKey,
      },
    });
  }
}
