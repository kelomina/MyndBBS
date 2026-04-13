import { IFriendshipRepository } from '../../domain/messaging/IFriendshipRepository';
import { Friendship, FriendshipProps } from '../../domain/messaging/Friendship';
import { prisma } from '../../db';

/**
 * Callers: [MessagingApplicationService.constructor]
 * Callees: [toDomain, findUnique, findFirst, upsert, delete]
 * Description: The Prisma-based implementation of the IFriendshipRepository.
 * Keywords: prisma, friendship, repository, implementation, infrastructure
 */
export class PrismaFriendshipRepository implements IFriendshipRepository {
  private toDomain(raw: any): Friendship {
    const props: FriendshipProps = {
      id: raw.id,
      requesterId: raw.requesterId,
      addresseeId: raw.addresseeId,
      status: raw.status,
      createdAt: raw.createdAt,
    };
    return Friendship.create(props);
  }

  public async findById(id: string): Promise<Friendship | null> {
    const raw = await prisma.friendship.findUnique({ where: { id } });
    if (!raw) return null;
    return this.toDomain(raw);
  }

  public async findByUsers(userId1: string, userId2: string): Promise<Friendship | null> {
    const raw = await prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: userId1, addresseeId: userId2 },
          { requesterId: userId2, addresseeId: userId1 }
        ]
      }
    });
    if (!raw) return null;
    return this.toDomain(raw);
  }

  public async save(friendship: Friendship): Promise<void> {
    await prisma.friendship.upsert({
      where: { id: friendship.id },
      create: {
        id: friendship.id,
        requesterId: friendship.requesterId,
        addresseeId: friendship.addresseeId,
        status: friendship.status,
        createdAt: friendship.createdAt,
      },
      update: {
        status: friendship.status,
      },
    });
  }

  public async delete(id: string): Promise<void> {
    await prisma.friendship.delete({ where: { id } });
  }
}
