import { ICategoryRepository } from '../../domain/community/ICategoryRepository';
import { IPostRepository } from '../../domain/community/IPostRepository';
import { ICommentRepository } from '../../domain/community/ICommentRepository';
import { IEngagementRepository } from '../../domain/community/IEngagementRepository';
import { IIdentityIntegrationPort } from '../../domain/community/IIdentityIntegrationPort';
import { Category } from '../../domain/community/Category';
import { Post } from '../../domain/community/Post';
import { PostStatus } from '@myndbbs/shared';
import { Comment } from '../../domain/community/Comment';
import { PostUpvote, PostBookmark } from '../../domain/community/PostEngagement';
import { CommentUpvote, CommentBookmark } from '../../domain/community/CommentEngagement';
import { randomUUID as uuidv4 } from 'crypto';
import { IModerationPolicy } from '../../domain/community/IModerationPolicy';

import { ICaptchaValidator } from '../../domain/community/ICaptchaValidator';
import { IEventBus } from '../../domain/shared/events/IEventBus';
import { PostRepliedEvent, CommentRepliedEvent, CategoryModeratorAssignedEvent, CategoryModeratorRemovedEvent } from '../../domain/shared/events/DomainEvents';
import { AuditApplicationService } from '../system/AuditApplicationService';
import { subject, AnyAbility } from '@casl/ability';

/**
 * Callers: [AdminController, PostController]
 * Callees: [ICategoryRepository, IPostRepository, ICommentRepository, IEngagementRepository, IModerationPolicy]
 * Description: The Application Service for the Community Domain. Orchestrates category management, post creation, and user engagements using true DDD.
 * Keywords: community, service, application, orchestration, category, post, comment, engagement
 */
export class CommunityApplicationService {
  constructor(
    private categoryRepository: ICategoryRepository,
    private postRepository: IPostRepository,
    private commentRepository: ICommentRepository,
    private engagementRepository: IEngagementRepository,
    private identityIntegrationPort: IIdentityIntegrationPort,
    private moderationPolicy: IModerationPolicy,
    private captchaValidator: ICaptchaValidator,
    private eventBus: IEventBus,
    private auditApplicationService: AuditApplicationService
  ) {}

  // --- Category Management ---

  private async getPostSubject(post: Post) {
    const category = await this.categoryRepository.findById(post.categoryId);
    return subject('Post', {
      id: post.id,
      title: post.title,
      content: post.content,
      categoryId: post.categoryId,
      authorId: post.authorId,
      status: post.status,
      createdAt: post.createdAt,
      category: category ? {
        id: category.id,
        minLevel: category.minLevel
      } : null
    } as any);
  }

  private async getCommentSubject(comment: Comment, postObj?: Post) {
    const post = postObj || await this.postRepository.findById(comment.postId);
    const category = post ? await this.categoryRepository.findById(post.categoryId) : null;
    return subject('Comment', {
      id: comment.id,
      content: comment.content,
      postId: comment.postId,
      authorId: comment.authorId,
      parentId: comment.parentId,
      isPending: comment.isPending,
      deletedAt: comment.deletedAt,
      createdAt: comment.createdAt,
      post: post ? {
        id: post.id,
        categoryId: post.categoryId,
        authorId: post.authorId,
        status: post.status,
        category: category ? {
          id: category.id,
          minLevel: category.minLevel
        } : null
      } : null
    } as any);
  }

  /**
   * 创建分类并记录审计日志
   * @param name 分类名称
   * @param description 分类描述
   * @param sortOrder 排序顺序
   * @param minLevel 最小发帖等级
   * @param operatorId 执行操作的用户 ID
   * @returns 创建的分类实例
   */
  public async createCategory(name: string, description: string | null, sortOrder: number, minLevel: number, operatorId: string): Promise<Category> {
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
    await this.auditApplicationService.logAudit(operatorId, 'CREATE_CATEGORY', `Category:${category.id}`);
    return category;
  }

  /**
   * 更新分类并记录审计日志
   * @param id 分类 ID
   * @param name 新名称
   * @param description 新描述
   * @param sortOrder 新排序顺序
   * @param minLevel 新最小发帖等级
   * @param operatorId 执行操作的用户 ID
   */
  public async updateCategory(id: string, name: string, description: string | null, sortOrder: number, minLevel: number, operatorId: string): Promise<void> {
    const category = await this.categoryRepository.findById(id);
    if (!category) throw new Error('ERR_CATEGORY_NOT_FOUND');
    
    if (name) category.updateDetails(name, description, sortOrder);
    if (minLevel !== undefined) category.changeMinLevel(minLevel);
    
    await this.categoryRepository.save(category);
    await this.auditApplicationService.logAudit(operatorId, 'UPDATE_CATEGORY', `Category:${id}`);
  }

  /**
   * Callers: [AdminController]
   * Callees: [categoryRepository.findById, identityIntegrationPort.isModerator, category.addModerator, categoryRepository.save, eventBus.publish]
   * Description: Assigns a moderator role to a user for a specific category and logs audit.
   * Keywords: assign, moderator, category, community, user
   * @param categoryId 分类 ID
   * @param userId 目标用户 ID
   * @param operatorId 执行操作的用户 ID
   */
  public async assignCategoryModerator(categoryId: string, userId: string, operatorId: string): Promise<any> {
    const category = await this.categoryRepository.findById(categoryId);
    if (!category) throw new Error('ERR_CATEGORY_NOT_FOUND');

    const isModerator = await this.identityIntegrationPort.isModerator(userId);
    if (!isModerator) {
      throw new Error('ERR_USER_NOT_FOUND_OR_IS_NOT_A_MODERATOR');
    }

    category.addModerator(userId);
    await this.categoryRepository.save(category);
    this.eventBus.publish(new CategoryModeratorAssignedEvent(categoryId, userId));
    await this.auditApplicationService.logAudit(operatorId, 'ASSIGN_CATEGORY_MODERATOR', `User:${userId} to Category:${categoryId}`);

    return { categoryId, userId };
  }

  /**
   * 移除分类版主并记录审计日志
   * @param categoryId 分类 ID
   * @param userId 目标用户 ID
   * @param operatorId 执行操作的用户 ID
   */
  public async removeCategoryModerator(categoryId: string, userId: string, operatorId: string): Promise<void> {
    const category = await this.categoryRepository.findById(categoryId);
    if (!category) throw new Error('ERR_CATEGORY_NOT_FOUND');

    category.removeModerator(userId);
    await this.categoryRepository.save(category);
    this.eventBus.publish(new CategoryModeratorRemovedEvent(categoryId, userId));
    await this.auditApplicationService.logAudit(operatorId, 'REMOVE_CATEGORY_MODERATOR', `User:${userId} from Category:${categoryId}`);
  }

  /**
   * 删除分类并记录审计日志
   * @param id 分类 ID
   * @param operatorId 执行操作的用户 ID
   */
  public async deleteCategory(id: string, operatorId: string): Promise<void> {
    const category = await this.categoryRepository.findById(id);
    if (!category) throw new Error('ERR_CATEGORY_NOT_FOUND');

    await this.postRepository.deleteManyByCategoryId(id);
    await this.categoryRepository.delete(id);
    await this.auditApplicationService.logAudit(operatorId, 'DELETE_CATEGORY', `Category:${id}`);
  }

  public async createPost(title: string, content: string, categoryId: string, authorId: string, userLevel: number, captchaId: string): Promise<{ postId: string; isModerated: boolean }> {
    const isCaptchaValid = await this.captchaValidator.consumeCaptcha(captchaId);
    if (!isCaptchaValid) throw new Error('ERR_INVALID_OR_EXPIRED_CAPTCHA');

    const category = await this.categoryRepository.findById(categoryId);
    if (!category) throw new Error('ERR_CATEGORY_NOT_FOUND');
    if (!category.isLevelSufficient(userLevel)) {
      throw new Error('ERR_INSUFFICIENT_LEVEL_TO_POST_IN_THIS_CATEGORY');
    }

    const isModerated = await this.moderationPolicy.containsModeratedWord(title + ' ' + content, categoryId);

    const post = Post.create({
      id: uuidv4(),
      title,
      content,
      categoryId,
      authorId,
      createdAt: new Date()
    }, isModerated);

    await this.postRepository.save(post);

    return { postId: post.id, isModerated };
  }

  public async updatePost(ability: AnyAbility, postId: string, title: string, content: string, categoryId: string): Promise<{ postId: string }> {
    const post = await this.postRepository.findById(postId);
    if (!post) throw new Error('ERR_POST_NOT_FOUND');

    if (!ability.can('update', await this.getPostSubject(post))) {
      throw new Error('ERR_FORBIDDEN_INSUFFICIENT_PERMISSIONS_TO_EDIT_THIS_POST');
    }

    const checkTitle = title || post.title;
    const checkContent = content || post.content;
    const isModerated = await this.moderationPolicy.containsModeratedWord(checkTitle + ' ' + checkContent, categoryId || post.categoryId);

    post.updateContent(title, content, categoryId, isModerated);
    await this.postRepository.save(post);

    return { postId: post.id };
  }

  public async deletePost(ability: AnyAbility, postId: string): Promise<void> {
    const post = await this.postRepository.findById(postId);
    if (!post) throw new Error('ERR_POST_NOT_FOUND');

    if (!ability.can('delete', await this.getPostSubject(post))) {
      throw new Error('ERR_FORBIDDEN_INSUFFICIENT_PERMISSIONS_TO_DELETE_THIS_POST');
    }

    post.delete();
    await this.postRepository.save(post);
    await this.commentRepository.softDeleteManyByPostId(postId);
  }

  // --- Comment Management ---

  public async createComment(content: string, postId: string, authorId: string, captchaId: string, parentId?: string): Promise<{ commentId: string }> {
    const isCaptchaValid = await this.captchaValidator.consumeCaptcha(captchaId);
    if (!isCaptchaValid) throw new Error('ERR_INVALID_OR_EXPIRED_CAPTCHA');

    const post = await this.postRepository.findById(postId);
    if (!post) throw new Error('ERR_POST_NOT_FOUND');

    let parentComment;
    if (parentId) {
      parentComment = await this.commentRepository.findById(parentId);
      if (!parentComment || parentComment.postId !== postId) {
        throw new Error('ERR_INVALID_PARENT_COMMENT');
      }
    }

    const isModerated = await this.moderationPolicy.containsModeratedWord(content, post.categoryId);

    const comment = Comment.create({
      id: uuidv4(),
      content,
      postId,
      authorId,
      parentId: parentId || null,
      deletedAt: null,
      createdAt: new Date()
    }, isModerated);

    await this.commentRepository.save(comment);

    if (post.authorId !== authorId) {
      this.eventBus.publish(new PostRepliedEvent(postId, post.authorId, post.title, authorId, comment.id));
    }
    if (parentComment && parentComment.authorId !== authorId) {
      this.eventBus.publish(new CommentRepliedEvent(parentId!, parentComment.authorId, postId, authorId, comment.id));
    }

    return { commentId: comment.id };
  }

  public async updateComment(ability: AnyAbility, commentId: string, content: string): Promise<{ commentId: string }> {
    const comment = await this.commentRepository.findById(commentId);
    if (!comment) throw new Error('ERR_COMMENT_NOT_FOUND');

    if (!ability.can('update', await this.getCommentSubject(comment))) {
      throw new Error('ERR_FORBIDDEN_INSUFFICIENT_PERMISSIONS_TO_EDIT_THIS_COMMENT');
    }

    const post = await this.postRepository.findById(comment.postId);
    if (!post) throw new Error('ERR_POST_NOT_FOUND');

    const isModerated = await this.moderationPolicy.containsModeratedWord(content, post.categoryId);
    comment.updateContent(content, isModerated);
    await this.commentRepository.save(comment);

    return { commentId: comment.id };
  }

  public async deleteComment(ability: AnyAbility, commentId: string): Promise<void> {
    const comment = await this.commentRepository.findById(commentId);
    if (!comment) throw new Error('ERR_COMMENT_NOT_FOUND');

    if (!ability.can('delete', await this.getCommentSubject(comment))) {
      throw new Error('ERR_FORBIDDEN_INSUFFICIENT_PERMISSIONS_TO_DELETE_THIS_COMMENT');
    }

    comment.delete();
    await this.commentRepository.save(comment);
  }

  // --- Engagements ---

  /**
   * Callers: [PostController.toggleUpvote]
   * Callees: [IPostRepository.findById, IEngagementRepository.findPostUpvote, IEngagementRepository.deletePostUpvote, PostUpvote.create, IEngagementRepository.savePostUpvote]
   * Description: Toggles an upvote on a post. Enforces domain invariants (e.g. post must exist).
   * Keywords: toggle, upvote, post, engagement
   */
  public async togglePostUpvote(postId: string, userId: string): Promise<boolean> {
    const post = await this.postRepository.findById(postId);
    if (!post) throw new Error('ERR_POST_NOT_FOUND');

    const existing = await this.engagementRepository.findPostUpvote(postId, userId);
    if (existing) {
      await this.engagementRepository.deletePostUpvote(postId, userId);
      return false; // Toggled off
    } else {
      const upvote = PostUpvote.create({ userId, postId, createdAt: new Date() });
      await this.engagementRepository.savePostUpvote(upvote);
      return true; // Toggled on
    }
  }

  /**
   * Callers: [PostController.toggleBookmark]
   * Callees: [IPostRepository.findById, IEngagementRepository.findPostBookmark, IEngagementRepository.deletePostBookmark, PostBookmark.create, IEngagementRepository.savePostBookmark]
   * Description: Toggles a bookmark on a post. Enforces domain invariants.
   * Keywords: toggle, bookmark, post, engagement
   */
  public async togglePostBookmark(postId: string, userId: string): Promise<boolean> {
    const post = await this.postRepository.findById(postId);
    if (!post) throw new Error('ERR_POST_NOT_FOUND');

    const existing = await this.engagementRepository.findPostBookmark(postId, userId);
    if (existing) {
      await this.engagementRepository.deletePostBookmark(postId, userId);
      return false;
    } else {
      const bookmark = PostBookmark.create({ userId, postId, createdAt: new Date() });
      await this.engagementRepository.savePostBookmark(bookmark);
      return true;
    }
  }

  /**
   * Callers: [PostController.toggleCommentUpvote]
   * Callees: [ICommentRepository.findById, IEngagementRepository.findCommentUpvote, IEngagementRepository.deleteCommentUpvote, CommentUpvote.create, IEngagementRepository.saveCommentUpvote]
   * Description: Toggles an upvote on a comment. Enforces domain invariants.
   * Keywords: toggle, upvote, comment, engagement
   */
  public async toggleCommentUpvote(ability: AnyAbility, commentId: string, userId: string): Promise<boolean> {
    const comment = await this.commentRepository.findById(commentId);
    if (!comment) throw new Error('ERR_COMMENT_NOT_FOUND');

    const post = await this.postRepository.findById(comment.postId);
    if (!post) throw new Error('ERR_POST_NOT_FOUND');

    if (!ability.can('read', await this.getPostSubject(post))) {
      throw new Error('ERR_FORBIDDEN');
    }

    const existing = await this.engagementRepository.findCommentUpvote(commentId, userId);
    if (existing) {
      await this.engagementRepository.deleteCommentUpvote(commentId, userId);
      return false;
    } else {
      const upvote = CommentUpvote.create({ userId, commentId, createdAt: new Date() });
      await this.engagementRepository.saveCommentUpvote(upvote);
      return true;
    }
  }

  /**
   * Callers: [PostController.toggleCommentBookmark]
   * Callees: [ICommentRepository.findById, IEngagementRepository.findCommentBookmark, IEngagementRepository.deleteCommentBookmark, CommentBookmark.create, IEngagementRepository.saveCommentBookmark]
   * Description: Toggles a bookmark on a comment. Enforces domain invariants.
   * Keywords: toggle, bookmark, comment, engagement
   */
  public async toggleCommentBookmark(ability: AnyAbility, commentId: string, userId: string): Promise<boolean> {
    const comment = await this.commentRepository.findById(commentId);
    if (!comment) throw new Error('ERR_COMMENT_NOT_FOUND');

    const post = await this.postRepository.findById(comment.postId);
    if (!post) throw new Error('ERR_POST_NOT_FOUND');

    if (!ability.can('read', await this.getPostSubject(post))) {
      throw new Error('ERR_FORBIDDEN');
    }

    const existing = await this.engagementRepository.findCommentBookmark(commentId, userId);
    if (existing) {
      await this.engagementRepository.deleteCommentBookmark(commentId, userId);
      return false;
    } else {
      const bookmark = CommentBookmark.create({ userId, commentId, createdAt: new Date() });
      await this.engagementRepository.saveCommentBookmark(bookmark);
      return true;
    }
  }
}