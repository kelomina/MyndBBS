/**
 * 类名称：PrismaWikiPageRepository
 *
 * 函数作用：
 *   Prisma 实现的 Wiki Page 仓储，在 Prisma 行记录和领域 WikiPage 实体之间做映射。
 * Purpose:
 *   Prisma-based Wiki Page repository, mapping between Prisma rows and the WikiPage domain entity.
 *
 * 调用方 / Called by:
 *   - WikiPageApplicationService
 *   - registry.ts
 */
import { IWikiPageRepository } from '../../domain/wiki/IWikiPageRepository';
import { WikiPage, WikiPageProps, PageStatus } from '../../domain/wiki/WikiPage';
import { prisma } from '../../db';

export class PrismaWikiPageRepository implements IWikiPageRepository {
  private toDomain(raw: any): WikiPage {
    const props: WikiPageProps = {
      id: raw.id,
      wikiId: raw.wikiId,
      slug: raw.slug,
      title: raw.title,
      content: raw.content,
      parentId: raw.parentId,
      authorId: raw.authorId,
      lastEditorId: raw.lastEditorId,
      sortOrder: raw.sortOrder,
      status: raw.status as PageStatus,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    };
    return WikiPage.load(props);
  }

  public async findById(id: string): Promise<WikiPage | null> {
    const raw = await prisma.wikiPage.findUnique({ where: { id } });
    if (!raw) return null;
    return this.toDomain(raw);
  }

  public async findByWiki(wikiId: string): Promise<WikiPage[]> {
    const raws = await prisma.wikiPage.findMany({
      where: { wikiId, NOT: { status: PageStatus.DELETED } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return raws.map(raw => this.toDomain(raw));
  }

  public async findBySlug(wikiId: string, slug: string): Promise<WikiPage | null> {
    const raw = await prisma.wikiPage.findUnique({ where: { wikiId_slug: { wikiId, slug } } });
    if (!raw) return null;
    return this.toDomain(raw);
  }

  public async save(page: WikiPage): Promise<void> {
    await prisma.wikiPage.upsert({
      where: { id: page.id },
      create: {
        id: page.id,
        wikiId: page.wikiId,
        slug: page.slug,
        title: page.title,
        content: page.content,
        parentId: page.parentId,
        authorId: page.authorId,
        lastEditorId: page.lastEditorId,
        sortOrder: page.sortOrder,
        status: page.status as any,
        createdAt: page.createdAt,
        updatedAt: page.updatedAt,
      },
      update: {
        slug: page.slug,
        title: page.title,
        content: page.content,
        parentId: page.parentId,
        lastEditorId: page.lastEditorId,
        sortOrder: page.sortOrder,
        status: page.status as any,
        updatedAt: page.updatedAt,
      },
    });
  }

  public async delete(id: string): Promise<void> {
    await prisma.wikiPage.delete({ where: { id } });
  }
}
