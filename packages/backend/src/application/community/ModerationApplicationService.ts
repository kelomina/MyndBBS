import { IPostRepository } from '../../domain/community/IPostRepository';
import { ICommentRepository } from '../../domain/community/ICommentRepository';
import { IModeratedWordRepository } from '../../domain/community/IModeratedWordRepository';
import { ModeratedWord } from '../../domain/community/ModeratedWord';
import { IEventBus } from '../../domain/shared/events/IEventBus';
import { PostApprovedEvent, PostRejectedEvent, ModeratedWordAddedEvent, ModeratedWordDeletedEvent } from '../../domain/shared/events/DomainEvents';
import { randomUUID as uuidv4 } from 'crypto';
import { AuditApplicationService } from '../system/AuditApplicationService';
import { AppAbility } from '../../lib/casl';
import { IUnitOfWork } from '../../domain/shared/IUnitOfWork';

/**
 * Callers: [ModerationController, AdminController]
 * Callees: [IPostRepository, ICommentRepository, IModeratedWordRepository, IEventBus, IUnitOfWork]
 * Description: The Application Service for the Moderation Domain. Orchestrates approving/rejecting content and managing filtered words.
 * Keywords: moderation, service, application, orchestration, post, comment, filtered, word
 */
export class ModerationApplicationService {
  /**
   * Initializes the service with required repositories, event bus, audit service, and Unit of Work.
   */
  constructor(
    private postRepository: IPostRepository,
    private commentRepository: ICommentRepository,
    private moderatedWordRepository: IModeratedWordRepository,
    private eventBus: IEventBus,
    private auditApplicationService: AuditApplicationService,
    private unitOfWork: IUnitOfWork
  ) {}

  /**
   * Approves a post.
   * @param postId The ID of the post to approve
   */
  public async approvePost(postId: string): Promise<any> {
    return this.unitOfWork.execute(async () => {
      const post = await this.postRepository.findById(postId);
      if (!post) throw new Error('ERR_POST_NOT_FOUND');

      post.approve();
      await this.postRepository.save(post);

      post.domainEvents.forEach(e => this.eventBus.publish(e));
      post.clearDomainEvents();

      return { id: post.id, status: post.status };
    });
  }

  /**
   * Rejects a post.
   * @param postId The ID of the post to reject
   * @param reason The reason for rejection
   */
  public async rejectPost(postId: string, reason: string): Promise<any> {
    return this.unitOfWork.execute(async () => {
      const post = await this.postRepository.findById(postId);
      if (!post) throw new Error('ERR_POST_NOT_FOUND');

      post.reject(reason);
      await this.postRepository.save(post);

      post.domainEvents.forEach(e => this.eventBus.publish(e));
      post.clearDomainEvents();

      return { id: post.id, status: post.status };
    });
  }

  /**
   * Restores a soft-deleted post and records an audit log.
   * @param postId The ID of the post to restore
   * @param operatorId The ID of the user performing the action
   * @param ability The CASL ability instance for permission checking
   */
  public async restorePost(postId: string, operatorId: string, ability?: AppAbility): Promise<any> {
    return this.unitOfWork.execute(async () => {
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
    });
  }

  /**
   * Approves a comment.
   * @param commentId The ID of the comment to approve
   */
  public async approveComment(commentId: string): Promise<any> {
    return this.unitOfWork.execute(async () => {
      const comment = await this.commentRepository.findById(commentId);
      if (!comment) throw new Error('ERR_COMMENT_NOT_FOUND');

      comment.approve();
      await this.commentRepository.save(comment);

      return { id: comment.id, isPending: comment.isPending, isDeleted: comment.deletedAt !== null };
    });
  }

  /**
   * Rejects a comment.
   * @param commentId The ID of the comment to reject
   */
  public async rejectComment(commentId: string): Promise<any> {
    return this.unitOfWork.execute(async () => {
      const comment = await this.commentRepository.findById(commentId);
      if (!comment) throw new Error('ERR_COMMENT_NOT_FOUND');

      comment.delete(); // Rejecting a comment acts as a soft delete
      await this.commentRepository.save(comment);

      return { id: comment.id, isPending: comment.isPending, isDeleted: comment.deletedAt !== null };
    });
  }

  /**
   * Restores a soft-deleted comment and records an audit log.
   * @param commentId The ID of the comment to restore
   * @param operatorId The ID of the user performing the action
   * @param ability The CASL ability instance for permission checking
   */
  public async restoreComment(commentId: string, operatorId: string, ability?: AppAbility): Promise<any> {
    return this.unitOfWork.execute(async () => {
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
    });
  }

  /**
   * Changes the status of a post and records an audit log.
   * @param postId The ID of the post
   * @param status The new status
   * @param operatorId The ID of the user performing the action
   * @param ability The CASL ability instance for permission checking
   */
  public async changePostStatus(postId: string, status: any, operatorId: string, ability?: AppAbility): Promise<any> {
    return this.unitOfWork.execute(async () => {
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
    });
  }

  /**
   * Hard deletes a post and records an audit log.
   * @param postId The ID of the post
   * @param operatorId The ID of the user performing the action
   * @param ability The CASL ability instance for permission checking
   */
  public async hardDeletePost(postId: string, operatorId: string, ability?: AppAbility): Promise<void> {
    return this.unitOfWork.execute(async () => {
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
    });
  }

  /**
   * Hard deletes a comment and records an audit log.
   * @param commentId The ID of the comment
   * @param operatorId The ID of the user performing the action
   * @param ability The CASL ability instance for permission checking
   */
  public async hardDeleteComment(commentId: string, operatorId: string, ability?: AppAbility): Promise<void> {
    return this.unitOfWork.execute(async () => {
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
    });
  }

  /**
   * Adds a new moderated word.
   * @param word The word to moderate
   * @param categoryId The category ID, or undefined for global
   * @param operatorId The ID of the user performing the action
   * @param ability The CASL ability instance for permission checking
   */
  public async addModeratedWord(word: string, categoryId: string | undefined, operatorId: string, ability?: AppAbility): Promise<any> {
    return this.unitOfWork.execute(async () => {
      if (ability) {
        const { subject } = await import('@casl/ability');
        if (!ability.can('manage', subject('ModeratedWord', { categoryId } as any))) {
          if (!categoryId) {
            throw new Error('ERR_CANNOT_ADD_GLOBAL_WORD');
          }
          throw new Error('ERR_NOT_MODERATOR_OF_CATEGORY');
        }
      }

      const moderatedWord = ModeratedWord.create({
        id: uuidv4(),
        word,
        categoryId: categoryId || null,
        createdAt: new Date()
      });

      await this.moderatedWordRepository.save(moderatedWord);
      await this.auditApplicationService.logAudit(operatorId, 'ADD_MODERATED_WORD', `Word:${moderatedWord.id}`);
      
      this.eventBus.publish(new ModeratedWordAddedEvent(moderatedWord.id, moderatedWord.word, moderatedWord.categoryId));

      return { id: moderatedWord.id, word: moderatedWord.word, categoryId: moderatedWord.categoryId };
    });
  }

  /**
   * Removes a moderated word.
   * @param id The ID of the moderated word
   * @param operatorId The ID of the user performing the action
   * @param ability The CASL ability instance for permission checking
   */
  public async removeModeratedWord(id: string, operatorId: string, ability?: AppAbility): Promise<void> {
    return this.unitOfWork.execute(async () => {
      const word = await this.moderatedWordRepository.findById(id);
      if (!word) throw new Error('ERR_WORD_NOT_FOUND');

      if (ability) {
        const { subject } = await import('@casl/ability');
        if (!ability.can('manage', subject('ModeratedWord', { categoryId: word.categoryId } as any))) {
          if (!word.categoryId) {
            throw new Error('ERR_CANNOT_DELETE_GLOBAL_WORD');
          }
          throw new Error('ERR_NOT_MODERATOR_OF_CATEGORY');
        }
      }

      await this.moderatedWordRepository.delete(id);
      await this.auditApplicationService.logAudit(operatorId, 'REMOVE_MODERATED_WORD', `Word:${id}`);
      
      this.eventBus.publish(new ModeratedWordDeletedEvent(word.id, word.word, word.categoryId));
    });
  }
}
