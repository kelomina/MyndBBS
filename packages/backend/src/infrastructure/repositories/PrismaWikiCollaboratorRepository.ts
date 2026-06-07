/**
 * 类名称：PrismaWikiCollaboratorRepository
 *
 * 函数作用：
 *   Prisma 实现的 Wiki Collaborator 仓储。
 * Purpose:
 *   Prisma-based Wiki Collaborator repository.
 *
 * 调用方 / Called by:
 *   - WikiApplicationService
 *   - registry.ts
 */
import { IWikiCollaboratorRepository } from '../../domain/wiki/IWikiCollaboratorRepository';
import { WikiCollaborator, WikiCollaboratorProps, CollaboratorRole } from '../../domain/wiki/WikiCollaborator';
import { prisma } from '../../db';

export class PrismaWikiCollaboratorRepository implements IWikiCollaboratorRepository {
  private toDomain(raw: any): WikiCollaborator {
    const props: WikiCollaboratorProps = {
      id: raw.id,
      wikiId: raw.wikiId,
      userId: raw.userId,
      role: raw.role as CollaboratorRole,
      addedAt: raw.addedAt,
    };
    return WikiCollaborator.load(props);
  }

  public async findByWiki(wikiId: string): Promise<WikiCollaborator[]> {
    const raws = await prisma.wikiCollaborator.findMany({ where: { wikiId } });
    return raws.map(raw => this.toDomain(raw));
  }

  public async findByUser(userId: string): Promise<WikiCollaborator[]> {
    const raws = await prisma.wikiCollaborator.findMany({ where: { userId } });
    return raws.map(raw => this.toDomain(raw));
  }

  public async findByWikiAndUser(wikiId: string, userId: string): Promise<WikiCollaborator | null> {
    const raw = await prisma.wikiCollaborator.findUnique({
      where: { wikiId_userId: { wikiId, userId } },
    });
    if (!raw) return null;
    return this.toDomain(raw);
  }

  public async save(collaborator: WikiCollaborator): Promise<void> {
    await prisma.wikiCollaborator.upsert({
      where: { wikiId_userId: { wikiId: collaborator.wikiId, userId: collaborator.userId } },
      create: {
        id: collaborator.id,
        wikiId: collaborator.wikiId,
        userId: collaborator.userId,
        role: collaborator.role as any,
        addedAt: collaborator.addedAt,
      },
      update: {
        role: collaborator.role as any,
      },
    });
  }

  public async delete(wikiId: string, userId: string): Promise<void> {
    await prisma.wikiCollaborator.delete({
      where: { wikiId_userId: { wikiId, userId } },
    });
  }
}
