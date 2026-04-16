import { ICommentRepository } from '../../domain/community/ICommentRepository';
import { Comment, CommentProps } from '../../domain/community/Comment';
import { prisma } from '../../db';

export class PrismaCommentRepository implements ICommentRepository {
  private toDomain(raw: any): Comment {
    const props: CommentProps = {
      id: raw.id,
      content: raw.content,
      postId: raw.postId,
      authorId: raw.authorId,
      parentId: raw.parentId,
      isPending: raw.isPending,
      deletedAt: raw.deletedAt,
      createdAt: raw.createdAt,
    };
    return Comment.load(props);
  }

  public async findById(id: string): Promise<Comment | null> {
    const raw = await prisma.comment.findUnique({ where: { id } });
    if (!raw) return null;
    return this.toDomain(raw);
  }

  public async save(comment: Comment): Promise<void> {
    await prisma.comment.upsert({
      where: { id: comment.id },
      create: {
        id: comment.id,
        content: comment.content,
        postId: comment.postId,
        authorId: comment.authorId,
        parentId: comment.parentId,
        isPending: comment.isPending,
        deletedAt: comment.deletedAt,
        createdAt: comment.createdAt,
      },
      update: {
        content: comment.content,
        isPending: comment.isPending,
        deletedAt: comment.deletedAt,
      },
    });
  }

  public async delete(id: string): Promise<void> {
    await prisma.comment.delete({ where: { id } });
  }

  public async softDeleteManyByPostId(postId: string): Promise<void> {
    await prisma.comment.updateMany({
      where: { postId },
      data: { deletedAt: new Date() }
    });
  }
}
