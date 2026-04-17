import { IPasskeyRepository } from '../../domain/identity/IPasskeyRepository';
import { Passkey, PasskeyProps } from '../../domain/identity/Passkey';
import { prisma } from '../../db';

/**
 * Callers: [AuthApplicationService.constructor]
 * Callees: [toDomain, findUnique, findMany, findFirst, upsert, delete]
 * Description: The Prisma-based implementation of the IPasskeyRepository, mapping between raw Prisma Passkey rows and the Passkey Domain Entity.
 * Keywords: prisma, passkey, webauthn, repository, implementation, infrastructure
 */
export class PrismaPasskeyRepository implements IPasskeyRepository {
  /**
   * Callers: [findById, findByUserId]
   * Callees: [Passkey.create]
   * Description: Maps a raw Prisma passkey row to the Passkey Domain Entity.
   * Keywords: mapper, domain, prisma, convert, passkey
   */
  private toDomain(raw: any): Passkey {
    const props: PasskeyProps = {
      id: raw.id,
      publicKey: Buffer.from(raw.publicKey),
      userId: raw.userId,
      webAuthnUserID: raw.webAuthnUserID,
      counter: BigInt(raw.counter),
      deviceType: raw.deviceType,
      backedUp: raw.backedUp,
      createdAt: raw.createdAt,
    };
    return Passkey.create(props);
  }

  /**
   * Callers: [AuthApplicationService]
   * Callees: [prisma.passkey.findUnique, toDomain]
   * Description: Retrieves a Passkey from the Prisma database using its ID (credential ID).
   * Keywords: find, id, prisma, repository, passkey
   */
  public async findById(id: string): Promise<Passkey | null> {
    const raw = await prisma.passkey.findUnique({ where: { id } });
    if (!raw) return null;
    return this.toDomain(raw);
  }

  /**
   * Callers: [AuthApplicationService]
   * Callees: [prisma.passkey.findMany, toDomain]
   * Description: Retrieves all Passkeys associated with a User ID.
   * Keywords: find, user, id, prisma, repository, passkeys
   */
  public async findByUserId(userId: string): Promise<Passkey[]> {
    const raws = await prisma.passkey.findMany({ where: { userId } });
    return raws.map(raw => this.toDomain(raw));
  }

  /**
   * Callers: [AuthApplicationService]
   * Callees: [prisma.passkey.upsert]
   * Description: Persists the state of a Passkey. Creates it if it doesn't exist, updates it if it does.
   * Keywords: save, upsert, update, create, prisma, repository, passkey
   */
  public async save(passkey: Passkey): Promise<void> {
    await prisma.passkey.upsert({
      where: { id: passkey.id },
      create: {
        id: passkey.id,
        publicKey: new Uint8Array(passkey.publicKey),
        userId: passkey.userId,
        webAuthnUserID: passkey.webAuthnUserID,
        counter: passkey.counter,
        deviceType: passkey.deviceType,
        backedUp: passkey.backedUp,
        createdAt: passkey.createdAt,
      },
      update: {
        counter: passkey.counter,
      },
    });
  }

  /**
   * Callers: [AuthApplicationService]
   * Callees: [prisma.passkey.delete]
   * Description: Permanently removes a Passkey from the Prisma database.
   * Keywords: delete, remove, physical, prisma, repository, passkey
   */
  public async delete(id: string): Promise<void> {
    await prisma.passkey.delete({ where: { id } });
  }
}
