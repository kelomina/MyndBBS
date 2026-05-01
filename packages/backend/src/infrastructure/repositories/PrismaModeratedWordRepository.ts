/**
 * 类名称：PrismaModeratedWordRepository
 *
 * 函数作用：
 *   Prisma 实现的敏感词仓储。
 * Purpose:
 *   Prisma-based ModeratedWord repository.
 *
 * 中文关键词：
 *   Prisma，敏感词，仓储实现
 * English keywords:
 *   Prisma, moderated word, repository implementation
 */
import { IModeratedWordRepository } from '../../domain/community/IModeratedWordRepository';
import { ModeratedWord, ModeratedWordProps } from '../../domain/community/ModeratedWord';
import { prisma } from '../../db';

export class PrismaModeratedWordRepository implements IModeratedWordRepository {
  /**
   * 函数名称：toDomain
   *
   * 函数作用：
   *   将 Prisma 原始行记录映射为领域 ModeratedWord 聚合根。
   * Purpose:
   *   Maps a raw Prisma row to the ModeratedWord domain aggregate root.
   */
  private toDomain(raw: any): ModeratedWord {
    const props: ModeratedWordProps = {
      id: raw.id,
      word: raw.word,
      categoryId: raw.categoryId,
      createdAt: raw.createdAt,
    };
    return ModeratedWord.create(props);
  }

  /**
   * 函数名称：findById
   *
   * 函数作用：
   *   按 ID 查找敏感词。
   * Purpose:
   *   Finds a moderated word by ID.
   */
  public async findById(id: string): Promise<ModeratedWord | null> {
    const raw = await prisma.moderatedWord.findUnique({ where: { id } });
    if (!raw) return null;
    return this.toDomain(raw);
  }

  /**
   * 函数名称：findAll
   *
   * 函数作用：
   *   获取全部敏感词列表。
   * Purpose:
   *   Retrieves all moderated words.
   */
  public async findAll(): Promise<ModeratedWord[]> {
    const raw = await prisma.moderatedWord.findMany();
    return raw.map((r: any) => this.toDomain(r));
  }

  /**
   * 函数名称：save
   *
   * 函数作用：
   *   创建或更新敏感词（upsert）。
   * Purpose:
   *   Creates or updates a moderated word (upsert).
   */
  public async save(word: ModeratedWord): Promise<void> {
    await prisma.moderatedWord.upsert({
      where: { id: word.id },
      create: {
        id: word.id,
        word: word.word,
        categoryId: word.categoryId,
        createdAt: word.createdAt,
      },
      update: {
        word: word.word,
        categoryId: word.categoryId,
      },
    });
  }

  public async delete(id: string): Promise<void> {
    await prisma.moderatedWord.delete({ where: { id } });
  }
}
