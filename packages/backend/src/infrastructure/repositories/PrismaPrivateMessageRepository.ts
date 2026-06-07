import { IPrivateMessageRepository } from '../../domain/messaging/IPrivateMessageRepository';
import { PrivateMessage, PrivateMessageProps } from '../../domain/messaging/PrivateMessage';
import { prisma } from '../../db';

/**
 * Callers: [MessagingApplicationService.constructor]
 * Callees: [toDomain, findUnique, findMany, upsert, updateMany]
 * Description: The Prisma-based implementation of the IPrivateMessageRepository.
 * Keywords: prisma, privatemessage, repository, implementation, infrastructure
 */
export class PrismaPrivateMessageRepository implements IPrivateMessageRepository {
  private toDomain(raw: any): PrivateMessage {
    const props: PrivateMessageProps = {
      id: raw.id,
      senderId: raw.senderId,
      receiverId: raw.receiverId,
      ephemeralPublicKey: raw.ephemeralPublicKey,
      ephemeralMlKemCiphertext: raw.ephemeralMlKemCiphertext,
      encryptedContent: raw.encryptedContent,
      senderEncryptedContent: raw.senderEncryptedContent,
      isRead: raw.isRead,
      isSystem: raw.isSystem,
      expiresAt: raw.expiresAt,
      expiresInMs: raw.expiresInMs,
      expiresStartedAt: raw.expiresStartedAt,
      autoDeleteForSenderAfterRead: raw.autoDeleteForSenderAfterRead,
      deletedBy: raw.deletedBy,
      createdAt: raw.createdAt,
    };
    return PrivateMessage.load(props);
  }

  public async findById(id: string): Promise<PrivateMessage | null> {
    const raw = await prisma.privateMessage.findUnique({ where: { id } });
    if (!raw) return null;
    return this.toDomain(raw);
  }

  public async findByIds(ids: string[]): Promise<PrivateMessage[]> {
    const raws = await prisma.privateMessage.findMany({ where: { id: { in: ids } } });
    return raws.map(raw => this.toDomain(raw));
  }

  public async findConversation(userId1: string, userId2: string): Promise<PrivateMessage[]> {
    const raws = await prisma.privateMessage.findMany({
      where: {
        OR: [
          { senderId: userId1, receiverId: userId2 },
          { senderId: userId2, receiverId: userId1 }
        ]
      }
    });
    return raws.map(raw => this.toDomain(raw));
  }

  public async countMessagesBetween(senderId: string, receiverId: string): Promise<number> {
    return prisma.privateMessage.count({
      where: { senderId, receiverId }
    });
  }

  public async save(message: PrivateMessage): Promise<void> {
    await prisma.privateMessage.upsert({
      where: { id: message.id },
      create: {
        id: message.id,
        senderId: message.senderId,
        receiverId: message.receiverId,
        ephemeralPublicKey: message.ephemeralPublicKey,
        ephemeralMlKemCiphertext: message.ephemeralMlKemCiphertext,
        encryptedContent: message.encryptedContent,
        senderEncryptedContent: message.senderEncryptedContent,
        isRead: message.isRead,
        isSystem: message.isSystem,
        expiresAt: message.expiresAt,
        expiresInMs: message.expiresInMs,
        expiresStartedAt: message.expiresStartedAt,
        autoDeleteForSenderAfterRead: message.autoDeleteForSenderAfterRead,
        deletedBy: message.deletedBy,
        createdAt: message.createdAt,
      },
      update: {
        isRead: message.isRead,
        expiresAt: message.expiresAt,
        expiresInMs: message.expiresInMs,
        expiresStartedAt: message.expiresStartedAt,
        autoDeleteForSenderAfterRead: message.autoDeleteForSenderAfterRead,
        deletedBy: message.deletedBy,
      },
    });
  }

  public async saveDirect(data: {
    id: string;
    isRead?: boolean;
    deletedBy?: string[];
    expiresAt?: Date | null;
    expiresInMs?: number | null;
    expiresStartedAt?: Date | null;
    autoDeleteForSenderAfterRead?: boolean;
  }): Promise<void> {
    await prisma.privateMessage.update({
      where: { id: data.id },
      data: {
        ...(data.isRead !== undefined ? { isRead: data.isRead } : {}),
        ...(data.deletedBy !== undefined ? { deletedBy: data.deletedBy } : {}),
        ...(data.expiresAt !== undefined ? { expiresAt: data.expiresAt } : {}),
        ...(data.expiresInMs !== undefined ? { expiresInMs: data.expiresInMs } : {}),
        ...(data.expiresStartedAt !== undefined ? { expiresStartedAt: data.expiresStartedAt } : {}),
        ...(data.autoDeleteForSenderAfterRead !== undefined
          ? { autoDeleteForSenderAfterRead: data.autoDeleteForSenderAfterRead }
          : {}),
      },
    });
  }

  public async saveMany(messages: PrivateMessage[]): Promise<void> {
    await prisma.$transaction(
      messages.map(m =>
        prisma.privateMessage.upsert({
          where: { id: m.id },
          create: {
            id: m.id,
            senderId: m.senderId,
            receiverId: m.receiverId,
            ephemeralPublicKey: m.ephemeralPublicKey,
            ephemeralMlKemCiphertext: m.ephemeralMlKemCiphertext,
            encryptedContent: m.encryptedContent,
            senderEncryptedContent: m.senderEncryptedContent,
            isRead: m.isRead,
            isSystem: m.isSystem,
            expiresAt: m.expiresAt,
            expiresInMs: m.expiresInMs,
            expiresStartedAt: m.expiresStartedAt,
            autoDeleteForSenderAfterRead: m.autoDeleteForSenderAfterRead,
            deletedBy: m.deletedBy,
            createdAt: m.createdAt,
          },
          update: {
            isRead: m.isRead,
            expiresAt: m.expiresAt,
            expiresInMs: m.expiresInMs,
            expiresStartedAt: m.expiresStartedAt,
            autoDeleteForSenderAfterRead: m.autoDeleteForSenderAfterRead,
            deletedBy: m.deletedBy,
          },
        })
      )
    );
  }

  public async delete(id: string): Promise<void> {
    await prisma.privateMessage.delete({ where: { id } });
  }

  public async findExpiredForCleanup(): Promise<Array<{ id: string; receiverId: string; deletedBy: string[] }>> {
    const raws = await prisma.privateMessage.findMany({
      where: {
        expiresAt: { not: null, lt: new Date() },
      },
      select: { id: true, receiverId: true, deletedBy: true },
    });
    return raws.map(r => ({
      id: r.id,
      receiverId: r.receiverId,
      deletedBy: r.deletedBy as string[],
    }));
  }
}
