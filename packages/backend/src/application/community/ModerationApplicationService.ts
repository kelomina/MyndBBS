import { IPostRepository } from '../../domain/community/IPostRepository';
import { ICommentRepository } from '../../domain/community/ICommentRepository';
import { IModeratedWordRepository } from '../../domain/community/IModeratedWordRepository';
import { ModeratedWord } from '../../domain/community/ModeratedWord';
import { IEventBus } from '../../domain/shared/events/IEventBus';
import { PostApprovedEvent, PostRejectedEvent, ModeratedWordAddedEvent, ModeratedWordDeletedEvent } from '../../domain/shared/events/DomainEvents';
import { randomUUID as uuidv4 } from 'crypto';

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
    private eventBus: IEventBus
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

  public async restorePost(postId: string): Promise<any> {
    const post = await this.postRepository.findById(postId);
    if (!post) throw new Error('ERR_POST_NOT_FOUND');

    post.restore();
    await this.postRepository.save(post);

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

  public async restoreComment(commentId: string): Promise<any> {
    const comment = await this.commentRepository.findById(commentId);
    if (!comment) throw new Error('ERR_COMMENT_NOT_FOUND');

    comment.restore();
    await this.commentRepository.save(comment);

    return { id: comment.id, isPending: comment.isPending, isDeleted: comment.deletedAt !== null };
  }

  public async changePostStatus(postId: string, status: any): Promise<any> {
    const post = await this.postRepository.findById(postId);
    if (!post) throw new Error('ERR_POST_NOT_FOUND');

    post.changeStatus(status);
    await this.postRepository.save(post);

    return { id: post.id, status: post.status };
  }

  public async hardDeletePost(postId: string): Promise<void> {
    const post = await this.postRepository.findById(postId);
    if (!post) throw new Error('ERR_POST_NOT_FOUND');
    await this.postRepository.delete(postId);
  }

  public async hardDeleteComment(commentId: string): Promise<void> {
    const comment = await this.commentRepository.findById(commentId);
    if (!comment) throw new Error('ERR_COMMENT_NOT_FOUND');
    await this.commentRepository.delete(commentId);
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