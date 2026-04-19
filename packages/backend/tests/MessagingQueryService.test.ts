import { messagingQueryService } from '../src/queries/messaging/MessagingQueryService';
import { prisma } from '../src/db';

jest.mock('../src/db', () => ({
  prisma: {
    friendship: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    privateMessage: {
      count: jest.fn(),
    },
  },
}));

describe('MessagingQueryService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('listFriends', () => {
    it('should map friends correctly including requester and addressee data', async () => {
      const mockFriends = [
        {
          id: 'friendship-1',
          requesterId: 'user-1',
          addresseeId: 'user-2',
          status: 'PENDING',
          createdAt: new Date(),
          requester: { id: 'user-1', username: 'requester-username' },
          addressee: { id: 'user-2', username: 'addressee-username' },
        },
      ];

      (prisma.friendship.findMany as jest.Mock).mockResolvedValue(mockFriends);

      const result = await messagingQueryService.listFriends('user-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'friendship-1',
        requesterId: 'user-1',
        addresseeId: 'user-2',
        status: 'PENDING',
        createdAt: mockFriends[0].createdAt,
        requester: { id: 'user-1', username: 'requester-username' },
        addressee: { id: 'user-2', username: 'addressee-username' },
      });
      expect(prisma.friendship.findMany).toHaveBeenCalledWith({
        where: { OR: [{ requesterId: 'user-1' }, { addresseeId: 'user-1' }] },
        include: {
          requester: { select: { id: true, username: true } },
          addressee: { select: { id: true, username: true } },
        },
      });
    });
  });

  describe('getUnreadCount', () => {
    it('should return the sum of unread private messages and pending friend requests', async () => {
      (prisma.privateMessage.count as jest.Mock).mockResolvedValue(3);
      (prisma.friendship.count as jest.Mock).mockResolvedValue(2);

      const result = await messagingQueryService.getUnreadCount('user-1');

      expect(result).toBe(5);
      expect(prisma.privateMessage.count).toHaveBeenCalledWith({
        where: { receiverId: 'user-1', isRead: false },
      });
      expect(prisma.friendship.count).toHaveBeenCalledWith({
        where: { addresseeId: 'user-1', status: 'PENDING' },
      });
    });
  });
});
