import { IUserRepository } from '../../domain/identity/IUserRepository';
import { User, UserProps } from '../../domain/identity/User';
import { prisma } from '../../db';
import { TotpEncryptionService } from '../services/identity/TotpEncryptionService';

/**
 * Callers: [UserApplicationService.constructor]
 * Callees: [toDomain, findUnique, upsert]
 * Description: The Prisma-based implementation of the IUserRepository, mapping between raw Prisma rows and the User Domain Aggregate Root.
 * Keywords: prisma, user, repository, implementation, infrastructure
 */
export class PrismaUserRepository implements IUserRepository {
  constructor(private totpEncryptionService?: TotpEncryptionService) {}

  /**
   * Callers: [findById, findByEmail, findByUsername]
   * Callees: [User.create]
   * Description: Maps a raw Prisma user row to the User Domain Aggregate Root, decrypting totpSecret if encrypted.
   * Keywords: mapper, domain, prisma, convert, user
   */
  private toDomain(raw: any): User {
    const decryptedTotp = this.totpEncryptionService
      ? this.totpEncryptionService.decrypt(raw.totpSecret)
      : raw.totpSecret;

    const props: UserProps = {
      id: raw.id,
      email: raw.email,
      username: raw.username,
      password: raw.password,
      roleId: raw.roleId,
      status: raw.status,
      level: raw.level,
      isPasskeyMandatory: raw.isPasskeyMandatory,
      totpSecret: decryptedTotp,
      isTotpEnabled: raw.isTotpEnabled,
      cookiePreferences: raw.cookiePreferences,
      createdAt: raw.createdAt,
    };
    return User.create(props);
  }

  public async findById(id: string): Promise<User | null> {
    const raw = await prisma.user.findUnique({ where: { id } });
    if (!raw) return null;
    return this.toDomain(raw);
  }

  public async findByEmail(email: string): Promise<User | null> {
    const raw = await prisma.user.findUnique({ where: { email } });
    if (!raw) return null;
    return this.toDomain(raw);
  }

  public async findByUsername(username: string): Promise<User | null> {
    const raw = await prisma.user.findUnique({ where: { username } });
    if (!raw) return null;
    return this.toDomain(raw);
  }

  public async findByRoleId(roleId: string): Promise<User[]> {
    const rawUsers = await prisma.user.findMany({ where: { roleId } });
    return rawUsers.map(raw => this.toDomain(raw));
  }

  public async save(user: User): Promise<void> {
    const encryptedTotp = this.totpEncryptionService && user.totpSecret
      ? this.totpEncryptionService.encrypt(user.totpSecret)
      : user.totpSecret;

    await prisma.user.upsert({
      where: { id: user.id },
      create: {
        id: user.id,
        email: user.email,
        username: user.username,
        password: user.password,
        roleId: user.roleId,
        status: user.status as any,
        level: user.level,
        isPasskeyMandatory: user.isPasskeyMandatory,
        totpSecret: encryptedTotp,
        isTotpEnabled: user.isTotpEnabled,
        cookiePreferences: user.cookiePreferences ? (user.cookiePreferences as any) : null,
        createdAt: user.createdAt,
      },
      update: {
        email: user.email,
        username: user.username,
        password: user.password,
        roleId: user.roleId,
        status: user.status as any,
        level: user.level,
        isPasskeyMandatory: user.isPasskeyMandatory,
        totpSecret: encryptedTotp,
        isTotpEnabled: user.isTotpEnabled,
        cookiePreferences: user.cookiePreferences ? (user.cookiePreferences as any) : null,
      },
    });
  }
}
