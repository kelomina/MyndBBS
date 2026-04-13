import { IModeratedWordRepository } from '../../domain/community/IModeratedWordRepository';
import { ModeratedWord, ModeratedWordProps } from '../../domain/community/ModeratedWord';
import { prisma } from '../../db';

export class PrismaModeratedWordRepository implements IModeratedWordRepository {
  private toDomain(raw: any): ModeratedWord {
    const props: ModeratedWordProps = {
      id: raw.id,
      word: raw.word,
      categoryId: raw.categoryId,
      createdAt: raw.createdAt,
    };
    return ModeratedWord.create(props);
  }

  public async findById(id: string): Promise<ModeratedWord | null> {
    const raw = await prisma.moderatedWord.findUnique({ where: { id } });
    if (!raw) return null;
    return this.toDomain(raw);
  }

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
