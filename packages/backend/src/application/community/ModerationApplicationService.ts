import { IPostRepository } from '../../domain/community/IPostRepository';
import { ICommentRepository } from '../../domain/community/ICommentRepository';
import { IModeratedWordRepository } from '../../domain/community/IModeratedWordRepository';
import { ModeratedWord } from '../../domain/community/ModeratedWord';
import { IEventBus } from '../../domain/shared/events/IEventBus';
import { PostApprovedEvent, PostRejectedEvent, ModeratedWordAddedEvent, ModeratedWordDeletedEvent } from '../../domain/shared/events/DomainEvents';
import { randomUUID as uuidv4 } from 'crypto';
import { AuditApplicationService } from '../system/AuditApplicationService';
import { AppAbility } from '../../lib/casl';

/**
 * Callers: [ModerationController, AdminController]
 * Callees: [IPostRepository, ICommentRepository, IModeratedWordRepository, IEventBus]
 * Description: The Application Service for the Moderation Domain. Orchestrates approving/rejecting content and managing filtered words.
 * Keywords: moderation, service, application, orchestration, post, comment, filtered, word
 */
export class ModerationApplicationService {
  constructor(
    private postRepository: IPostRepository,
    private commentRepository: ICommentRepository,
    private moderatedWordRepository: IModeratedWordRepository,
    private eventBus: IEventBus,
    private auditApplicationService: AuditApplicationService
  ) {}

  public async approvePost(postId: string): Promise<any> {
    const post = await this.postRepository.findById(postId);
    if (!post) throw new Error('ERR_POST_NOT_FOUND');

    post.approve();
    await this.postRepository.save(post);

    this.eventBus.publish(new PostApprovedEvent(post.id, post.authorId, post.title));
    return { id: post.id, status: post.status };
  }

  public async rejectPost(postId: string, reason: string): Promise<any> {
    const post = await this.postRepository.findById(postId);
    if (!post) throw new Error('ERR_POST_NOT_FOUND');

    post.reject();
    await this.postRepository.save(post);

    this.eventBus.publish(new PostRejectedEvent(post.id, post.authorId, post.title, reason || 'N/A'));
    return { id: post.id, status: post.status };
  }

  /**
   * 恢复帖子并记录审计日志
   * @param postId 帖子 ID
   * @param operatorId 执行操作的用户 ID
   */
  public async restorePost(postId: string, operatorId: string, ability?: AppAbility): Promise<any> {
    const post = await this.postRepository.findById(postId);
    if (!post) throw new Error('ERR_POST_NOT_FOUND');

    if (ability) {
      const { subject } = await import('@casl/ability');
      if (!ability.can('manage', subject('Post', { ...post } as any))) {
        throw new Error('ERR_FORBIDDEN');
      }
    }

    post.restore();
    await this.postRepository.save(post);
    await this.auditApplicationService.logAudit(operatorId, 'RESTORE_POST', `Post:${postId}`);

    return { id: post.id, status: post.status };
  }

  public async approveComment(commentId: string): Promise<any> {
    const comment = await this.commentRepository.findById(commentId);
    if (!comment) throw new Error('ERR_COMMENT_NOT_FOUND');

    comment.approve();
    await this.commentRepository.save(comment);

    return { id: comment.id, isPending: comment.isPending, isDeleted: comment.deletedAt !== null };
  }

  public async rejectComment(commentId: string): Promise<any> {
    const comment = await this.commentRepository.findById(commentId);
    if (!comment) throw new Error('ERR_COMMENT_NOT_FOUND');

    comment.delete(); // Rejecting a comment acts as a soft delete
    await this.commentRepository.save(comment);

    return { id: comment.id, isPending: comment.isPending, isDeleted: comment.deletedAt !== null };
  }

  /**
   * 恢复评论并记录审计日志
   * @param commentId 评论 ID
   * @param operatorId 执行操作的用户 ID
   */
  public async restoreComment(commentId: string, operatorId: string, ability?: AppAbility): Promise<any> {
    const comment = await this.commentRepository.findById(commentId);
    if (!comment) throw new Error('ERR_COMMENT_NOT_FOUND');

    if (ability) {
      const { subject } = await import('@casl/ability');
      if (!ability.can('manage', subject('Comment', { ...comment } as any))) {
        throw new Error('ERR_FORBIDDEN');
      }
    }

    comment.restore();
    await this.commentRepository.save(comment);
    await this.auditApplicationService.logAudit(operatorId, 'RESTORE_COMMENT', `Comment:${commentId}`);

    return { id: comment.id, isPending: comment.isPending, isDeleted: comment.deletedAt !== null };
  }

  /**
   * 更改帖子状态并记录审计日志
   * @param postId 帖子 ID
   * @param status 新状态
   * @param operatorId 执行操作的用户 ID
   */
  public async changePostStatus(postId: string, status: any, operatorId: string, ability?: AppAbility): Promise<any> {
    const post = await this.postRepository.findById(postId);
    if (!post) throw new Error('ERR_POST_NOT_FOUND');

    if (ability) {
      const { subject } = await import('@casl/ability');
      if (!ability.can('update_status', subject('Post', { ...post } as any))) {
        throw new Error('ERR_FORBIDDEN_INSUFFICIENT_PERMISSIONS_TO_MANAGE_THIS_POST');
      }
    }

    post.changeStatus(status);
    await this.postRepository.save(post);
    await this.auditApplicationService.logAudit(operatorId, 'UPDATE_POST_STATUS', `Post:${postId} to ${status}`);

    return { id: post.id, status: post.status };
  }

  /**
   * 物理删除帖子并记录审计日志
   * @param postId 帖子 ID
   * @param operatorId 执行操作的用户 ID
   */
  public async hardDeletePost(postId: string, operatorId: string, ability?: AppAbility): Promise<void> {
    const post = await this.postRepository.findById(postId);
    if (!post) throw new Error('ERR_POST_NOT_FOUND');

    if (ability) {
      const { subject } = await import('@casl/ability');
      if (!ability.can('manage', subject('Post', { ...post } as any))) {
        throw new Error('ERR_FORBIDDEN');
      }
    }

    await this.postRepository.delete(postId);
    await this.auditApplicationService.logAudit(operatorId, 'HARD_DELETE_POST', `Post:${postId}`);
  }

  /**
   * 物理删除评论并记录审计日志
   * @param commentId 评论 ID
   * @param operatorId 执行操作的用户 ID
   */
  public async hardDeleteComment(commentId: string, operatorId: string, ability?: AppAbility): Promise<void> {
    const comment = await this.commentRepository.findById(commentId);
    if (!comment) throw new Error('ERR_COMMENT_NOT_FOUND');

    if (ability) {
      const { subject } = await import('@casl/ability');
      if (!ability.can('manage', subject('Comment', { ...comment } as any))) {
        throw new Error('ERR_FORBIDDEN');
      }
    }

    await this.commentRepository.delete(commentId);
    await this.auditApplicationService.logAudit(operatorId, 'HARD_DELETE_COMMENT', `Comment:${commentId}`);
  }

  public async addModeratedWord(word: string, categoryId?: string): Promise<any> {
    const moderatedWord = ModeratedWord.create({
      id: uuidv4(),
      word,
      categoryId: categoryId || null,
      createdAt: new Date()
    });

    await this.moderatedWordRepository.save(moderatedWord);
    
    this.eventBus.publish(new ModeratedWordAddedEvent(moderatedWord.id, moderatedWord.word, moderatedWord.categoryId));

    return { id: moderatedWord.id, word: moderatedWord.word, categoryId: moderatedWord.categoryId };
  }

  public async removeModeratedWord(id: string): Promise<void> {
    const word = await this.moderatedWordRepository.findById(id);
    if (!word) throw new Error('ERR_WORD_NOT_FOUND');

    await this.moderatedWordRepository.delete(id);
    
    this.eventBus.publish(new ModeratedWordDeletedEvent(word.id, word.word, word.categoryId));
  }
}