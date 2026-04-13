import { IAuthChallengeRepository } from '../../domain/identity/IAuthChallengeRepository';
import { AuthChallenge, AuthChallengeProps } from '../../domain/identity/AuthChallenge';
import { prisma } from '../../db';

export class PrismaAuthChallengeRepository implements IAuthChallengeRepository {
  private toDomain(raw: any): AuthChallenge {
    const props: AuthChallengeProps = {
      id: raw.id,
      challenge: raw.challenge,
      expiresAt: raw.expiresAt,
    };
    return AuthChallenge.load(props);
  }

  public async findById(id: string): Promise<AuthChallenge | null> {
    const raw = await prisma.authChallenge.findUnique({ where: { id } });
    if (!raw) return null;
    return this.toDomain(raw);
  }

  public async save(challenge: AuthChallenge): Promise<void> {
    await prisma.authChallenge.upsert({
      where: { id: challenge.id },
      create: {
        id: challenge.id,
        challenge: challenge.challenge,
        expiresAt: challenge.expiresAt,
      },
      update: {
        challenge: challenge.challenge,
        expiresAt: challenge.expiresAt,
      },
    });
  }

  public async delete(id: string): Promise<void> {
    await prisma.authChallenge.delete({ where: { id } });
  }
}
