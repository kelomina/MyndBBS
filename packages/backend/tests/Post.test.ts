import { PostStatus } from '@myndbbs/shared';
import { Post, CreatePostProps } from '../src/domain/community/Post';

describe('Post Aggregate Root', () => {
  const validProps: CreatePostProps = {
    id: 'post-1',
    title: 'Valid Title',
    content: 'Valid Content',
    categoryId: 'cat-1',
    authorId: 'user-1',
    createdAt: new Date('2023-01-01T00:00:00Z'),
  };

  describe('create()', () => {
    it('should create a published post when isModerated is false', () => {
      const post = Post.create(validProps, false);
      
      expect(post.id).toBe(validProps.id);
      expect(post.title).toBe(validProps.title);
      expect(post.content).toBe(validProps.content);
      expect(post.categoryId).toBe(validProps.categoryId);
      expect(post.authorId).toBe(validProps.authorId);
      expect(post.createdAt).toBe(validProps.createdAt);
      expect(post.status).toBe(PostStatus.PUBLISHED);
    });

    it('should create a pending moderation post when isModerated is true', () => {
      const post = Post.create(validProps, true);
      expect(post.status).toBe(PostStatus.PENDING);
    });

    it('should throw an error if title is empty', () => {
      expect(() => Post.create({ ...validProps, title: '' }, false)).toThrow('ERR_POST_TITLE_CANNOT_BE_EMPTY');
      expect(() => Post.create({ ...validProps, title: '   ' }, false)).toThrow('ERR_POST_TITLE_CANNOT_BE_EMPTY');
    });

    it('should throw an error if content is empty', () => {
      expect(() => Post.create({ ...validProps, content: '' }, false)).toThrow('ERR_POST_CONTENT_CANNOT_BE_EMPTY');
      expect(() => Post.create({ ...validProps, content: '   ' }, false)).toThrow('ERR_POST_CONTENT_CANNOT_BE_EMPTY');
    });
  });

  describe('load()', () => {
    it('should reconstitute a Post entity from existing props', () => {
      const existingProps = {
        ...validProps,
        status: PostStatus.ARCHIVED,
      };
      
      const post = Post.load(existingProps);
      
      expect(post.id).toBe(existingProps.id);
      expect(post.status).toBe(PostStatus.ARCHIVED);
    });
  });

  describe('updateContent()', () => {
    it('should update title, content, and categoryId', () => {
      const post = Post.create(validProps, false);
      post.updateContent('New Title', 'New Content', 'cat-2', false);
      
      expect(post.title).toBe('New Title');
      expect(post.content).toBe('New Content');
      expect(post.categoryId).toBe('cat-2');
      expect(post.status).toBe(PostStatus.PUBLISHED);
    });

    it('should trim updated title and content', () => {
      const post = Post.create(validProps, false);
      post.updateContent('  Trimmed Title  ', '  Trimmed Content  ', 'cat-2', false);
      
      expect(post.title).toBe('Trimmed Title');
      expect(post.content).toBe('Trimmed Content');
    });

    it('should ignore empty string updates for title and content', () => {
      const post = Post.create(validProps, false);
      post.updateContent('', '   ', '', false);
      
      expect(post.title).toBe(validProps.title);
      expect(post.content).toBe(validProps.content);
      // categoryId update will be ignored if empty, based on the implementation: `if (categoryId) this.props.categoryId = categoryId;`
      expect(post.categoryId).toBe(validProps.categoryId);
    });

    it('should change status to PENDING if isModerated is true', () => {
      const post = Post.create(validProps, false);
      expect(post.status).toBe(PostStatus.PUBLISHED);
      
      post.updateContent('New Title', 'New Content', 'cat-2', true);
      expect(post.status).toBe(PostStatus.PENDING);
    });

    it('should change status to PUBLISHED if updated and isModerated is false, and was pending', () => {
      const post = Post.create(validProps, true);
      expect(post.status).toBe(PostStatus.PENDING);
      
      post.updateContent('New Title', 'New Content', 'cat-2', false);
      expect(post.status).toBe(PostStatus.PUBLISHED);
    });
    
    it('should change status to PUBLISHED if updated and isModerated is false, and was PENDING', () => {
      const post = Post.load({ ...validProps, status: PostStatus.PENDING });
      post.updateContent('New Title', 'New Content', 'cat-2', false);
      expect(post.status).toBe(PostStatus.PUBLISHED);
    });
  });

  describe('approve()', () => {
    it('should approve a pending moderation post', () => {
      const post = Post.create(validProps, true);
      post.approve();
      expect(post.status).toBe(PostStatus.PUBLISHED);
    });

    it('should approve a PENDING post', () => {
      const post = Post.load({ ...validProps, status: PostStatus.PENDING });
      post.approve();
      expect(post.status).toBe(PostStatus.PUBLISHED);
    });

    it('should throw an error if not pending', () => {
      const post = Post.create(validProps, false);
      expect(() => post.approve()).toThrow('ERR_POST_NOT_PENDING');
    });
  });

  describe('reject()', () => {
    it('should reject a pending moderation post', () => {
      const post = Post.create(validProps, true);
      post.reject();
      expect(post.status).toBe(PostStatus.DELETED);
    });

    it('should reject a PENDING post', () => {
      const post = Post.load({ ...validProps, status: PostStatus.PENDING });
      post.reject();
      expect(post.status).toBe(PostStatus.DELETED);
    });

    it('should throw an error if not pending', () => {
      const post = Post.create(validProps, false);
      expect(() => post.reject()).toThrow('ERR_POST_NOT_PENDING');
    });
  });

  describe('changeStatus()', () => {
    it('should change status directly', () => {
      const post = Post.create(validProps, false);
      post.changeStatus(PostStatus.ARCHIVED);
      expect(post.status).toBe(PostStatus.ARCHIVED);
    });
  });

  describe('delete()', () => {
    it('should soft delete a post', () => {
      const post = Post.create(validProps, false);
      post.delete();
      expect(post.status).toBe(PostStatus.DELETED);
    });
  });

  describe('restore()', () => {
    it('should restore a deleted post to published', () => {
      const post = Post.load({ ...validProps, status: PostStatus.DELETED });
      post.restore();
      expect(post.status).toBe(PostStatus.PUBLISHED);
    });

    it('should throw an error if not deleted', () => {
      const post = Post.create(validProps, false);
      expect(() => post.restore()).toThrow('ERR_POST_NOT_DELETED');
    });
  });
});
