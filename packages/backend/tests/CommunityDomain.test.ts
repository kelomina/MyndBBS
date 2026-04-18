import { Category } from '../src/domain/community/Category';
import { Post } from '../src/domain/community/Post';
import { Comment } from '../src/domain/community/Comment';
import { CategoryCreatedEvent, CategoryUpdatedEvent, CategoryModeratorAssignedEvent, CategoryModeratorRemovedEvent, PostApprovedEvent, PostRejectedEvent } from '../src/domain/shared/events/DomainEvents';

describe('Community Domain DDD Principles', () => {
  describe('Category Aggregate', () => {
    it('should generate CategoryCreatedEvent when created with operatorId', () => {
      const category = Category.create({
        id: 'cat-1',
        name: 'Test Category',
        description: 'Test Description',
        sortOrder: 1,
        minLevel: 0,
        moderatorIds: [],
        createdAt: new Date()
      }, 'op-1');

      expect(category.domainEvents).toHaveLength(1);
      expect(category.domainEvents[0]).toBeInstanceOf(CategoryCreatedEvent);
      expect((category.domainEvents[0] as CategoryCreatedEvent).operatorId).toBe('op-1');
    });

    it('should generate CategoryUpdatedEvent when updated with operatorId', () => {
      const category = Category.create({
        id: 'cat-1',
        name: 'Test Category',
        description: 'Test Description',
        sortOrder: 1,
        minLevel: 0,
        moderatorIds: [],
        createdAt: new Date()
      });
      category.clearDomainEvents();

      category.updateDetails('New Name', 'New Desc', 2, 'op-2');
      expect(category.domainEvents).toHaveLength(1);
      expect(category.domainEvents[0]).toBeInstanceOf(CategoryUpdatedEvent);
      expect((category.domainEvents[0] as CategoryUpdatedEvent).operatorId).toBe('op-2');
    });

    it('should generate CategoryModeratorAssignedEvent when moderator added', () => {
      const category = Category.create({
        id: 'cat-1',
        name: 'Test Category',
        description: null,
        sortOrder: 1,
        minLevel: 0,
        moderatorIds: [],
        createdAt: new Date()
      });
      category.clearDomainEvents();

      category.addModerator('user-1', 'op-3');
      expect(category.domainEvents).toHaveLength(1);
      expect(category.domainEvents[0]).toBeInstanceOf(CategoryModeratorAssignedEvent);
    });

    it('should generate CategoryModeratorRemovedEvent when moderator removed', () => {
      const category = Category.create({
        id: 'cat-1',
        name: 'Test Category',
        description: null,
        sortOrder: 1,
        minLevel: 0,
        moderatorIds: ['user-1'],
        createdAt: new Date()
      });
      category.clearDomainEvents();

      category.removeModerator('user-1', 'op-4');
      expect(category.domainEvents).toHaveLength(1);
      expect(category.domainEvents[0]).toBeInstanceOf(CategoryModeratorRemovedEvent);
    });
  });

  describe('Post Aggregate', () => {
    it('should generate PostApprovedEvent when approved', () => {
      const post = Post.create({
        id: 'post-1',
        title: 'Test Post',
        content: 'Test Content',
        categoryId: 'cat-1',
        authorId: 'author-1',
        createdAt: new Date()
      }, true); // isModerated = true -> PENDING
      
      expect(post.domainEvents).toHaveLength(0);

      post.approve();
      expect(post.domainEvents).toHaveLength(1);
      expect(post.domainEvents[0]).toBeInstanceOf(PostApprovedEvent);
    });

    it('should generate PostRejectedEvent when rejected', () => {
      const post = Post.create({
        id: 'post-1',
        title: 'Test Post',
        content: 'Test Content',
        categoryId: 'cat-1',
        authorId: 'author-1',
        createdAt: new Date()
      }, true); // isModerated = true -> PENDING

      post.reject('Spam');
      expect(post.domainEvents).toHaveLength(1);
      expect(post.domainEvents[0]).toBeInstanceOf(PostRejectedEvent);
      expect((post.domainEvents[0] as PostRejectedEvent).reason).toBe('Spam');
    });
  });
});