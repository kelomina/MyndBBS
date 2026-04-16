import { Comment, CreateCommentProps, CommentProps } from '../../../src/domain/community/Comment';

describe('Comment Aggregate Root', () => {
  const validProps: CreateCommentProps = {
    id: 'comment-1',
    content: 'Valid Comment Content',
    postId: 'post-1',
    authorId: 'user-1',
    parentId: null,
    deletedAt: null,
    createdAt: new Date('2023-01-01T00:00:00Z'),
  };

  describe('create()', () => {
    it('should create a published comment when isModerated is false', () => {
      const comment = Comment.create(validProps, false);
      
      expect(comment.id).toBe(validProps.id);
      expect(comment.content).toBe(validProps.content);
      expect(comment.postId).toBe(validProps.postId);
      expect(comment.authorId).toBe(validProps.authorId);
      expect(comment.parentId).toBe(validProps.parentId);
      expect(comment.deletedAt).toBe(validProps.deletedAt);
      expect(comment.createdAt).toBe(validProps.createdAt);
      expect(comment.isPending).toBe(false);
    });

    it('should create a pending moderation comment when isModerated is true', () => {
      const comment = Comment.create(validProps, true);
      expect(comment.isPending).toBe(true);
    });

    it('should throw an error if content is empty', () => {
      expect(() => Comment.create({ ...validProps, content: '' }, false)).toThrow('ERR_COMMENT_CONTENT_CANNOT_BE_EMPTY');
      expect(() => Comment.create({ ...validProps, content: '   ' }, false)).toThrow('ERR_COMMENT_CONTENT_CANNOT_BE_EMPTY');
    });
  });

  describe('load()', () => {
    it('should reconstitute a Comment entity from existing props', () => {
      const existingProps: CommentProps = {
        ...validProps,
        isPending: true,
        deletedAt: new Date('2023-01-02T00:00:00Z'),
      };
      
      const comment = Comment.load(existingProps);
      
      expect(comment.id).toBe(existingProps.id);
      expect(comment.isPending).toBe(true);
      expect(comment.deletedAt).toBe(existingProps.deletedAt);
    });
  });

  describe('updateContent()', () => {
    it('should update content and trim it', () => {
      const comment = Comment.create(validProps, false);
      comment.updateContent('  New Trimmed Content  ', false);
      
      expect(comment.content).toBe('New Trimmed Content');
      expect(comment.isPending).toBe(false);
    });

    it('should ignore empty string updates for content', () => {
      const comment = Comment.create(validProps, false);
      comment.updateContent('   ', false);
      
      expect(comment.content).toBe(validProps.content);
    });

    it('should change status to pending if isModerated is true', () => {
      const comment = Comment.create(validProps, false);
      expect(comment.isPending).toBe(false);
      
      comment.updateContent('Updated Content', true);
      expect(comment.isPending).toBe(true);
    });

    it('should change status to not pending if updated and isModerated is false, and was pending', () => {
      const comment = Comment.create(validProps, true);
      expect(comment.isPending).toBe(true);
      
      comment.updateContent('Updated Content', false);
      expect(comment.isPending).toBe(false);
    });
  });

  describe('approve()', () => {
    it('should approve a pending comment', () => {
      const comment = Comment.create(validProps, true);
      comment.approve();
      expect(comment.isPending).toBe(false);
    });

    it('should throw an error if not pending', () => {
      const comment = Comment.create(validProps, false);
      expect(() => comment.approve()).toThrow('ERR_COMMENT_NOT_PENDING');
    });
  });

  describe('delete()', () => {
    it('should soft delete a comment and clear pending status', () => {
      const comment = Comment.create(validProps, true);
      expect(comment.isPending).toBe(true);
      
      comment.delete();
      expect(comment.deletedAt).toBeInstanceOf(Date);
      expect(comment.isPending).toBe(false);
    });

    it('should throw an error if already deleted', () => {
      const comment = Comment.create(validProps, false);
      comment.delete();
      expect(() => comment.delete()).toThrow('ERR_COMMENT_ALREADY_DELETED');
    });
  });

  describe('restore()', () => {
    it('should restore a soft-deleted comment', () => {
      const existingProps: CommentProps = {
        ...validProps,
        isPending: false,
        deletedAt: new Date(),
      };
      const comment = Comment.load(existingProps);
      
      comment.restore();
      expect(comment.deletedAt).toBeNull();
    });

    it('should throw an error if not deleted', () => {
      const comment = Comment.create(validProps, false);
      expect(() => comment.restore()).toThrow('ERR_COMMENT_NOT_DELETED');
    });
  });
});
