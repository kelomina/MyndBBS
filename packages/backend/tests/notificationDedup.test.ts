import { CommunityApplicationService } from '../src/application/community/CommunityApplicationService'
import { Category } from '../src/domain/community/Category'
import { Post } from '../src/domain/community/Post'
import { Comment } from '../src/domain/community/Comment'
import { PostRepliedEvent, CommentRepliedEvent } from '../src/domain/shared/events/DomainEvents'

describe('notification dedup (postAuthorId emission-side)', () => {
  function makeService(deps: { mentionNotifier?: { notifyMentions: jest.Mock } } = {}) {
    const categoryRepository = { findById: jest.fn() }
    const postRepository = { findById: jest.fn() }
    const commentRepository = { findById: jest.fn(), save: jest.fn() }
    const engagementRepository = {}
    const moderationPolicy = { containsModeratedWord: jest.fn().mockResolvedValue(false) }
    const captchaValidator = { consumeCaptcha: jest.fn().mockResolvedValue(true) }
    const eventBus = { publish: jest.fn().mockResolvedValue(undefined) }
    const service = new CommunityApplicationService({
      categoryRepository: categoryRepository as never,
      postRepository: postRepository as never,
      commentRepository: commentRepository as never,
      engagementRepository: engagementRepository as never,
      identityIntegrationPort: {} as never,
      moderationPolicy: moderationPolicy as never,
      captchaValidator: captchaValidator as never,
      eventBus: eventBus as never,
      auditApplicationService: { logAudit: jest.fn() } as never,
      unitOfWork: { execute: jest.fn((w: () => unknown) => w()) } as never,
      ...(deps.mentionNotifier ? { mentionNotifier: deps.mentionNotifier } : {}),
    })
    return { service, categoryRepository, postRepository, commentRepository, eventBus }
  }

  function allowAbility() {
    return { can: jest.fn().mockReturnValue(true) } as never
  }

  it('@==post author skips MENTION (postAuthorId passed, single POST_REPLIED)', async () => {
    const notifyMentions = jest.fn().mockResolvedValue(undefined)
    const { service, postRepository, commentRepository, categoryRepository, eventBus } =
      makeService({ mentionNotifier: { notifyMentions } })
    const post = Post.create(
      {
        id: 'post-1',
        title: 'T',
        content: 'C',
        categoryId: 'cat-1',
        authorId: 'user-B',
        createdAt: new Date(),
      },
      false,
    )
    const category = Category.create({
      id: 'cat-1',
      name: 'Cat',
      description: null,
      sortOrder: 0,
      minLevel: 0,
      moderatorIds: [],
      createdAt: new Date(),
    })
    postRepository.findById.mockResolvedValue(post)
    categoryRepository.findById.mockResolvedValue(category)
    // 直接回帖且正文 @B（B=帖主）
    await service.createComment(allowAbility(), 'hi @user-B', 'post-1', 'user-A', 'captcha-1')
    expect(commentRepository.save).toHaveBeenCalled()
    expect(eventBus.publish).toHaveBeenCalledWith(expect.any(PostRepliedEvent))
    // MentionNotifier 收到 postAuthorId=B，可据此跳过 MENTION 行
    expect(notifyMentions).toHaveBeenCalledWith(
      expect.objectContaining({ postAuthorId: 'user-B', authorId: 'user-A' }),
    )
  })

  it('parent==post author only emits POST_REPLIED (skips COMMENT_REPLIED)', async () => {
    const { service, postRepository, commentRepository, categoryRepository, eventBus } =
      makeService()
    const post = Post.create(
      {
        id: 'post-1',
        title: 'T',
        content: 'C',
        categoryId: 'cat-1',
        authorId: 'user-B',
        createdAt: new Date(),
      },
      false,
    )
    // 父评论作者 == 帖主 B
    const parent = Comment.create(
      {
        id: 'c-parent',
        content: 'P',
        postId: 'post-1',
        authorId: 'user-B',
        parentId: null,
        deletedAt: null,
        createdAt: new Date(),
      },
      false,
    )
    const category = Category.create({
      id: 'cat-1',
      name: 'Cat',
      description: null,
      sortOrder: 0,
      minLevel: 0,
      moderatorIds: [],
      createdAt: new Date(),
    })
    postRepository.findById.mockResolvedValue(post)
    categoryRepository.findById.mockResolvedValue(category)
    commentRepository.findById.mockResolvedValue(parent)
    await service.createComment(
      allowAbility(),
      'reply',
      'post-1',
      'user-A',
      'captcha-1',
      'c-parent',
    )
    const published = eventBus.publish.mock.calls.map((c) => c[0])
    expect(published.some((e) => e instanceof PostRepliedEvent)).toBe(true)
    expect(published.some((e) => e instanceof CommentRepliedEvent)).toBe(false)
  })

  it('parent!=post author emits both POST_REPLIED and COMMENT_REPLIED', async () => {
    const { service, postRepository, commentRepository, categoryRepository, eventBus } =
      makeService()
    const post = Post.create(
      {
        id: 'post-1',
        title: 'T',
        content: 'C',
        categoryId: 'cat-1',
        authorId: 'user-B',
        createdAt: new Date(),
      },
      false,
    )
    const parent = Comment.create(
      {
        id: 'c-parent',
        content: 'P',
        postId: 'post-1',
        authorId: 'user-C',
        parentId: null,
        deletedAt: null,
        createdAt: new Date(),
      },
      false,
    )
    const category = Category.create({
      id: 'cat-1',
      name: 'Cat',
      description: null,
      sortOrder: 0,
      minLevel: 0,
      moderatorIds: [],
      createdAt: new Date(),
    })
    postRepository.findById.mockResolvedValue(post)
    categoryRepository.findById.mockResolvedValue(category)
    commentRepository.findById.mockResolvedValue(parent)
    await service.createComment(
      allowAbility(),
      'reply',
      'post-1',
      'user-A',
      'captcha-1',
      'c-parent',
    )
    const published = eventBus.publish.mock.calls.map((c) => c[0])
    expect(published.some((e) => e instanceof PostRepliedEvent)).toBe(true)
    expect(published.some((e) => e instanceof CommentRepliedEvent)).toBe(true)
  })

  it('self reply emits neither (double guard preserved)', async () => {
    const { service, postRepository, categoryRepository, eventBus } = makeService()
    const post = Post.create(
      {
        id: 'post-1',
        title: 'T',
        content: 'C',
        categoryId: 'cat-1',
        authorId: 'user-A',
        createdAt: new Date(),
      },
      false,
    )
    const category = Category.create({
      id: 'cat-1',
      name: 'Cat',
      description: null,
      sortOrder: 0,
      minLevel: 0,
      moderatorIds: [],
      createdAt: new Date(),
    })
    postRepository.findById.mockResolvedValue(post)
    categoryRepository.findById.mockResolvedValue(category)
    await service.createComment(allowAbility(), 'self', 'post-1', 'user-A', 'captcha-1')
    expect(eventBus.publish).not.toHaveBeenCalled()
  })
})
