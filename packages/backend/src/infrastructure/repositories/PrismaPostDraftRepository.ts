/**
 * 仓储实现：PrismaPostDraftRepository
 */
import { IPostDraftRepository, PostDraftData } from '../../domain/community/IPostDraftRepository';
import { prisma } from '../../db';

export class PrismaPostDraftRepository implements IPostDraftRepository {
  public async get(userId: string): Promise<PostDraftData | null> {
    const row = await prisma.postDraft.findUnique({ where: { userId } });
    if (!row) return null;
    return {
      title: row.title,
      content: row.content,
      categoryId: row.categoryId,
      updatedAt: row.updatedAt,
    };
  }

  public async upsert(
    userId: string,
    data: { title: string; content: string; categoryId?: string | null }
  ): Promise<void> {
    await prisma.postDraft.upsert({
      where: { userId },
      create: {
        userId,
        title: data.title,
        content: data.content,
        categoryId: data.categoryId ?? null,
      },
      update: {
        title: data.title,
        content: data.content,
        categoryId: data.categoryId ?? null,
      },
    });
  }

  public async clear(userId: string): Promise<boolean> {
    const result = await prisma.postDraft.deleteMany({ where: { userId } });
    return result.count > 0;
  }
}
