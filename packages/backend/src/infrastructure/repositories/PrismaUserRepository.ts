import { IUserRepository } from '../../domain/identity/IUserRepository';
import { User, UserProps } from '../../domain/identity/User';
import { prisma } from '../../db';

/**
 * Callers: [UserApplicationService.constructor]
 * Callees: [toDomain, findUnique, upsert]
 * Description: The Prisma-based implementation of the IUserRepository, mapping between raw Prisma rows and the User Domain Aggregate Root.
 * Keywords: prisma, user, repository, implementation, infrastructure
 */
export class PrismaUserRepository implements IUserRepository {
  /**
   * Callers: [findById, findByEmail, findByUsername]
   * Callees: [User.create]
   * Description: Maps a raw Prisma user row to the User Domain Aggregate Root.
   * Keywords: mapper, domain, prisma, convert, user
   */
  private toDomain(raw: any): User {
    const props: UserProps = {
      id: raw.id,
      email: raw.email,
      username: raw.username,
      password: raw.password,
      roleId: raw.roleId,
      status: raw.status,
      level: raw.level,
      isPasskeyMandatory: raw.isPasskeyMandatory,
      totpSecret: raw.totpSecret,
      isTotpEnabled: raw.isTotpEnabled,
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
        totpSecret: user.totpSecret,
        isTotpEnabled: user.isTotpEnabled,
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
        totpSecret: user.totpSecret,
        isTotpEnabled: user.isTotpEnabled,
      },
    });
  }
}
