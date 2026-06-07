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
export interface ModerationApplicationServiceOptions {
  postRepository: IPostRepository
  commentRepository: ICommentRepository
  moderatedWordRepository: IModeratedWordRepository
  eventBus: IEventBus
  auditApplicationService: AuditApplicationService
  unitOfWork: IUnitOfWork
}
export class ModerationApplicationService {
  constructor(private readonly opts: ModerationApplicationServiceOptions) {}

  private async assertCanModeratePost(post: any, ability?: AppAbility): Promise<void> {
    if (!ability) return
    const { subject } = await import('@casl/ability')
    if (!ability.can('update_status', subject('Post', { ...post } as any))) {
      throw new Error('ERR_FORBIDDEN_INSUFFICIENT_PERMISSIONS_TO_MANAGE_THIS_POST')
    }
  }

  private async assertCanModerateComment(comment: any, ability?: AppAbility): Promise<void> {
    if (!ability) return
    const post = await this.opts.postRepository.findById(comment.postId)
    if (!post) throw new Error('ERR_POST_NOT_FOUND')

    const { subject } = await import('@casl/ability')
    if (!ability.can('manage', subject('Comment', { ...comment, post: { categoryId: post.categoryId } } as any))) {
      throw new Error('ERR_FORBIDDEN_INSUFFICIENT_PERMISSIONS_TO_MANAGE_THIS_POST')
    }
  }

  public async approvePost(postId: string, operatorId?: string, ability?: AppAbility): Promise<any> {
    return this.opts.unitOfWork.execute(async () => {
      const post = await this.opts.postRepository.findById(postId);
      if (!post) throw new Error('ERR_POST_NOT_FOUND');

      await this.assertCanModeratePost(post, ability);
      post.approve();
      await this.opts.postRepository.save(post);

      if (operatorId) {
        await this.opts.auditApplicationService.logAudit(operatorId, 'APPROVE_POST', `Post:${postId}`);
      }
      await this.opts.eventBus.publish(new PostApprovedEvent(post.id, post.authorId, post.title));
      return { id: post.id, status: post.status };
    });
  }

  public async rejectPost(postId: string, reason: string, operatorId?: string, ability?: AppAbility): Promise<any> {
    return this.opts.unitOfWork.execute(async () => {
      const post = await this.opts.postRepository.findById(postId);
      if (!post) throw new Error('ERR_POST_NOT_FOUND');

      await this.assertCanModeratePost(post, ability);
      post.reject();
      await this.opts.postRepository.save(post);

      if (operatorId) {
        await this.opts.auditApplicationService.logAudit(operatorId, 'REJECT_POST', `Post:${postId}`);
      }
      await this.opts.eventBus.publish(new PostRejectedEvent(post.id, post.authorId, post.title, reason || 'N/A'));
      return { id: post.id, status: post.status };
    });
  }

  public async restorePost(postId: string, operatorId: string, ability?: AppAbility): Promise<any> {
    return this.opts.unitOfWork.execute(async () => {
      const post = await this.opts.postRepository.findById(postId);
      if (!post) throw new Error('ERR_POST_NOT_FOUND');

      if (ability) {
        const { subject } = await import('@casl/ability');
        if (!ability.can('manage', subject('Post', { ...post } as any))) {
          throw new Error('ERR_FORBIDDEN');
        }
      }

      post.restore();
      await this.opts.postRepository.save(post);
      await this.opts.auditApplicationService.logAudit(operatorId, 'RESTORE_POST', `Post:${postId}`);

      return { id: post.id, status: post.status };
    });
  }

  public async approveComment(commentId: string, operatorId?: string, ability?: AppAbility): Promise<any> {
    return this.opts.unitOfWork.execute(async () => {
      const comment = await this.opts.commentRepository.findById(commentId);
      if (!comment) throw new Error('ERR_COMMENT_NOT_FOUND');

      await this.assertCanModerateComment(comment, ability);
      comment.approve();
      await this.opts.commentRepository.save(comment);

      if (operatorId) {
        await this.opts.auditApplicationService.logAudit(operatorId, 'APPROVE_COMMENT', `Comment:${commentId}`);
      }
      return { id: comment.id, isPending: comment.isPending, isDeleted: comment.deletedAt !== null };
    });
  }

  public async rejectComment(commentId: string, operatorId?: string, ability?: AppAbility): Promise<any> {
    return this.opts.unitOfWork.execute(async () => {
      const comment = await this.opts.commentRepository.findById(commentId);
      if (!comment) throw new Error('ERR_COMMENT_NOT_FOUND');

      await this.assertCanModerateComment(comment, ability);
      comment.delete();
      await this.opts.commentRepository.save(comment);

      if (operatorId) {
        await this.opts.auditApplicationService.logAudit(operatorId, 'REJECT_COMMENT', `Comment:${commentId}`);
      }
      return { id: comment.id, isPending: comment.isPending, isDeleted: comment.deletedAt !== null };
    });
  }

  public async restoreComment(commentId: string, operatorId: string, ability?: AppAbility): Promise<any> {
    return this.opts.unitOfWork.execute(async () => {
      const comment = await this.opts.commentRepository.findById(commentId);
      if (!comment) throw new Error('ERR_COMMENT_NOT_FOUND');

      if (ability) {
        const { subject } = await import('@casl/ability');
        if (!ability.can('manage', subject('Comment', { ...comment } as any))) {
          throw new Error('ERR_FORBIDDEN');
        }
      }

      comment.restore();
      await this.opts.commentRepository.save(comment);
      await this.opts.auditApplicationService.logAudit(operatorId, 'RESTORE_COMMENT', `Comment:${commentId}`);

      return { id: comment.id, isPending: comment.isPending, isDeleted: comment.deletedAt !== null };
    });
  }

  public async changePostStatus(postId: string, status: any, operatorId: string, ability?: AppAbility): Promise<any> {
    return this.opts.unitOfWork.execute(async () => {
      const post = await this.opts.postRepository.findById(postId);
      if (!post) throw new Error('ERR_POST_NOT_FOUND');

      if (ability) {
        const { subject } = await import('@casl/ability');
        if (!ability.can('update_status', subject('Post', { ...post } as any))) {
          throw new Error('ERR_FORBIDDEN_INSUFFICIENT_PERMISSIONS_TO_MANAGE_THIS_POST');
        }
      }

      post.changeStatus(status);
      await this.opts.postRepository.save(post);
      await this.opts.auditApplicationService.logAudit(operatorId, 'UPDATE_POST_STATUS', `Post:${postId} to ${status}`);

      return { id: post.id, status: post.status };
    });
  }

  public async hardDeletePost(postId: string, operatorId: string, ability?: AppAbility): Promise<void> {
    return this.opts.unitOfWork.execute(async () => {
      const post = await this.opts.postRepository.findById(postId);
      if (!post) throw new Error('ERR_POST_NOT_FOUND');

      if (ability) {
        const { subject } = await import('@casl/ability');
        if (!ability.can('manage', subject('Post', { ...post } as any))) {
          throw new Error('ERR_FORBIDDEN');
        }
      }

      await this.opts.postRepository.delete(postId);
      await this.opts.auditApplicationService.logAudit(operatorId, 'HARD_DELETE_POST', `Post:${postId}`);
    });
  }

  public async hardDeleteComment(commentId: string, operatorId: string, ability?: AppAbility): Promise<void> {
    return this.opts.unitOfWork.execute(async () => {
      const comment = await this.opts.commentRepository.findById(commentId);
      if (!comment) throw new Error('ERR_COMMENT_NOT_FOUND');

      if (ability) {
        const { subject } = await import('@casl/ability');
        if (!ability.can('manage', subject('Comment', { ...comment } as any))) {
          throw new Error('ERR_FORBIDDEN');
        }
      }

      await this.opts.commentRepository.delete(commentId);
      await this.opts.auditApplicationService.logAudit(operatorId, 'HARD_DELETE_COMMENT', `Comment:${commentId}`);
    });
  }

  public async addModeratedWord(word: string, categoryId: string | undefined, operatorId: string, ability?: AppAbility): Promise<any> {
    return this.opts.unitOfWork.execute(async () => {
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

      await this.opts.moderatedWordRepository.save(moderatedWord);
      await this.opts.auditApplicationService.logAudit(operatorId, 'ADD_MODERATED_WORD', `Word:${moderatedWord.id}`);
      
      await this.opts.eventBus.publish(new ModeratedWordAddedEvent(moderatedWord.id, moderatedWord.word, moderatedWord.categoryId));

      return { id: moderatedWord.id, word: moderatedWord.word, categoryId: moderatedWord.categoryId };
    });
  }

  public async removeModeratedWord(id: string, operatorId: string, ability?: AppAbility): Promise<void> {
    return this.opts.unitOfWork.execute(async () => {
      const word = await this.opts.moderatedWordRepository.findById(id);
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

      await this.opts.moderatedWordRepository.delete(id);
      await this.opts.auditApplicationService.logAudit(operatorId, 'REMOVE_MODERATED_WORD', `Word:${id}`);
      
      await this.opts.eventBus.publish(new ModeratedWordDeletedEvent(word.id, word.word, word.categoryId));
    });
  }
}
