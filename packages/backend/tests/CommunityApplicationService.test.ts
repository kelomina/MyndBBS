import { CommunityApplicationService } from '../src/application/community/CommunityApplicationService';
import { Category } from '../src/domain/community/Category';
import { Post } from '../src/domain/community/Post';
import { Comment } from '../src/domain/community/Comment';
import { PostUpvote, PostBookmark } from '../src/domain/community/PostEngagement';
import { CommentUpvote, CommentBookmark } from '../src/domain/community/CommentEngagement';
import { CategoryModeratorAssignedEvent, CategoryModeratorRemovedEvent, PostRepliedEvent, CommentRepliedEvent } from '../src/domain/shared/events/DomainEvents';

describe('CommunityApplicationService', () => {
  let categoryRepository: any;
  let postRepository: any;
  let commentRepository: any;
  let engagementRepository: any;
  let identityIntegrationPort: any;
  let moderationPolicy: any;
  let captchaValidator: any;
  let eventBus: any;
  let auditApplicationService: any;
  let service: CommunityApplicationService;

  beforeEach(() => {
    categoryRepository = {
      findById: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    postRepository = {
      findById: jest.fn(),
      save: jest.fn(),
      deleteManyByCategoryId: jest.fn(),
    };
    commentRepository = {
      findById: jest.fn(),
      save: jest.fn(),
      softDeleteManyByPostId: jest.fn(),
    };
    engagementRepository = {
      findPostUpvote: jest.fn(),
      deletePostUpvote: jest.fn(),
      savePostUpvote: jest.fn(),
      findPostBookmark: jest.fn(),
      deletePostBookmark: jest.fn(),
      savePostBookmark: jest.fn(),
      findCommentUpvote: jest.fn(),
      deleteCommentUpvote: jest.fn(),
      saveCommentUpvote: jest.fn(),
      findCommentBookmark: jest.fn(),
      deleteCommentBookmark: jest.fn(),
      saveCommentBookmark: jest.fn(),
    };
    identityIntegrationPort = {
      isModerator: jest.fn(),
    };
    moderationPolicy = {
      containsModeratedWord: jest.fn().mockResolvedValue(false),
    };
    captchaValidator = {
      consumeCaptcha: jest.fn().mockResolvedValue(true),
    };
    eventBus = {
      publish: jest.fn(),
    };
    auditApplicationService = {
      logAudit: jest.fn(),
    };

    service = new CommunityApplicationService(
      categoryRepository,
      postRepository,
      commentRepository,
      engagementRepository,
      identityIntegrationPort,
      moderationPolicy,
      captchaValidator,
      eventBus,
      auditApplicationService
    );
  });

  describe('Category Management', () => {
    it('should create a category', async () => {
      const category = await service.createCategory('Test Category', 'Description', 1, 0, 'user-123');
      expect(category).toBeInstanceOf(Category);
      expect(category.name).toBe('Test Category');
      expect(categoryRepository.save).toHaveBeenCalledWith(category);
      expect(auditApplicationService.logAudit).toHaveBeenCalledWith('user-123', 'CREATE_CATEGORY', `Category:${category.id}`);
    });

    it('should update a category', async () => {
      const mockCategory = Category.create({ id: 'cat-1', name: 'Old', description: 'Old desc', sortOrder: 0, minLevel: 0, moderatorIds: [], createdAt: new Date() });
      categoryRepository.findById.mockResolvedValue(mockCategory);

      await service.updateCategory('cat-1', 'New Name', 'New Desc', 2, 1, 'user-123');
      expect(mockCategory.name).toBe('New Name');
      expect(categoryRepository.save).toHaveBeenCalledWith(mockCategory);
      expect(auditApplicationService.logAudit).toHaveBeenCalledWith('user-123', 'UPDATE_CATEGORY', 'Category:cat-1');
    });

    it('should throw when updating non-existent category', async () => {
      categoryRepository.findById.mockResolvedValue(null);
      await expect(service.updateCategory('cat-unknown', 'Name', null, 1, 1, 'user-123')).rejects.toThrow('ERR_CATEGORY_NOT_FOUND');
    });

    it('should assign a category moderator', async () => {
      const mockCategory = Category.create({ id: 'cat-1', name: 'Cat', description: null, sortOrder: 0, minLevel: 0, moderatorIds: [], createdAt: new Date() });
      categoryRepository.findById.mockResolvedValue(mockCategory);
      identityIntegrationPort.isModerator.mockResolvedValue(true);

      const result = await service.assignCategoryModerator('cat-1', 'user-456', 'user-123');
      expect(result).toEqual({ categoryId: 'cat-1', userId: 'user-456' });
      expect(mockCategory.moderatorIds).toContain('user-456');
      expect(categoryRepository.save).toHaveBeenCalledWith(mockCategory);
      expect(eventBus.publish).toHaveBeenCalledWith(expect.any(CategoryModeratorAssignedEvent));
      expect(auditApplicationService.logAudit).toHaveBeenCalledWith('user-123', 'ASSIGN_CATEGORY_MODERATOR', 'User:user-456 to Category:cat-1');
    });

    it('should throw when assigning non-moderator to category', async () => {
      const mockCategory = Category.create({ id: 'cat-1', name: 'Cat', description: null, sortOrder: 0, minLevel: 0, moderatorIds: [], createdAt: new Date() });
      categoryRepository.findById.mockResolvedValue(mockCategory);
      identityIntegrationPort.isModerator.mockResolvedValue(false);

      await expect(service.assignCategoryModerator('cat-1', 'user-456', 'user-123')).rejects.toThrow('ERR_USER_NOT_FOUND_OR_IS_NOT_A_MODERATOR');
    });

    it('should remove a category moderator', async () => {
      const mockCategory = Category.create({ id: 'cat-1', name: 'Cat', description: null, sortOrder: 0, minLevel: 0, moderatorIds: ['user-456'], createdAt: new Date() });
      categoryRepository.findById.mockResolvedValue(mockCategory);

      await service.removeCategoryModerator('cat-1', 'user-456', 'user-123');
      expect(mockCategory.moderatorIds).not.toContain('user-456');
      expect(categoryRepository.save).toHaveBeenCalledWith(mockCategory);
      expect(eventBus.publish).toHaveBeenCalledWith(expect.any(CategoryModeratorRemovedEvent));
      expect(auditApplicationService.logAudit).toHaveBeenCalledWith('user-123', 'REMOVE_CATEGORY_MODERATOR', 'User:user-456 from Category:cat-1');
    });

    it('should delete a category', async () => {
      const mockCategory = Category.create({ id: 'cat-1', name: 'Cat', description: null, sortOrder: 0, minLevel: 0, moderatorIds: [], createdAt: new Date() });
      categoryRepository.findById.mockResolvedValue(mockCategory);

      await service.deleteCategory('cat-1', 'user-123');
      expect(postRepository.deleteManyByCategoryId).toHaveBeenCalledWith('cat-1');
      expect(categoryRepository.delete).toHaveBeenCalledWith('cat-1');
      expect(auditApplicationService.logAudit).toHaveBeenCalledWith('user-123', 'DELETE_CATEGORY', 'Category:cat-1');
    });
  });

  describe('Post Management', () => {
    it('should create a post', async () => {
      const mockCategory = Category.create({ id: 'cat-1', name: 'Cat', description: null, sortOrder: 0, minLevel: 1, moderatorIds: [], createdAt: new Date() });
      categoryRepository.findById.mockResolvedValue(mockCategory);

      const result = await service.createPost('Title', 'Content', 'cat-1', 'user-123', 2, 'captcha-1');
      expect(captchaValidator.consumeCaptcha).toHaveBeenCalledWith('captcha-1');
      expect(moderationPolicy.containsModeratedWord).toHaveBeenCalledWith('Title Content', 'cat-1');
      expect(postRepository.save).toHaveBeenCalled();
      expect(result).toHaveProperty('postId');
      expect(result).toHaveProperty('isModerated', false);
    });

    it('should throw on invalid captcha when creating post', async () => {
      captchaValidator.consumeCaptcha.mockResolvedValue(false);
      await expect(service.createPost('Title', 'Content', 'cat-1', 'user-123', 2, 'captcha-bad')).rejects.toThrow('ERR_INVALID_OR_EXPIRED_CAPTCHA');
    });

    it('should throw on insufficient level when creating post', async () => {
      const mockCategory = Category.create({ id: 'cat-1', name: 'Cat', description: null, sortOrder: 0, minLevel: 3, moderatorIds: [], createdAt: new Date() });
      categoryRepository.findById.mockResolvedValue(mockCategory);

      await expect(service.createPost('Title', 'Content', 'cat-1', 'user-123', 2, 'captcha-1')).rejects.toThrow('ERR_INSUFFICIENT_LEVEL_TO_POST_IN_THIS_CATEGORY');
    });

    it('should update a post', async () => {
      const mockPost = Post.create({ id: 'post-1', title: 'Old Title', content: 'Old Content', categoryId: 'cat-1', authorId: 'user-123', createdAt: new Date() }, false);
      postRepository.findById.mockResolvedValue(mockPost);

      const result = await service.updatePost('post-1', 'New Title', 'New Content', 'cat-1');
      expect(mockPost.title).toBe('New Title');
      expect(mockPost.content).toBe('New Content');
      expect(postRepository.save).toHaveBeenCalledWith(mockPost);
      expect(result).toEqual({ postId: 'post-1' });
    });

    it('should delete a post', async () => {
      const mockPost = Post.create({ id: 'post-1', title: 'Old Title', content: 'Old Content', categoryId: 'cat-1', authorId: 'user-123', createdAt: new Date() }, false);
      postRepository.findById.mockResolvedValue(mockPost);

      await service.deletePost('post-1');
      expect(mockPost.status).toBe('DELETED'); // Verify status is DELETED
      expect(postRepository.save).toHaveBeenCalledWith(mockPost);
      expect(commentRepository.softDeleteManyByPostId).toHaveBeenCalledWith('post-1');
    });
  });

  describe('Comment Management', () => {
    it('should create a comment', async () => {
      const mockPost = Post.create({ id: 'post-1', title: 'Title', content: 'Content', categoryId: 'cat-1', authorId: 'user-123', createdAt: new Date() }, false);
      postRepository.findById.mockResolvedValue(mockPost);

      const result = await service.createComment('Comment Content', 'post-1', 'user-456', 'captcha-1');
      expect(commentRepository.save).toHaveBeenCalled();
      expect(result).toHaveProperty('commentId');
      expect(eventBus.publish).toHaveBeenCalledWith(expect.any(PostRepliedEvent));
    });

    it('should create a reply comment', async () => {
      const mockPost = Post.create({ id: 'post-1', title: 'Title', content: 'Content', categoryId: 'cat-1', authorId: 'user-123', createdAt: new Date() }, false);
      const mockParentComment = Comment.create({ id: 'comment-parent', content: 'Parent', postId: 'post-1', authorId: 'user-456', parentId: null, deletedAt: null, createdAt: new Date() }, false);
      postRepository.findById.mockResolvedValue(mockPost);
      commentRepository.findById.mockResolvedValue(mockParentComment);

      const result = await service.createComment('Reply Content', 'post-1', 'user-789', 'captcha-1', 'comment-parent');
      expect(commentRepository.save).toHaveBeenCalled();
      expect(result).toHaveProperty('commentId');
      // Post author != comment author, Parent author != comment author
      expect(eventBus.publish).toHaveBeenCalledWith(expect.any(PostRepliedEvent));
      expect(eventBus.publish).toHaveBeenCalledWith(expect.any(CommentRepliedEvent));
    });

    it('should update a comment', async () => {
      const mockComment = Comment.create({ id: 'comment-1', content: 'Old Content', postId: 'post-1', authorId: 'user-123', parentId: null, deletedAt: null, createdAt: new Date() }, false);
      commentRepository.findById.mockResolvedValue(mockComment);

      await service.updateComment('comment-1', 'New Content', 'cat-1');
      expect(mockComment.content).toBe('New Content');
      expect(commentRepository.save).toHaveBeenCalledWith(mockComment);
    });

    it('should delete a comment', async () => {
      const mockComment = Comment.create({ id: 'comment-1', content: 'Content', postId: 'post-1', authorId: 'user-123', parentId: null, deletedAt: null, createdAt: new Date() }, false);
      commentRepository.findById.mockResolvedValue(mockComment);

      await service.deleteComment('comment-1');
      expect(mockComment.deletedAt).not.toBeNull();
      expect(commentRepository.save).toHaveBeenCalledWith(mockComment);
    });
  });

  describe('Engagements', () => {
    it('should toggle post upvote on', async () => {
      postRepository.findById.mockResolvedValue(true); // Exists
      engagementRepository.findPostUpvote.mockResolvedValue(null);

      const result = await service.togglePostUpvote('post-1', 'user-123');
      expect(result).toBe(true);
      expect(engagementRepository.savePostUpvote).toHaveBeenCalled();
    });

    it('should toggle post upvote off', async () => {
      postRepository.findById.mockResolvedValue(true);
      engagementRepository.findPostUpvote.mockResolvedValue({}); // Exists

      const result = await service.togglePostUpvote('post-1', 'user-123');
      expect(result).toBe(false);
      expect(engagementRepository.deletePostUpvote).toHaveBeenCalledWith('post-1', 'user-123');
    });

    it('should toggle post bookmark on', async () => {
      postRepository.findById.mockResolvedValue(true);
      engagementRepository.findPostBookmark.mockResolvedValue(null);

      const result = await service.togglePostBookmark('post-1', 'user-123');
      expect(result).toBe(true);
      expect(engagementRepository.savePostBookmark).toHaveBeenCalled();
    });

    it('should toggle post bookmark off', async () => {
      postRepository.findById.mockResolvedValue(true);
      engagementRepository.findPostBookmark.mockResolvedValue({});

      const result = await service.togglePostBookmark('post-1', 'user-123');
      expect(result).toBe(false);
      expect(engagementRepository.deletePostBookmark).toHaveBeenCalledWith('post-1', 'user-123');
    });

    it('should toggle comment upvote on', async () => {
      commentRepository.findById.mockResolvedValue(true);
      engagementRepository.findCommentUpvote.mockResolvedValue(null);

      const result = await service.toggleCommentUpvote('comment-1', 'user-123');
      expect(result).toBe(true);
      expect(engagementRepository.saveCommentUpvote).toHaveBeenCalled();
    });

    it('should toggle comment upvote off', async () => {
      commentRepository.findById.mockResolvedValue(true);
      engagementRepository.findCommentUpvote.mockResolvedValue({});

      const result = await service.toggleCommentUpvote('comment-1', 'user-123');
      expect(result).toBe(false);
      expect(engagementRepository.deleteCommentUpvote).toHaveBeenCalledWith('comment-1', 'user-123');
    });

    it('should toggle comment bookmark on', async () => {
      commentRepository.findById.mockResolvedValue(true);
      engagementRepository.findCommentBookmark.mockResolvedValue(null);

      const result = await service.toggleCommentBookmark('comment-1', 'user-123');
      expect(result).toBe(true);
      expect(engagementRepository.saveCommentBookmark).toHaveBeenCalled();
    });

    it('should toggle comment bookmark off', async () => {
      commentRepository.findById.mockResolvedValue(true);
      engagementRepository.findCommentBookmark.mockResolvedValue({});

      const result = await service.toggleCommentBookmark('comment-1', 'user-123');
      expect(result).toBe(false);
      expect(engagementRepository.deleteCommentBookmark).toHaveBeenCalledWith('comment-1', 'user-123');
    });
  });
});
