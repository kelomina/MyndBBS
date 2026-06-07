import { NotificationApplicationService } from '../../src/application/notification/NotificationApplicationService';
import { Notification } from '../../src/domain/notification/Notification';

describe('NotificationApplicationService', () => {
  let service: NotificationApplicationService;
  let mocks: any;
  let eventBus: any;

  beforeEach(() => {
    eventBus = {
      subscribe: jest.fn(),
    };

    mocks = {
      notificationRepository: {
        findById: jest.fn(),
        save: jest.fn(),
        delete: jest.fn(),
        findByUserId: jest.fn(),
      },
      eventBus,
      moderatorReadModel: {
        listUserIdsByLevel: jest.fn().mockResolvedValue([{ id: 'mod-1' }, { id: 'mod-2' }]),
      },
      unitOfWork: {
        execute: jest.fn((fn: any) => fn()),
      },
    };

    service = new NotificationApplicationService(
      mocks.notificationRepository,
      mocks.eventBus,
      mocks.moderatorReadModel,
      mocks.unitOfWork,
    );
  });

  describe('markAsRead', () => {
    it('should mark notification as read when user owns it', async () => {
      const notification = Notification.create({
        id: 'notif-1',
        userId: 'user-1',
        type: 'POST_REPLIED',
        title: 'New Reply',
        content: 'Someone replied to your post.',
        relatedId: 'post-1',
        read: false,
        createdAt: new Date(),
      });
      mocks.notificationRepository.findById.mockResolvedValue(notification);

      await service.markAsRead('notif-1', 'user-1');

      expect(notification.read).toBe(true);
      expect(mocks.notificationRepository.save).toHaveBeenCalledWith(notification);
    });

    it('should throw when notification not found', async () => {
      mocks.notificationRepository.findById.mockResolvedValue(null);

      await expect(service.markAsRead('notif-1', 'user-1')).rejects.toThrow('ERR_NOTIFICATION_NOT_FOUND');
    });

    it('should throw when notification does not belong to user', async () => {
      const notification = Notification.create({
        id: 'notif-1',
        userId: 'user-2',
        type: 'POST_REPLIED',
        title: 'New Reply',
        content: 'Someone replied to your post.',
        relatedId: 'post-1',
        read: false,
        createdAt: new Date(),
      });
      mocks.notificationRepository.findById.mockResolvedValue(notification);

      await expect(service.markAsRead('notif-1', 'user-1')).rejects.toThrow('ERR_FORBIDDEN_NOT_YOUR_NOTIFICATION');
    });
  });

  describe('event handlers', () => {
    it('should subscribe to PostApprovedEvent', () => {
      expect(eventBus.subscribe).toHaveBeenCalledWith('PostApprovedEvent', expect.any(Function));
    });

    it('should subscribe to PostRejectedEvent', () => {
      expect(eventBus.subscribe).toHaveBeenCalledWith('PostRejectedEvent', expect.any(Function));
    });

    it('should subscribe to PostRepliedEvent', () => {
      expect(eventBus.subscribe).toHaveBeenCalledWith('PostRepliedEvent', expect.any(Function));
    });

    it('should subscribe to CommentRepliedEvent', () => {
      expect(eventBus.subscribe).toHaveBeenCalledWith('CommentRepliedEvent', expect.any(Function));
    });

    it('should subscribe to SystemAlertEvent', () => {
      expect(eventBus.subscribe).toHaveBeenCalledWith('SystemAlertEvent', expect.any(Function));
    });

    it('should create notification on PostApprovedEvent', async () => {
      const handlers = eventBus.subscribe.mock.calls;
      const postApprovedHandler = handlers.find((h: any[]) => h[0] === 'PostApprovedEvent')?.[1];

      expect(postApprovedHandler).toBeDefined();

      await postApprovedHandler({
        authorId: 'user-1',
        postTitle: 'Test Post',
        postId: 'post-1',
      });

      expect(mocks.notificationRepository.save).toHaveBeenCalled();
      const savedNotification = (mocks.notificationRepository.save as jest.Mock).mock.calls[0][0];
      expect(savedNotification.type).toBe('POST_APPROVED');
      expect(savedNotification.userId).toBe('user-1');
    });

    it('should create notification on PostRejectedEvent', async () => {
      const handlers = eventBus.subscribe.mock.calls;
      const postRejectedHandler = handlers.find((h: any[]) => h[0] === 'PostRejectedEvent')?.[1];

      await postRejectedHandler({
        authorId: 'user-1',
        postTitle: 'Test Post',
        postId: 'post-1',
        reason: 'Inappropriate content',
      });

      const savedNotification = (mocks.notificationRepository.save as jest.Mock).mock.calls[0][0];
      expect(savedNotification.type).toBe('POST_REJECTED');
      expect(savedNotification.content).toContain('Inappropriate content');
    });

    it('should not notify self on PostRepliedEvent', async () => {
      const handlers = eventBus.subscribe.mock.calls;
      const postRepliedHandler = handlers.find((h: any[]) => h[0] === 'PostRepliedEvent')?.[1];

      await postRepliedHandler({
        authorId: 'user-1',
        replierId: 'user-1',
        postTitle: 'Test Post',
        postId: 'post-1',
      });

      expect(mocks.notificationRepository.save).not.toHaveBeenCalled();
    });

    it('should create notification on PostRepliedEvent when different user', async () => {
      const handlers = eventBus.subscribe.mock.calls;
      const postRepliedHandler = handlers.find((h: any[]) => h[0] === 'PostRepliedEvent')?.[1];

      await postRepliedHandler({
        authorId: 'user-1',
        replierId: 'user-2',
        postTitle: 'Test Post',
        postId: 'post-1',
      });

      expect(mocks.notificationRepository.save).toHaveBeenCalled();
    });

    it('should create notification on CommentRepliedEvent', async () => {
      const handlers = eventBus.subscribe.mock.calls;
      const commentRepliedHandler = handlers.find((h: any[]) => h[0] === 'CommentRepliedEvent')?.[1];

      await commentRepliedHandler({
        authorId: 'user-1',
        replierId: 'user-2',
        postId: 'post-1',
      });

      const savedNotification = (mocks.notificationRepository.save as jest.Mock).mock.calls[0][0];
      expect(savedNotification.type).toBe('COMMENT_REPLIED');
    });

    it('should notify moderators on SystemAlertEvent', async () => {
      const handlers = eventBus.subscribe.mock.calls;
      const systemAlertHandler = handlers.find((h: any[]) => h[0] === 'SystemAlertEvent')?.[1];

      await systemAlertHandler({
        title: 'System Alert',
        content: 'Something happened',
      });

      expect(mocks.notificationRepository.save).toHaveBeenCalledTimes(2);
    });

    it('should not create notification on SystemAlertEvent without title', async () => {
      const handlers = eventBus.subscribe.mock.calls;
      const systemAlertHandler = handlers.find((h: any[]) => h[0] === 'SystemAlertEvent')?.[1];

      await systemAlertHandler({
        content: 'Something happened',
      });

      expect(mocks.notificationRepository.save).not.toHaveBeenCalled();
    });
  });
});
