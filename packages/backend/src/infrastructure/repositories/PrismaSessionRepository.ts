/**
 * 类名称：PrismaSessionRepository
 *
 * 函数作用：
 *   Prisma 实现的会话仓储，映射 Prisma 行记录到领域 Session 聚合根。
 * Purpose:
 *   Prisma-based Session repository, mapping Prisma rows to the Session domain aggregate root.
 *
 * 中文关键词：
 *   Prisma，会话，仓储实现
 * English keywords:
 *   Prisma, session, repository implementation
 */
import { ISessionRepository } from '../../domain/identity/ISessionRepository';
import { Session, SessionProps } from '../../domain/identity/Session';
import { prisma } from '../../db';

export class PrismaSessionRepository implements ISessionRepository {
  /**
   * 函数名称：toDomain
   *
   * 函数作用：
   *   将 Prisma 原始行记录映射为领域 Session 聚合根。
   * Purpose:
   *   Maps a raw Prisma row to the Session domain aggregate root.
   */
  private toDomain(raw: any): Session {
    const props: SessionProps = {
      id: raw.id,
      userId: raw.userId,
      ipAddress: raw.ipAddress,
      userAgent: raw.userAgent,
      expiresAt: raw.expiresAt,
      createdAt: raw.createdAt,
    };
    // Since we fetch from DB, we shouldn't fail if it's already expired during mapping
    return Session.load(props);
  }

  /**
   * 函数名称：findById
   *
   * 函数作用：
   *   按 ID 查找会话。
   * Purpose:
   *   Finds a session by ID.
   */
  public async findById(id: string): Promise<Session | null> {
    const raw = await prisma.session.findUnique({ where: { id } });
    if (!raw) return null;
    return this.toDomain(raw);
  }

  /**
   * 函数名称：save
   *
   * 函数作用：
   *   创建或更新会话（upsert）。
   * Purpose:
   *   Creates or updates a session (upsert).
   */
  public async save(session: Session): Promise<void> {
    await prisma.session.upsert({
      where: { id: session.id },
      create: {
        id: session.id,
        userId: session.userId,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        expiresAt: session.expiresAt,
        createdAt: session.createdAt,
      },
      update: {
        expiresAt: session.expiresAt,
      },
    });
  }

  public async delete(id: string): Promise<void> {
    await prisma.session.delete({ where: { id } });
  }

  public async deleteManyByUserId(userId: string): Promise<void> {
    await prisma.session.deleteMany({ where: { userId } });
  }

  public async findByUserId(userId: string): Promise<Session[]> {
    const rows = await prisma.session.findMany({ where: { userId } });
    return rows.map(r => this.toDomain(r));
  }
}
