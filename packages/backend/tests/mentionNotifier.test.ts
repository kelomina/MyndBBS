import { MentionNotifier } from '../src/application/notification/MentionNotifier'
import { prisma } from '../src/db'

jest.mock('../src/db', () => ({
  prisma: { user: { findMany: jest.fn() }, notification: { create: jest.fn() } },
}))

jest.mock('../src/infrastructure/events/EventBusFactory', () => ({
  getEventBus: () => ({ publish: jest.fn().mockResolvedValue(undefined) }),
}))

describe('MentionNotifier postAuthorId dedup', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('skips MENTION when mentioned user is post author', async () => {
    ;(prisma.user.findMany as jest.Mock).mockResolvedValue([{ id: 'user-B' }, { id: 'user-C' }])
    ;(prisma.notification.create as jest.Mock).mockResolvedValue({})
    const notifier = new MentionNotifier()
    await notifier.notifyMentions({
      content: 'hi @user-b and @user-c',
      authorId: 'user-A',
      postId: 'post-1',
      commentId: 'comment-1',
      postAuthorId: 'user-B',
    })
    // 仅 C 落库，B 跳过（已收 POST_REPLIED）
    expect(prisma.notification.create).toHaveBeenCalledTimes(1)
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'user-C' }) }),
    )
    const created = (prisma.notification.create as jest.Mock).mock.calls[0][0]
    expect(created.data.commentId).toBe('comment-1')
    expect(created.data.relatedId).toBe('post-1')
  })

  it('still notifies non-author mentions and persists commentId', async () => {
    ;(prisma.user.findMany as jest.Mock).mockResolvedValue([{ id: 'user-C' }])
    ;(prisma.notification.create as jest.Mock).mockResolvedValue({})
    const notifier = new MentionNotifier()
    await notifier.notifyMentions({
      content: '@user-c look',
      authorId: 'user-A',
      postId: 'post-1',
      commentId: 'comment-2',
      postAuthorId: 'user-B',
    })
    expect(prisma.notification.create).toHaveBeenCalledTimes(1)
  })

  it('skips self mentions (author) without DB write', async () => {
    ;(prisma.user.findMany as jest.Mock).mockResolvedValue([{ id: 'user-A' }])
    const notifier = new MentionNotifier()
    await notifier.notifyMentions({
      content: '@user-a self',
      authorId: 'user-A',
      postId: 'post-1',
      commentId: 'comment-3',
      postAuthorId: 'user-B',
    })
    expect(prisma.notification.create).not.toHaveBeenCalled()
  })
})
