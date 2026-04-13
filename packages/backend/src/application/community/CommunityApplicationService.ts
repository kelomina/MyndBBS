import { ICategoryRepository } from '../../domain/community/ICategoryRepository';
import { IEngagementRepository } from '../../domain/community/IEngagementRepository';
import { Category } from '../../domain/community/Category';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../../db'; // Legacy Active Record fallback for Post/Comment models not yet extracted
import { containsModeratedWord } from '../../lib/moderation';
import { PostStatus } from '@prisma/client';

/**
 * Callers: [AdminController, PostController]
 * Callees: [ICategoryRepository, IEngagementRepository, prisma.post, prisma.comment, containsModeratedWord]
 * Description: The Application Service for the Community Domain. Orchestrates category management, post creation, and user engagements.
 * Keywords: community, service, application, orchestration, category, post, comment, engagement
 */
export class CommunityApplicationService {
  /**
   * Callers: [AdminController, PostController]
   * Callees: []
   * Description: Initializes the service with repository implementations via Dependency Injection.
   * Keywords: constructor, inject, repository, service, community
   */
  constructor(
    private categoryRepository: ICategoryRepository,
    private engagementRepository: IEngagementRepository
  ) {}

  // --- Category Management ---

  public async createCategory(name: string, description: string | null, sortOrder: number, minLevel: number): Promise<Category> {
    const category = Category.create({
      id: uuidv4(),
      name,
      description,
      sortOrder: sortOrder || 0,
      minLevel: minLevel || 0,
      createdAt: new Date()
    });
    await this.categoryRepository.save(category);
    return category;
  }

  public async updateCategory(id: string, name: string, description: string | null, sortOrder: number, minLevel: number): Promise<void> {
    const category = await this.categoryRepository.findById(id);
    if (!category) throw new Error('ERR_CATEGORY_NOT_FOUND');
    
    if (name) category.updateDetails(name, description, sortOrder);
    if (minLevel !== undefined) category.changeMinLevel(minLevel);
    
    await this.categoryRepository.save(category);
  }

  public async deleteCategory(id: string): Promise<void> {
    const category = await this.categoryRepository.findById(id);
    if (!category) throw new Error('ERR_CATEGORY_NOT_FOUND');

    await prisma.$transaction([
      prisma.post.deleteMany({ where: { categoryId: id } }),
      prisma.category.delete({ where: { id } })
    ]);
  }

  public async createPost(title: string, content: string, categoryId: string, authorId: string, userLevel: number): Promise<any> {
    const category = await this.categoryRepository.findById(categoryId);
    if (!category) throw new Error('ERR_CATEGORY_NOT_FOUND');
    if (!category.isLevelSufficient(userLevel)) {
      throw new Error('ERR_INSUFFICIENT_LEVEL_TO_POST_IN_THIS_CATEGORY');
    }

    const isModerated = await containsModeratedWord(title + ' ' + content, categoryId);
    const status: PostStatus = isModerated ? 'PENDING' : 'PUBLISHED';

    const post = await prisma.post.create({
      data: {
        title,
        content,
        categoryId,
        authorId,
        status
      },
      include: {
        author: { select: { username: true } },
        category: { select: { name: true } }
      }
    });

    return { post, isModerated };
  }

  public async updatePost(postId: string, title: string, content: string, categoryId: string): Promise<any> {
    const existingPost = await prisma.post.findUnique({ where: { id: postId } });
    if (!existingPost) throw new Error('ERR_POST_NOT_FOUND');

    let newStatus = existingPost.status;
    if (title || content) {
      const checkTitle = title || existingPost.title;
      const checkContent = content || existingPost.content;
      const isModerated = await containsModeratedWord(checkTitle + ' ' + checkContent, categoryId || existingPost.categoryId);
      if (isModerated) newStatus = 'PENDING';
    }

    return await prisma.post.update({
      where: { id: postId },
      data: { title, content, categoryId, status: newStatus },
      include: {
        author: { select: { id: true, username: true } },
        category: { select: { name: true } }
      }
    });
  }

  public async deletePost(postId: string): Promise<void> {
    await prisma.$transaction([
      prisma.post.update({ where: { id: postId }, data: { status: PostStatus.DELETED } }),
      prisma.comment.updateMany({ where: { postId: postId }, data: { deletedAt: new Date() } })
    ]);
  }

  // --- Comment Management ---

  public async createComment(content: string, postId: string, authorId: string, parentId?: string): Promise<any> {
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new Error('ERR_POST_NOT_FOUND');

    const isModerated = await containsModeratedWord(content, post.categoryId);

    return await prisma.comment.create({
      data: {
        content,
        authorId,
        postId,
        parentId,
        isPending: isModerated
      },
      include: {
        author: { select: { id: true, username: true } }
      }
    });
  }

  public async updateComment(commentId: string, content: string, categoryId: string): Promise<any> {
    const isModerated = await containsModeratedWord(content, categoryId);

    return await prisma.comment.update({
      where: { id: commentId },
      data: {
        content,
        isPending: isModerated
      },
      include: {
        author: { select: { id: true, username: true } }
      }
    });
  }

  public async deleteComment(commentId: string): Promise<void> {
    await prisma.comment.update({ where: { id: commentId }, data: { deletedAt: new Date() } });
  }

  // --- Engagements ---

  public async togglePostUpvote(postId: string, userId: string): Promise<boolean> {
    return this.engagementRepository.togglePostUpvote(postId, userId);
  }

  public async togglePostBookmark(postId: string, userId: string): Promise<boolean> {
    return this.engagementRepository.togglePostBookmark(postId, userId);
  }

  public async toggleCommentUpvote(commentId: string, userId: string): Promise<boolean> {
    return this.engagementRepository.toggleCommentUpvote(commentId, userId);
  }

  public async toggleCommentBookmark(commentId: string, userId: string): Promise<boolean> {
    return this.engagementRepository.toggleCommentBookmark(commentId, userId);
  }
}