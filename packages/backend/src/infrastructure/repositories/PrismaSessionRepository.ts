import { ISessionRepository } from '../../domain/identity/ISessionRepository';
import { Session, SessionProps } from '../../domain/identity/Session';
import { prisma } from '../../db';

export class PrismaSessionRepository implements ISessionRepository {
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

  public async findById(id: string): Promise<Session | null> {
    const raw = await prisma.session.findUnique({ where: { id } });
    if (!raw) return null;
    return this.toDomain(raw);
  }

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
}
