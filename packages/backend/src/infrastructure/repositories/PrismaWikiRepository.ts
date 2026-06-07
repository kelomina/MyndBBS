/**
 * 类名称：PrismaWikiRepository
 *
 * 函数作用：
 *   Prisma 实现的 Wiki 仓储，在 Prisma 行记录和领域 Wiki 聚合根之间做映射。
 * Purpose:
 *   Prisma-based Wiki repository, mapping between Prisma rows and the Wiki domain aggregate root.
 *
 * 调用方 / Called by:
 *   - WikiApplicationService
 *   - registry.ts
 *
 * 中文关键词：
 *   Prisma，Wiki，仓储实现
 * English keywords:
 *   Prisma, wiki, repository implementation
 */
import { IWikiRepository } from '../../domain/wiki/IWikiRepository';
import { Wiki, WikiProps, WikiStatus } from '../../domain/wiki/Wiki';
import { prisma } from '../../db';

export class PrismaWikiRepository implements IWikiRepository {
  /**
   * 函数名称：toDomain
   *
   * 函数作用：
   *   将 Prisma 原始行记录映射为领域 Wiki 聚合根。
   * Purpose:
   *   Maps a raw Prisma row to the Wiki domain aggregate root.
   *
   * 参数说明 / Parameters:
   *   - raw: any, Prisma 查询返回的原始 Wiki 数据
   *
   * 返回值说明 / Returns:
   *   Wiki 领域实体
   */
  private toDomain(raw: any): Wiki {
    const props: WikiProps = {
      id: raw.id,
      title: raw.title,
      description: raw.description,
      coverUrl: raw.coverUrl,
      ownerId: raw.ownerId,
      minReadLevel: raw.minReadLevel,
      minEditLevel: raw.minEditLevel,
      isPublic: raw.isPublic,
      status: raw.status as WikiStatus,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    };
    return Wiki.load(props);
  }

  public async findById(id: string): Promise<Wiki | null> {
    const raw = await prisma.wiki.findUnique({ where: { id } });
    if (!raw) return null;
    return this.toDomain(raw);
  }

  public async findByOwner(ownerId: string): Promise<Wiki[]> {
    const raws = await prisma.wiki.findMany({ where: { ownerId, status: WikiStatus.ACTIVE } });
    return raws.map(raw => this.toDomain(raw));
  }

  public async findAll(): Promise<Wiki[]> {
    const raws = await prisma.wiki.findMany({ where: { status: WikiStatus.ACTIVE } });
    return raws.map(raw => this.toDomain(raw));
  }

  public async save(wiki: Wiki): Promise<void> {
    await prisma.wiki.upsert({
      where: { id: wiki.id },
      create: {
        id: wiki.id,
        title: wiki.title,
        description: wiki.description,
        coverUrl: wiki.coverUrl,
        ownerId: wiki.ownerId,
        minReadLevel: wiki.minReadLevel,
        minEditLevel: wiki.minEditLevel,
        isPublic: wiki.isPublic,
        status: wiki.status as any,
        createdAt: wiki.createdAt,
        updatedAt: wiki.updatedAt,
      },
      update: {
        title: wiki.title,
        description: wiki.description,
        coverUrl: wiki.coverUrl,
        minReadLevel: wiki.minReadLevel,
        minEditLevel: wiki.minEditLevel,
        isPublic: wiki.isPublic,
        status: wiki.status as any,
        updatedAt: wiki.updatedAt,
      },
    });
  }

  public async delete(id: string): Promise<void> {
    await prisma.wiki.delete({ where: { id } });
  }
}
