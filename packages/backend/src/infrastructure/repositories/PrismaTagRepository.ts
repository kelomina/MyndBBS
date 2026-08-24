/**
 * 仓储实现：PrismaTagRepository / PrismaPostTagRepository
 */
import { ITagRepository, IPostTagRepository, TagWithCount } from '../../domain/community/ITagRepository';
import { prisma } from '../../db';

export class PrismaTagRepository implements ITagRepository {
  public async findByName(name: string): Promise<{ id: string; name: string } | null> {
    const tag = await prisma.tag.findUnique({ where: { name }, select: { id: true, name: true } });
    return tag ?? null;
  }

  public async ensure(name: string): Promise<{ id: string; name: string }> {
    return prisma.tag.upsert({
      where: { name },
      create: { name },
      update: {},
      select: { id: true, name: true },
    });
  }

  public async listWithCounts(limit = 200): Promise<TagWithCount[]> {
    const tags = await prisma.tag.findMany({
      select: { name: true, _count: { select: { posts: true } } },
      orderBy: { posts: { _count: 'desc' } },
      take: limit,
    });
    return tags
      .map((t) => ({ name: t.name, postCount: t._count.posts }))
      .filter((t) => t.postCount > 0);
  }
}

export class PrismaPostTagRepository implements IPostTagRepository {
  public async getTagNamesForPost(postId: string): Promise<string[]> {
    const rows = await prisma.postTag.findMany({
      where: { postId },
      orderBy: { tagId: 'asc' },
      select: { tag: { select: { name: true } } },
    });
    return rows.map((r) => r.tag.name);
  }

  public async setTagsForPost(postId: string, tagIds: string[]): Promise<void> {
    await prisma.postTag.deleteMany({ where: { postId } });
    if (tagIds.length > 0) {
      await prisma.postTag.createMany({
        data: tagIds.map((tagId) => ({ postId, tagId })),
      });
    }
  }
}
