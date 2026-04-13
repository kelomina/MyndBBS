import { ICaptchaChallengeRepository } from '../../domain/identity/ICaptchaChallengeRepository';
import { CaptchaChallenge, CaptchaChallengeProps } from '../../domain/identity/CaptchaChallenge';
import { prisma } from '../../db';

/**
 * Callers: [AuthApplicationService.constructor]
 * Callees: [toDomain, findUnique, upsert, delete]
 * Description: The Prisma-based implementation of the ICaptchaChallengeRepository, mapping between raw Prisma CaptchaChallenge rows and the Domain Entity.
 * Keywords: prisma, captcha, repository, implementation, infrastructure
 */
export class PrismaCaptchaChallengeRepository implements ICaptchaChallengeRepository {
  /**
   * Callers: [findById]
   * Callees: [CaptchaChallenge.create]
   * Description: Maps a raw Prisma captcha challenge row to the CaptchaChallenge Domain Entity.
   * Keywords: mapper, domain, prisma, convert, captcha
   */
  private toDomain(raw: any): CaptchaChallenge {
    const props: CaptchaChallengeProps = {
      id: raw.id,
      targetPosition: raw.targetPosition,
      verified: raw.verified,
      expiresAt: raw.expiresAt,
    };
    return CaptchaChallenge.create(props);
  }

  /**
   * Callers: [AuthApplicationService]
   * Callees: [prisma.captchaChallenge.findUnique, toDomain]
   * Description: Retrieves a CaptchaChallenge from the Prisma database using its ID.
   * Keywords: find, id, prisma, repository, captcha
   */
  public async findById(id: string): Promise<CaptchaChallenge | null> {
    const raw = await prisma.captchaChallenge.findUnique({ where: { id } });
    if (!raw) return null;
    return this.toDomain(raw);
  }

  /**
   * Callers: [AuthApplicationService]
   * Callees: [prisma.captchaChallenge.upsert]
   * Description: Persists the state of a CaptchaChallenge. Creates it if it doesn't exist, updates it if it does.
   * Keywords: save, upsert, update, create, prisma, repository, captcha
   */
  public async save(challenge: CaptchaChallenge): Promise<void> {
    await prisma.captchaChallenge.upsert({
      where: { id: challenge.id },
      create: {
        id: challenge.id,
        targetPosition: challenge.targetPosition,
        verified: challenge.verified,
        expiresAt: challenge.expiresAt,
      },
      update: {
        verified: challenge.verified,
      },
    });
  }

  /**
   * Callers: [AuthApplicationService]
   * Callees: [prisma.captchaChallenge.delete]
   * Description: Permanently removes a CaptchaChallenge from the Prisma database.
   * Keywords: delete, remove, physical, prisma, repository, captcha
   */
  public async delete(id: string): Promise<void> {
    await prisma.captchaChallenge.delete({ where: { id } });
  }
}
