import { ICategoryRepository } from '../../domain/community/ICategoryRepository';
import { IPostRepository } from '../../domain/community/IPostRepository';
import { ICommentRepository } from '../../domain/community/ICommentRepository';
import { IEngagementRepository } from '../../domain/community/IEngagementRepository';
import { Category } from '../../domain/community/Category';
import { Post } from '../../domain/community/Post';
import { Comment } from '../../domain/community/Comment';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../../db'; // Kept for CQRS read joins that return complex DTOs
import { containsModeratedWord } from '../../lib/moderation';

/**
 * Callers: [AdminController, PostController]
 * Callees: [ICategoryRepository, IPostRepository, ICommentRepository, IEngagementRepository, containsModeratedWord]
 * Description: The Application Service for the Community Domain. Orchestrates category management, post creation, and user engagements using true DDD.
 * Keywords: community, service, application, orchestration, category, post, comment, engagement
 */
export class CommunityApplicationService {
  constructor(
    private categoryRepository: ICategoryRepository,
    private postRepository: IPostRepository,
    private commentRepository: ICommentRepository,
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
      moderatorIds: [],
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

  public async assignCategoryModerator(categoryId: string, userId: string): Promise<any> {
    const category = await this.categoryRepository.findById(categoryId);
    if (!category) throw new Error('ERR_CATEGORY_NOT_FOUND');

    const user = await prisma.user.findUnique({ 
      where: { id: userId },
      include: { role: true }
    });
    if (!user || user.role?.name !== 'MODERATOR') {
      throw new Error('ERR_USER_NOT_FOUND_OR_IS_NOT_A_MODERATOR');
    }

    category.addModerator(userId);
    await this.categoryRepository.save(category);

    return { categoryId, userId };
  }

  public async removeCategoryModerator(categoryId: string, userId: string): Promise<void> {
    const category = await this.categoryRepository.findById(categoryId);
    if (!category) throw new Error('ERR_CATEGORY_NOT_FOUND');

    category.removeModerator(userId);
    await this.categoryRepository.save(category);
  }
  public async deleteCategory(id: string): Promise<void> {
    const category = await this.categoryRepository.findById(id);
    if (!category) throw new Error('ERR_CATEGORY_NOT_FOUND');

    await this.postRepository.deleteManyByCategoryId(id);
    await this.categoryRepository.delete(id);
  }

  public async createPost(title: string, content: string, categoryId: string, authorId: string, userLevel: number): Promise<any> {
    const category = await this.categoryRepository.findById(categoryId);
    if (!category) throw new Error('ERR_CATEGORY_NOT_FOUND');
    if (!category.isLevelSufficient(userLevel)) {
      throw new Error('ERR_INSUFFICIENT_LEVEL_TO_POST_IN_THIS_CATEGORY');
    }

    const isModerated = await containsModeratedWord(title + ' ' + content, categoryId);

    const post = Post.create({
      id: uuidv4(),
      title,
      content,
      categoryId,
      authorId,
      status: isModerated ? 'PENDING' : 'PUBLISHED',
      createdAt: new Date()
    });

    await this.postRepository.save(post);

    // Pragmatic CQRS Read to return rich DTO for frontend
    const postDto = await prisma.post.findUnique({
      where: { id: post.id },
      include: { author: { select: { username: true } }, category: { select: { name: true } } }
    });

    return { post: postDto, isModerated };
  }

  public async updatePost(postId: string, title: string, content: string, categoryId: string): Promise<any> {
    const post = await this.postRepository.findById(postId);
    if (!post) throw new Error('ERR_POST_NOT_FOUND');

    const checkTitle = title || post.title;
    const checkContent = content || post.content;
    const isModerated = await containsModeratedWord(checkTitle + ' ' + checkContent, categoryId || post.categoryId);

    post.updateContent(title, content, categoryId, isModerated);
    await this.postRepository.save(post);

    const postDto = await prisma.post.findUnique({
      where: { id: post.id },
      include: { author: { select: { id: true, username: true } }, category: { select: { name: true } } }
    });

    return postDto;
  }

  public async deletePost(postId: string): Promise<void> {
    const post = await this.postRepository.findById(postId);
    if (!post) throw new Error('ERR_POST_NOT_FOUND');

    post.delete();
    await this.postRepository.save(post);
    await this.commentRepository.softDeleteManyByPostId(postId);
  }

  // --- Comment Management ---

  public async createComment(content: string, postId: string, authorId: string, parentId?: string): Promise<any> {
    const post = await this.postRepository.findById(postId);
    if (!post) throw new Error('ERR_POST_NOT_FOUND');

    const isModerated = await containsModeratedWord(content, post.categoryId);

    const comment = Comment.create({
      id: uuidv4(),
      content,
      postId,
      authorId,
      parentId: parentId || null,
      isPending: isModerated,
      deletedAt: null,
      createdAt: new Date()
    });

    await this.commentRepository.save(comment);

    const commentDto = await prisma.comment.findUnique({
      where: { id: comment.id },
      include: { author: { select: { id: true, username: true } } }
    });

    return commentDto;
  }

  public async updateComment(commentId: string, content: string, categoryId: string): Promise<any> {
    const comment = await this.commentRepository.findById(commentId);
    if (!comment) throw new Error('ERR_COMMENT_NOT_FOUND');

    const isModerated = await containsModeratedWord(content, categoryId);
    comment.updateContent(content, isModerated);
    await this.commentRepository.save(comment);

    const commentDto = await prisma.comment.findUnique({
      where: { id: comment.id },
      include: { author: { select: { id: true, username: true } } }
    });

    return commentDto;
  }

  public async deleteComment(commentId: string): Promise<void> {
    const comment = await this.commentRepository.findById(commentId);
    if (!comment) throw new Error('ERR_COMMENT_NOT_FOUND');
    comment.delete();
    await this.commentRepository.save(comment);
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