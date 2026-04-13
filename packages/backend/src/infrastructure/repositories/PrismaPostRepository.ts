import { IPostRepository } from '../../domain/community/IPostRepository';
import { Post, PostProps } from '../../domain/community/Post';
import { prisma } from '../../db';

export class PrismaPostRepository implements IPostRepository {
  private toDomain(raw: any): Post {
    const props: PostProps = {
      id: raw.id,
      title: raw.title,
      content: raw.content,
      categoryId: raw.categoryId,
      authorId: raw.authorId,
      status: raw.status,
      createdAt: raw.createdAt,
    };
    return Post.create(props);
  }

  public async findById(id: string): Promise<Post | null> {
    const raw = await prisma.post.findUnique({ where: { id } });
    if (!raw) return null;
    return this.toDomain(raw);
  }

  public async save(post: Post): Promise<void> {
    await prisma.post.upsert({
      where: { id: post.id },
      create: {
        id: post.id,
        title: post.title,
        content: post.content,
        categoryId: post.categoryId,
        authorId: post.authorId,
        status: post.status as any, // Cast domain status to Prisma status
        createdAt: post.createdAt,
      },
      update: {
        title: post.title,
        content: post.content,
        categoryId: post.categoryId,
        status: post.status as any, // Cast domain status to Prisma status
      },
    });
  }

  public async delete(id: string): Promise<void> {
    await prisma.post.delete({ where: { id } });
  }

  public async deleteManyByCategoryId(categoryId: string): Promise<void> {
    await prisma.post.deleteMany({ where: { categoryId } });
  }
}
