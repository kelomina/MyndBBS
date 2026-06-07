import { ModerationApplicationService } from '../src/application/community/ModerationApplicationService';
import { Post } from '../src/domain/community/Post';
import { Comment } from '../src/domain/community/Comment';
import { PostStatus } from '@myndbbs/shared';
import { PostApprovedEvent, PostRejectedEvent, ModeratedWordAddedEvent, ModeratedWordDeletedEvent } from '../src/domain/shared/events/DomainEvents';

describe('ModerationApplicationService', () => {
  let postRepository: any;
  let commentRepository: any;
  let moderatedWordRepository: any;
  let eventBus: any;
  let auditApplicationService: any;
  let unitOfWork: any;
  let service: ModerationApplicationService;

  beforeEach(() => {
    postRepository = {
      findById: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    commentRepository = {
      findById: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    moderatedWordRepository = {
      findById: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    eventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
    };
    auditApplicationService = {
      logAudit: jest.fn(),
    };
    unitOfWork = {
      execute: jest.fn((work) => work()),
    };

    service = new ModerationApplicationService({
      postRepository,
      commentRepository,
      moderatedWordRepository,
      eventBus,
      auditApplicationService,
      unitOfWork,
    });
  });

  describe('Post Moderation', () => {
    it('should approve a pending post', async () => {
      const mockPost = Post.create(
        { id: 'post-1', title: 'Title', content: 'Content', categoryId: 'cat-1', authorId: 'user-1', createdAt: new Date() },
        true // isModerated -> PENDING status
      );
      postRepository.findById.mockResolvedValue(mockPost);

      const result = await service.approvePost('post-1');

      expect(result).toEqual({ id: 'post-1', status: PostStatus.PUBLISHED });
      expect(postRepository.save).toHaveBeenCalledWith(mockPost);
      expect(eventBus.publish).toHaveBeenCalledWith(expect.any(PostApprovedEvent));
    });

    it('should reject a pending post', async () => {
      const mockPost = Post.create(
        { id: 'post-1', title: 'Title', content: 'Content', categoryId: 'cat-1', authorId: 'user-1', createdAt: new Date() },
        true // isModerated -> PENDING status
      );
      postRepository.findById.mockResolvedValue(mockPost);

      const result = await service.rejectPost('post-1', 'Inappropriate content');

      expect(result).toEqual({ id: 'post-1', status: PostStatus.DELETED });
      expect(postRepository.save).toHaveBeenCalledWith(mockPost);
      expect(eventBus.publish).toHaveBeenCalledWith(expect.any(PostRejectedEvent));
    });

    it('should throw when approving non-existent post', async () => {
      postRepository.findById.mockResolvedValue(null);
      await expect(service.approvePost('post-unknown')).rejects.toThrow('ERR_POST_NOT_FOUND');
    });

    it('should reject approving a post outside the moderator scope at service layer', async () => {
      const mockPost = Post.create(
        { id: 'post-1', title: 'Title', content: 'Content', categoryId: 'cat-1', authorId: 'user-1', createdAt: new Date() },
        true
      );
      postRepository.findById.mockResolvedValue(mockPost);
      const mockAbility = { can: jest.fn().mockReturnValue(false) };

      await expect(service.approvePost('post-1', 'moderator-1', mockAbility))
        .rejects.toThrow('ERR_FORBIDDEN_INSUFFICIENT_PERMISSIONS_TO_MANAGE_THIS_POST');
      expect(postRepository.save).not.toHaveBeenCalled();
    });

    it('should restore a deleted post', async () => {
      const mockPost = Post.create(
        { id: 'post-1', title: 'Title', content: 'Content', categoryId: 'cat-1', authorId: 'user-1', createdAt: new Date() },
        false
      );
      mockPost.delete(); // Set to DELETED status
      postRepository.findById.mockResolvedValue(mockPost);

      const result = await service.restorePost('post-1', 'admin-1');

      expect(result).toEqual({ id: 'post-1', status: PostStatus.PUBLISHED });
      expect(postRepository.save).toHaveBeenCalledWith(mockPost);
      expect(auditApplicationService.logAudit).toHaveBeenCalled();
    });

    it('should change post status with permission check', async () => {
      const mockPost = Post.create(
        { id: 'post-1', title: 'Title', content: 'Content', categoryId: 'cat-1', authorId: 'user-1', createdAt: new Date() },
        false
      );
      postRepository.findById.mockResolvedValue(mockPost);

      const mockAbility = { can: jest.fn().mockReturnValue(true) };

      const result = await service.changePostStatus('post-1', PostStatus.HIDDEN, 'admin-1', mockAbility);

      expect(result).toEqual({ id: 'post-1', status: PostStatus.HIDDEN });
      expect(postRepository.save).toHaveBeenCalled();
      expect(auditApplicationService.logAudit).toHaveBeenCalled();
    });

    it('should throw when changing post status without permission', async () => {
      const mockPost = Post.create(
        { id: 'post-1', title: 'Title', content: 'Content', categoryId: 'cat-1', authorId: 'user-1', createdAt: new Date() },
        false
      );
      postRepository.findById.mockResolvedValue(mockPost);

      const mockAbility = { can: jest.fn().mockReturnValue(false) };

      await expect(service.changePostStatus('post-1', PostStatus.HIDDEN, 'user-1', mockAbility))
        .rejects.toThrow('ERR_FORBIDDEN_INSUFFICIENT_PERMISSIONS_TO_MANAGE_THIS_POST');
    });
  });

  describe('Comment Moderation', () => {
    it('should approve a pending comment', async () => {
      const mockComment = Comment.create(
        { id: 'comment-1', content: 'Content', postId: 'post-1', authorId: 'user-1', parentId: null, deletedAt: null, createdAt: new Date() },
        true // isModerated -> isPending = true
      );
      commentRepository.findById.mockResolvedValue(mockComment);

      const result = await service.approveComment('comment-1');

      expect(result.isPending).toBe(false);
      expect(commentRepository.save).toHaveBeenCalledWith(mockComment);
    });

    it('should reject a comment (soft delete)', async () => {
      const mockComment = Comment.create(
        { id: 'comment-1', content: 'Content', postId: 'post-1', authorId: 'user-1', parentId: null, deletedAt: null, createdAt: new Date() },
        false
      );
      commentRepository.findById.mockResolvedValue(mockComment);

      const result = await service.rejectComment('comment-1');

      expect(result.isDeleted).toBe(true);
      expect(commentRepository.save).toHaveBeenCalledWith(mockComment);
    });

    it('should restore a deleted comment', async () => {
      const mockComment = Comment.create(
        { id: 'comment-1', content: 'Content', postId: 'post-1', authorId: 'user-1', parentId: null, deletedAt: null, createdAt: new Date() },
        false
      );
      mockComment.delete(); // soft delete
      commentRepository.findById.mockResolvedValue(mockComment);

      const result = await service.restoreComment('comment-1', 'admin-1');

      expect(result.isDeleted).toBe(false);
      expect(commentRepository.save).toHaveBeenCalled();
      expect(auditApplicationService.logAudit).toHaveBeenCalled();
    });

    it('should check the parent post category before approving a comment', async () => {
      const mockComment = Comment.create(
        { id: 'comment-1', content: 'Content', postId: 'post-1', authorId: 'user-1', parentId: null, deletedAt: null, createdAt: new Date() },
        true
      );
      const mockPost = Post.create(
        { id: 'post-1', title: 'Title', content: 'Content', categoryId: 'cat-1', authorId: 'user-2', createdAt: new Date() },
        false
      );
      commentRepository.findById.mockResolvedValue(mockComment);
      postRepository.findById.mockResolvedValue(mockPost);
      const mockAbility = { can: jest.fn().mockReturnValue(true) };

      await service.approveComment('comment-1', 'moderator-1', mockAbility);

      expect(mockAbility.can).toHaveBeenCalledWith('manage', expect.objectContaining({
        post: expect.objectContaining({ categoryId: 'cat-1' }),
      }));
      expect(commentRepository.save).toHaveBeenCalledWith(mockComment);
    });

    it('should reject comment moderation outside the moderator scope at service layer', async () => {
      const mockComment = Comment.create(
        { id: 'comment-1', content: 'Content', postId: 'post-1', authorId: 'user-1', parentId: null, deletedAt: null, createdAt: new Date() },
        true
      );
      const mockPost = Post.create(
        { id: 'post-1', title: 'Title', content: 'Content', categoryId: 'cat-1', authorId: 'user-2', createdAt: new Date() },
        false
      );
      commentRepository.findById.mockResolvedValue(mockComment);
      postRepository.findById.mockResolvedValue(mockPost);
      const mockAbility = { can: jest.fn().mockReturnValue(false) };

      await expect(service.approveComment('comment-1', 'moderator-1', mockAbility))
        .rejects.toThrow('ERR_FORBIDDEN_INSUFFICIENT_PERMISSIONS_TO_MANAGE_THIS_POST');
      expect(commentRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('Moderated Words', () => {
    it('should add a global moderated word', async () => {
      const mockAbility = { can: jest.fn().mockReturnValue(true) };

      const result = await service.addModeratedWord('badword', undefined, 'admin-1', mockAbility);

      expect(result.word).toBe('badword');
      expect(result.categoryId).toBeNull();
      expect(moderatedWordRepository.save).toHaveBeenCalled();
      expect(eventBus.publish).toHaveBeenCalledWith(expect.any(ModeratedWordAddedEvent));
    });

    it('should add a category-specific moderated word', async () => {
      const mockAbility = { can: jest.fn().mockReturnValue(true) };

      const result = await service.addModeratedWord('badword', 'cat-1', 'moderator-1', mockAbility);

      expect(result.word).toBe('badword');
      expect(result.categoryId).toBe('cat-1');
    });

    it('should remove a moderated word', async () => {
      moderatedWordRepository.findById.mockResolvedValue({ id: 'word-1', word: 'badword', categoryId: null });
      const mockAbility = { can: jest.fn().mockReturnValue(true) };

      await service.removeModeratedWord('word-1', 'admin-1', mockAbility);

      expect(moderatedWordRepository.delete).toHaveBeenCalledWith('word-1');
      expect(eventBus.publish).toHaveBeenCalledWith(expect.any(ModeratedWordDeletedEvent));
    });

    it('should throw when removing non-existent word', async () => {
      moderatedWordRepository.findById.mockResolvedValue(null);
      await expect(service.removeModeratedWord('word-unknown', 'admin-1')).rejects.toThrow('ERR_WORD_NOT_FOUND');
    });
  });
});
