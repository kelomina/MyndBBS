import { ICategoryRepository } from '../../domain/community/ICategoryRepository'
import { IPostRepository } from '../../domain/community/IPostRepository'
import { ICommentRepository } from '../../domain/community/ICommentRepository'
import { IEngagementRepository } from '../../domain/community/IEngagementRepository'
import { IIdentityIntegrationPort } from '../../domain/community/IIdentityIntegrationPort'
import { Category } from '../../domain/community/Category'
import { Post } from '../../domain/community/Post'
import { PostStatus } from '@myndbbs/shared'
import { Comment } from '../../domain/community/Comment'
import { PostUpvote, PostBookmark } from '../../domain/community/PostEngagement'
import { CommentUpvote, CommentBookmark } from '../../domain/community/CommentEngagement'
import { randomUUID as uuidv4 } from 'crypto'
import { IModerationPolicy } from '../../domain/community/IModerationPolicy'

import { ICaptchaValidator } from '../../domain/community/ICaptchaValidator'
import { IEventBus } from '../../domain/shared/events/IEventBus'
import {
  PostRepliedEvent,
  CommentRepliedEvent,
  CategoryModeratorAssignedEvent,
  CategoryModeratorRemovedEvent,
  CategoryCreatedEvent,
  CategoryUpdatedEvent,
  CategoryDeletedEvent,
} from '../../domain/shared/events/DomainEvents'
import { AnyAbility, subject } from '@casl/ability'
import { IUnitOfWork } from '../../domain/shared/IUnitOfWork'
import { AuditApplicationService } from '../system/AuditApplicationService'

/**
 * Function: class CommunityApplicationService
 * --------------------------------------------
 * 社区限界上下文的应用服务。编排分类管理、帖子/评论的创建/编辑/删除以及用户互动（点赞/收藏）。
 * 负责验证码消费、内容审核检查、权限校验和领域事件发布。
 *
 * The Application Service for the Community Domain. Orchestrates category management,
 * post/comment CRUD operations, and user engagements (upvote/bookmark). Responsible for
 * captcha consumption, content moderation checks, authorization verification, and domain
 * event publishing.
 *
 * Callers: [AdminController, PostController]
 * Called by: [AdminController, PostController]
 *
 * Callees: [ICategoryRepository, IPostRepository, ICommentRepository, IEngagementRepository,
 *           IIdentityIntegrationPort, IModerationPolicy, ICaptchaValidator, IEventBus,
 *           IUnitOfWork, AuditApplicationService]
 * Calls: [ICategoryRepository, IPostRepository, ICommentRepository, IEngagementRepository,
 *         IIdentityIntegrationPort, IModerationPolicy, ICaptchaValidator, IEventBus,
 *         IUnitOfWork, AuditApplicationService]
 *
 * Keywords: community, service, application, orchestration, category, post, comment,
 *           engagement, moderation, 社区, 服务, 应用, 编排, 分类, 帖子, 评论, 互动, 审核
 */
export class CommunityApplicationService {
  /**
   * Function: constructor
   * ----------------------
   * 通过依赖注入初始化服务实例。
   *
   * Initializes the service instance via Dependency Injection.
   *
   * Parameters:
   * - categoryRepository: ICategoryRepository, 分类仓储 / category repository
   * - postRepository: IPostRepository, 帖子仓储 / post repository
   * - commentRepository: ICommentRepository, 评论仓储 / comment repository
   * - engagementRepository: IEngagementRepository, 互动仓储（点赞/收藏）/ engagement repository (upvote/bookmark)
   * - identityIntegrationPort: IIdentityIntegrationPort, 身份集成端口 / identity integration port
   * - moderationPolicy: IModerationPolicy, 内容审核策略 / content moderation policy
   * - captchaValidator: ICaptchaValidator, 验证码校验器 / captcha validator
   * - eventBus: IEventBus, 事件总线 / event bus
   * - auditApplicationService: AuditApplicationService, 审计应用服务 / audit application service
   * - unitOfWork: IUnitOfWork, 工作单元 / unit of work
   */
  constructor(
    private categoryRepository: ICategoryRepository,
    private postRepository: IPostRepository,
    private commentRepository: ICommentRepository,
    private engagementRepository: IEngagementRepository,
    private identityIntegrationPort: IIdentityIntegrationPort,
    private moderationPolicy: IModerationPolicy,
    private captchaValidator: ICaptchaValidator,
    private eventBus: IEventBus,
    private auditApplicationService: AuditApplicationService,
    private unitOfWork: IUnitOfWork,
  ) {}

  // --- Category Management ---

  /**
   * Function: getPostSubject
   * --------------------------
   * 构建帖子的 CASL subject 对象，用于权限检查。包含帖子的全部属性和关联分类的最小信息。
   *
   * Builds a CASL subject object for a post, used for authorization checks. Contains all post
   * attributes and minimal associated category information.
   *
   * Callers: [CommunityApplicationService.updatePost, .deletePost, .togglePostUpvote,
   *           .togglePostBookmark, .createComment(.getCommentSubject)]
   * Called by: [CommunityApplicationService.updatePost, .deletePost, .togglePostUpvote,
   *              .togglePostBookmark, .createComment(.getCommentSubject)]
   *
   * Callees: [ICategoryRepository.findById, subject]
   * Calls: [ICategoryRepository.findById, subject]
   *
   * Parameters:
   * - post: Post, 帖子领域实体 / the post domain entity
   *
   * Returns: Promise<any>, CASL subject 对象 / CASL subject object
   */
  private async getPostSubject(post: Post) {
    const category = await this.categoryRepository.findById(post.categoryId)
    return subject('Post', {
      id: post.id,
      title: post.title,
      content: post.content,
      categoryId: post.categoryId,
      authorId: post.authorId,
      status: post.status,
      createdAt: post.createdAt,
      category: category
        ? {
            id: category.id,
            minLevel: category.minLevel,
          }
        : null,
    } as any)
  }

  /**
   * Function: getCommentSubject
   * -----------------------------
   * 构建评论的 CASL subject 对象，用于权限检查。包含评论属性以及关联帖子和分类的上下文信息。
   *
   * Builds a CASL subject object for a comment, used for authorization checks. Contains comment
   * attributes along with associated post and category context.
   *
   * Callers: [CommunityApplicationService.updateComment, .deleteComment]
   * Called by: [CommunityApplicationService.updateComment, .deleteComment]
   *
   * Callees: [IPostRepository.findById, ICategoryRepository.findById, subject]
   * Calls: [IPostRepository.findById, ICategoryRepository.findById, subject]
   *
   * Parameters:
   * - comment: Comment, 评论领域实体 / the comment domain entity
   * - postObj: Post | undefined, 可选，预加载的帖子实体（避免重复查询）
   *   optional pre-loaded post entity (avoids duplicate queries)
   *
   * Returns: Promise<any>, CASL subject 对象 / CASL subject object
   */
  private async getCommentSubject(comment: Comment, postObj?: Post) {
    const post = postObj || (await this.postRepository.findById(comment.postId))
    const category = post ? await this.categoryRepository.findById(post.categoryId) : null
    return subject('Comment', {
      id: comment.id,
      content: comment.content,
      postId: comment.postId,
      authorId: comment.authorId,
      parentId: comment.parentId,
      isPending: comment.isPending,
      deletedAt: comment.deletedAt,
      createdAt: comment.createdAt,
      post: post
        ? {
            id: post.id,
            categoryId: post.categoryId,
            authorId: post.authorId,
            status: post.status,
            category: category
              ? {
                  id: category.id,
                  minLevel: category.minLevel,
                }
              : null,
          }
        : null,
    } as any)
  }

  /**
   * Function: createCategory
   * -------------------------
   * 创建新的分类。创建 Category 领域实体，保存到数据库，然后发布 CategoryCreatedEvent。
   *
   * Creates a new category. Creates a Category domain entity, persists it to the database,
   * then publishes a CategoryCreatedEvent.
   *
   * Callers: [AdminController.createCategory]
   * Called by: [AdminController.createCategory]
   *
   * Callees: [Category.create, ICategoryRepository.save, IEventBus.publish]
   * Calls: [Category.create, ICategoryRepository.save, IEventBus.publish]
   *
   * Parameters:
   * - name: string, 分类名称 / category name
   * - description: string | null, 分类描述 / category description
   * - sortOrder: number, 排序顺序 / sort order
   * - minLevel: number, 最小发帖等级 / minimum posting level
   * - operatorId: string, 执行操作的用户 ID / operator user ID
   *
   * Returns:
   * - Promise<Category>, 创建的分类实体 / the created Category entity
   *
   * Error Handling / 错误处理:
   * - Category.create 在参数非法时抛出领域异常 / Category.create throws domain exception on invalid params
   *
   * Side Effects / 副作用:
   * - 写入数据库（分类记录）/ writes to database (category record)
   * - 发布领域事件 / publishes a domain event
   *
   * Transaction / 事务:
   * - 无事务边界，单次写入 / no transaction boundary, single write
   *
   * 中文关键词: 分类创建, 分类管理, 排序, 等级限制, 领域事件, 审计
   * English keywords: category create, category management, sort order, level restriction, domain event, audit
   */
  public async createCategory(
    name: string,
    description: string | null,
    sortOrder: number,
    minLevel: number,
    operatorId: string,
  ): Promise<Category> {
    const category = Category.create({
      id: uuidv4(),
      name,
      description,
      sortOrder: sortOrder || 0,
      minLevel: minLevel || 0,
      moderatorIds: [],
      createdAt: new Date(),
    })
    await this.categoryRepository.save(category)
    this.eventBus.publish(new CategoryCreatedEvent(category.id, operatorId))
    return category
  }

  /**
   * Function: updateCategory
   * -------------------------
   * 更新分类信息。查找分类，更新名称/描述/排序/最小等级，然后保存并发布 CategoryUpdatedEvent。
   *
   * Updates category information. Finds the category, updates name/description/sort order/min level,
   * then persists and publishes a CategoryUpdatedEvent.
   *
   * Callers: [AdminController.updateCategory]
   * Called by: [AdminController.updateCategory]
   *
   * Callees: [ICategoryRepository.findById, Category.updateDetails, Category.changeMinLevel,
   *           ICategoryRepository.save, IEventBus.publish]
   * Calls: [ICategoryRepository.findById, Category.updateDetails, Category.changeMinLevel,
   *         ICategoryRepository.save, IEventBus.publish]
   *
   * Parameters:
   * - id: string, 分类 ID / category ID
   * - name: string, 新名称 / new name
   * - description: string | null, 新描述 / new description
   * - sortOrder: number, 新排序顺序 / new sort order
   * - minLevel: number, 新最小发帖等级 / new minimum posting level
   * - operatorId: string, 执行操作的用户 ID / operator user ID
   *
   * Returns:
   * - Promise<void>, 无返回值 / no return value
   *
   * Error Handling / 错误处理:
   * - ERR_CATEGORY_NOT_FOUND: 分类不存在 / category not found
   *
   * Side Effects / 副作用:
   * - 写入数据库（更新分类）/ writes to database (updates category)
   * - 发布领域事件 / publishes a domain event
   *
   * Transaction / 事务:
   * - 无事务边界，单次写入 / no transaction boundary, single write
   *
   * 中文关键词: 分类更新, 分类编辑, 等级变更, 排序调整, 领域事件, 审计
   * English keywords: category update, category edit, level change, sort order adjust, domain event, audit
   */
  public async updateCategory(
    id: string,
    name: string,
    description: string | null,
    sortOrder: number,
    minLevel: number,
    operatorId: string,
  ): Promise<void> {
    const category = await this.categoryRepository.findById(id)
    if (!category) throw new Error('ERR_CATEGORY_NOT_FOUND')

    if (name) category.updateDetails(name, description, sortOrder)
    if (minLevel !== undefined) category.changeMinLevel(minLevel)

    await this.categoryRepository.save(category)
    this.eventBus.publish(new CategoryUpdatedEvent(id, operatorId))
  }

  /**
   * Function: assignCategoryModerator
   * -----------------------------------
   * 为用户分配指定分类的版主权限。先验证目标用户是否为版主身份，然后将用户添加到分类的 moderator 列表中，
   * 并发布 CategoryModeratorAssignedEvent。
   *
   * Assigns moderator permissions for a specific category to a user. First verifies the target user
   * has a moderator role, then adds the user to the category's moderator list and publishes a
   * CategoryModeratorAssignedEvent.
   *
   * Callers: [AdminController]
   * Called by: [AdminController]
   *
   * Callees: [ICategoryRepository.findById, IIdentityIntegrationPort.isModerator, Category.addModerator,
   *           ICategoryRepository.save, IEventBus.publish]
   * Calls: [ICategoryRepository.findById, IIdentityIntegrationPort.isModerator, Category.addModerator,
   *         ICategoryRepository.save, IEventBus.publish]
   *
   * Parameters:
   * - categoryId: string, 分类 ID / category ID
   * - userId: string, 目标用户 ID / target user ID
   * - operatorId: string, 执行操作的用户 ID / operator user ID
   *
   * Returns:
   * - Promise<any>, { categoryId, userId } / the assigned category and user IDs
   *
   * Error Handling / 错误处理:
   * - ERR_CATEGORY_NOT_FOUND: 分类不存在 / category not found
   * - ERR_USER_NOT_FOUND_OR_IS_NOT_A_MODERATOR: 用户不存在或不是版主 / user not found or is not a moderator
   *
   * Side Effects / 副作用:
   * - 写入数据库（更新分类 moderator 列表）/ writes to database (updates category moderator list)
   * - 发布领域事件 / publishes a domain event
   *
   * Transaction / 事务:
   * - 无事务边界，单次写入 / no transaction boundary, single write
   *
   * 中文关键词: 版主分配, 分类管理, 权限授予, 用户验证, 领域事件, 版主管理
   * English keywords: moderator assign, category management, permission grant, user verification, domain event, moderator management
   */
  public async assignCategoryModerator(
    categoryId: string,
    userId: string,
    operatorId: string,
  ): Promise<any> {
    const category = await this.categoryRepository.findById(categoryId)
    if (!category) throw new Error('ERR_CATEGORY_NOT_FOUND')

    const isModerator = await this.identityIntegrationPort.isModerator(userId)
    if (!isModerator) {
      throw new Error('ERR_USER_NOT_FOUND_OR_IS_NOT_A_MODERATOR')
    }

    category.addModerator(userId)
    await this.categoryRepository.save(category)
    this.eventBus.publish(new CategoryModeratorAssignedEvent(categoryId, userId, operatorId))

    return { categoryId, userId }
  }

  /**
   * Function: removeCategoryModerator
   * -----------------------------------
   * 移除用户在指定分类中的版主权限。从分类的 moderator 列表中移除用户，并发布 CategoryModeratorRemovedEvent。
   *
   * Removes a user's moderator permissions for a specific category. Removes the user from the
   * category's moderator list and publishes a CategoryModeratorRemovedEvent.
   *
   * Callers: [AdminController.removeCategoryModerator]
   * Called by: [AdminController.removeCategoryModerator]
   *
   * Callees: [ICategoryRepository.findById, Category.removeModerator, ICategoryRepository.save,
   *           IEventBus.publish]
   * Calls: [ICategoryRepository.findById, Category.removeModerator, ICategoryRepository.save,
   *         IEventBus.publish]
   *
   * Parameters:
   * - categoryId: string, 分类 ID / category ID
   * - userId: string, 目标用户 ID / target user ID
   * - operatorId: string, 执行操作的用户 ID / operator user ID
   *
   * Returns:
   * - Promise<void>, 无返回值 / no return value
   *
   * Error Handling / 错误处理:
   * - ERR_CATEGORY_NOT_FOUND: 分类不存在 / category not found
   *
   * Side Effects / 副作用:
   * - 写入数据库（更新分类 moderator 列表）/ writes to database (updates category moderator list)
   * - 发布领域事件 / publishes a domain event
   *
   * Transaction / 事务:
   * - 无事务边界，单次写入 / no transaction boundary, single write
   *
   * 中文关键词: 版主移除, 分类管理, 权限撤销, 领域事件, 版主管理, 审计
   * English keywords: moderator remove, category management, permission revoke, domain event, moderator management, audit
   */
  public async removeCategoryModerator(
    categoryId: string,
    userId: string,
    operatorId: string,
  ): Promise<void> {
    const category = await this.categoryRepository.findById(categoryId)
    if (!category) throw new Error('ERR_CATEGORY_NOT_FOUND')

    category.removeModerator(userId)
    await this.categoryRepository.save(category)
    this.eventBus.publish(new CategoryModeratorRemovedEvent(categoryId, userId, operatorId))
  }

  /**
   * Function: deleteCategory
   * -------------------------
   * 删除分类。在事务内级联删除该分类下的所有帖子，然后删除分类本身，并发布 CategoryDeletedEvent。
   *
   * Deletes a category. Within a transaction, cascades to delete all posts in the category,
   * then deletes the category itself and publishes a CategoryDeletedEvent.
   *
   * Callers: [AdminController.deleteCategory]
   * Called by: [AdminController.deleteCategory]
   *
   * Callees: [ICategoryRepository.findById, IUnitOfWork.execute, IPostRepository.deleteManyByCategoryId,
   *           ICategoryRepository.delete, IEventBus.publish]
   * Calls: [ICategoryRepository.findById, IUnitOfWork.execute, IPostRepository.deleteManyByCategoryId,
   *         ICategoryRepository.delete, IEventBus.publish]
   *
   * Parameters:
   * - id: string, 分类 ID / category ID
   * - operatorId: string, 执行操作的用户 ID / operator user ID
   *
   * Returns:
   * - Promise<void>, 无返回值 / no return value
   *
   * Error Handling / 错误处理:
   * - ERR_CATEGORY_NOT_FOUND: 分类不存在 / category not found
   *
   * Side Effects / 副作用:
   * - 写入数据库（删除帖子 + 分类）/ writes to database (deletes posts + category)
   * - 发布领域事件 / publishes a domain event
   *
   * Transaction / 事务:
   * - 通过 IUnitOfWork.execute 管理事务边界（帖子删除 + 分类删除在同一个事务内）
   *   Transaction boundary managed by IUnitOfWork.execute (post deletion + category deletion in one transaction)
   *
   * 中文关键词: 分类删除, 级联删除, 帖子清理, 事务保护, 领域事件, 审计
   * English keywords: category delete, cascade delete, post cleanup, transaction protection, domain event, audit
   */
  public async deleteCategory(id: string, operatorId: string): Promise<void> {
    const category = await this.categoryRepository.findById(id)
    if (!category) throw new Error('ERR_CATEGORY_NOT_FOUND')

    await this.unitOfWork.execute(async () => {
      await this.postRepository.deleteManyByCategoryId(id)
      await this.categoryRepository.delete(id)
    })

    this.eventBus.publish(new CategoryDeletedEvent(id, operatorId))
  }

  /**
   * Function: createPost
   * ---------------------
   * 创建新帖子。先消费验证码、验证分类存在性和用户等级是否足够，然后检查内容是否含有被屏蔽词，
   * 最后创建帖子实体并保存。如果内容包含审核词，帖子的状态将标记为 PENDING（待审核）。
   *
   * Creates a new post. First consumes the captcha, validates the category exists and the user's
   * level is sufficient, checks whether the content contains moderated words, then creates and
   * persists the post entity. If the content contains moderated words, the post status will be
   * marked as PENDING.
   *
   * Callers: [PostController.createPost]
   * Called by: [PostController.createPost]
   *
   * Callees: [ICaptchaValidator.consumeCaptcha, ICategoryRepository.findById, Category.isLevelSufficient,
   *           IModerationPolicy.containsModeratedWord, Post.create, IPostRepository.save]
   * Calls: [ICaptchaValidator.consumeCaptcha, ICategoryRepository.findById, Category.isLevelSufficient,
   *         IModerationPolicy.containsModeratedWord, Post.create, IPostRepository.save]
   *
   * Parameters:
   * - title: string, 帖子标题 / post title
   * - content: string, 帖子内容 / post content
   * - categoryId: string, 分类 ID / category ID
   * - authorId: string, 作者用户 ID / author user ID
   * - userLevel: number, 用户等级 / user level
   * - captchaId: string, 验证码 ID / captcha ID
   *
   * Returns:
   * - Promise<{ postId, isModerated, status, message? }>, 帖子创建结果（ID、是否被审核、状态、可选消息）
   *   post creation result (ID, moderation flag, status, optional message)
   *
   * Error Handling / 错误处理:
   * - ERR_INVALID_OR_EXPIRED_CAPTCHA: 验证码无效或已过期 / captcha invalid or expired
   * - ERR_CATEGORY_NOT_FOUND: 分类不存在 / category not found
   * - ERR_INSUFFICIENT_LEVEL_TO_POST_IN_THIS_CATEGORY: 用户等级不足 / insufficient user level
   *
   * Side Effects / 副作用:
   * - 消费验证码 / consumes captcha
   * - 写入数据库（帖子记录）/ writes to database (post record)
   *
   * Transaction / 事务:
   * - 无事务边界，三次独立写入（消费验证码 + 帖子保存）/ no transaction boundary, three independent writes
   *
   * 中文关键词: 发帖, 验证码, 等级校验, 内容审核, 敏感词, 待审核, 创建帖子
   * English keywords: create post, captcha, level check, content moderation, moderated word, pending, post creation
   */
  public async createPost(
    title: string,
    content: string,
    categoryId: string,
    authorId: string,
    userLevel: number,
    captchaId: string,
  ): Promise<{ postId: string; isModerated: boolean; status: string; message?: string }> {
    const isCaptchaValid = await this.captchaValidator.consumeCaptcha(captchaId)
    if (!isCaptchaValid) throw new Error('ERR_INVALID_OR_EXPIRED_CAPTCHA')

    const category = await this.categoryRepository.findById(categoryId)
    if (!category) throw new Error('ERR_CATEGORY_NOT_FOUND')
    if (!category.isLevelSufficient(userLevel)) {
      throw new Error('ERR_INSUFFICIENT_LEVEL_TO_POST_IN_THIS_CATEGORY')
    }

    const isModerated = await this.moderationPolicy.containsModeratedWord(
      title + ' ' + content,
      categoryId,
    )

    const post = Post.create(
      {
        id: uuidv4(),
        title,
        content,
        categoryId,
        authorId,
        createdAt: new Date(),
      },
      isModerated,
    )

    await this.postRepository.save(post)

    const result: { postId: string; isModerated: boolean; status: string; message?: string } = {
      postId: post.id,
      isModerated,
      status: post.status,
    }

    if (post.status === 'PENDING') {
      result.message = 'ERR_PENDING_MODERATION'
    }

    return result
  }

  /**
   * Function: updatePost
   * ---------------------
   * 更新已有帖子。先检查用户权限（update），然后对更新后的内容进行屏蔽词审核，最后保存更新。
   *
   * Updates an existing post. First checks the user's authorization (update), then performs
   * content moderation on the updated content, and finally persists the changes.
   *
   * Callers: [PostController.updatePost]
   * Called by: [PostController.updatePost]
   *
   * Callees: [IPostRepository.findById, CommunityApplicationService.getPostSubject, AnyAbility.can,
   *           IModerationPolicy.containsModeratedWord, Post.updateContent, IPostRepository.save]
   * Calls: [IPostRepository.findById, CommunityApplicationService.getPostSubject, AnyAbility.can,
   *         IModerationPolicy.containsModeratedWord, Post.updateContent, IPostRepository.save]
   *
   * Parameters:
   * - ability: AnyAbility, CASL 权限实例 / the CASL ability instance
   * - postId: string, 帖子 ID / post ID
   * - title: string, 新标题 / new title
   * - content: string, 新内容 / new content
   * - categoryId: string, 新分类 ID / new category ID
   *
   * Returns:
   * - Promise<{ postId: string }>, 更新后的帖子 ID / the updated post ID
   *
   * Error Handling / 错误处理:
   * - ERR_POST_NOT_FOUND: 帖子不存在 / post not found
   * - ERR_FORBIDDEN_INSUFFICIENT_PERMISSIONS_TO_EDIT_THIS_POST: 无编辑权限 / insufficient permissions
   *
   * Side Effects / 副作用:
   * - 写入数据库（更新帖子）/ writes to database (updates post)
   *
   * Transaction / 事务:
   * - 无事务边界，单次写入 / no transaction boundary, single write
   *
   * 中文关键词: 编辑帖子, 权限校验, 内容更新, 审核重检, CASL, 帖子管理
   * English keywords: update post, authorization check, content update, re-moderation, CASL, post management
   */
  public async updatePost(
    ability: AnyAbility,
    postId: string,
    title: string,
    content: string,
    categoryId: string,
  ): Promise<{ postId: string }> {
    const post = await this.postRepository.findById(postId)
    if (!post) throw new Error('ERR_POST_NOT_FOUND')

    if (!ability.can('update', await this.getPostSubject(post))) {
      throw new Error('ERR_FORBIDDEN_INSUFFICIENT_PERMISSIONS_TO_EDIT_THIS_POST')
    }

    const checkTitle = title || post.title
    const checkContent = content || post.content
    const isModerated = await this.moderationPolicy.containsModeratedWord(
      checkTitle + ' ' + checkContent,
      categoryId || post.categoryId,
    )

    post.updateContent(title, content, categoryId, isModerated)
    await this.postRepository.save(post)

    return { postId: post.id }
  }

  /**
   * Function: deletePost
   * ---------------------
   * 软删除帖子及其关联评论。检查用户权限后，标记帖子为删除状态，在事务内保存帖子并软删除其下所有评论。
   *
   * Soft deletes a post and its associated comments. After checking the user's authorization,
   * marks the post as deleted, then within a transaction saves the post and soft deletes
   * all comments under it.
   *
   * Callers: [PostController.deletePost]
   * Called by: [PostController.deletePost]
   *
   * Callees: [IPostRepository.findById, CommunityApplicationService.getPostSubject, AnyAbility.can,
   *           Post.delete, IUnitOfWork.execute, IPostRepository.save, ICommentRepository.softDeleteManyByPostId]
   * Calls: [IPostRepository.findById, CommunityApplicationService.getPostSubject, AnyAbility.can,
   *         Post.delete, IUnitOfWork.execute, IPostRepository.save, ICommentRepository.softDeleteManyByPostId]
   *
   * Parameters:
   * - ability: AnyAbility, CASL 权限实例 / the CASL ability instance
   * - postId: string, 帖子 ID / post ID
   *
   * Returns:
   * - Promise<void>, 无返回值 / no return value
   *
   * Error Handling / 错误处理:
   * - ERR_POST_NOT_FOUND: 帖子不存在 / post not found
   * - ERR_FORBIDDEN_INSUFFICIENT_PERMISSIONS_TO_DELETE_THIS_POST: 删除权限不足 / insufficient delete permissions
   *
   * Side Effects / 副作用:
   * - 写入数据库（更新帖子状态 + 软删除评论）/ writes to database (updates post status + soft deletes comments)
   *
   * Transaction / 事务:
   * - 通过 IUnitOfWork.execute 管理事务边界（帖子保存 + 评论软删除在同一个事务内）
   *   Transaction boundary managed by IUnitOfWork.execute (post save + comment soft delete in one transaction)
   *
   * 中文关键词: 删除帖子, 软删除, 级联评论, 事务保护, 权限校验, CASL, 帖子管理
   * English keywords: delete post, soft delete, cascade comments, transaction protection, authorization check, CASL, post management
   */
  public async deletePost(ability: AnyAbility, postId: string): Promise<void> {
    const post = await this.postRepository.findById(postId)
    if (!post) throw new Error('ERR_POST_NOT_FOUND')

    if (!ability.can('delete', await this.getPostSubject(post))) {
      throw new Error('ERR_FORBIDDEN_INSUFFICIENT_PERMISSIONS_TO_DELETE_THIS_POST')
    }

    post.delete()

    await this.unitOfWork.execute(async () => {
      await this.postRepository.save(post)
      await this.commentRepository.softDeleteManyByPostId(postId)
    })
  }

  // --- Comment Management ---

  /**
   * Function: createComment
   * ------------------------
   * 创建新评论。先消费验证码、验证帖子和父评论存在性，然后对内容进行审核检查，创建评论实体。
   * 如果评论不是作者回复自己的帖子，则发布 PostRepliedEvent；如果回复他人评论，则发布 CommentRepliedEvent。
   *
   * Creates a new comment. First consumes the captcha, validates the post and parent comment exist,
   * then performs content moderation, creates the comment entity. If the comment is not the author
   * replying to their own post, publishes a PostRepliedEvent; if replying to another user's comment,
   * publishes a CommentRepliedEvent.
   *
   * Callers: [PostController.createComment]
   * Called by: [PostController.createComment]
   *
   * Callees: [ICaptchaValidator.consumeCaptcha, IPostRepository.findById, ICommentRepository.findById,
   *           IModerationPolicy.containsModeratedWord, Comment.create, ICommentRepository.save,
   *           IEventBus.publish]
   * Calls: [ICaptchaValidator.consumeCaptcha, IPostRepository.findById, ICommentRepository.findById,
   *         IModerationPolicy.containsModeratedWord, Comment.create, ICommentRepository.save,
   *         IEventBus.publish]
   *
   * Parameters:
   * - content: string, 评论内容 / comment content
   * - postId: string, 所属帖子 ID / parent post ID
   * - authorId: string, 作者用户 ID / author user ID
   * - captchaId: string, 验证码 ID / captcha ID
   * - parentId: string | undefined, 可选，父评论 ID（用于回复评论）/ optional parent comment ID (for replies)
   *
   * Returns:
   * - Promise<{ commentId: string }>, 创建的评论 ID / the created comment ID
   *
   * Error Handling / 错误处理:
   * - ERR_INVALID_OR_EXPIRED_CAPTCHA: 验证码无效或已过期 / captcha invalid or expired
   * - ERR_POST_NOT_FOUND: 帖子不存在 / post not found
   * - ERR_INVALID_PARENT_COMMENT: 父评论无效或不属于指定帖子 / invalid parent comment
   *
   * Side Effects / 副作用:
   * - 消费验证码 / consumes captcha
   * - 写入数据库（评论记录）/ writes to database (comment record)
   * - 发布领域事件（通知帖子/评论作者）/ publishes domain events (notifies post/comment authors)
   *
   * Transaction / 事务:
   * - 无事务边界 / no transaction boundary
   *
   * 中文关键词: 评论, 回复, 创建评论, 验证码, 内容审核, 事件通知, 帖子回复, 评论回复
   * English keywords: comment, reply, create comment, captcha, content moderation, event notification, post reply, comment reply
   */
  public async createComment(
    content: string,
    postId: string,
    authorId: string,
    captchaId: string,
    parentId?: string,
  ): Promise<{ commentId: string }> {
    const isCaptchaValid = await this.captchaValidator.consumeCaptcha(captchaId)
    if (!isCaptchaValid) throw new Error('ERR_INVALID_OR_EXPIRED_CAPTCHA')

    const post = await this.postRepository.findById(postId)
    if (!post) throw new Error('ERR_POST_NOT_FOUND')

    let parentComment
    if (parentId) {
      parentComment = await this.commentRepository.findById(parentId)
      if (!parentComment || parentComment.postId !== postId) {
        throw new Error('ERR_INVALID_PARENT_COMMENT')
      }
    }

    const isModerated = await this.moderationPolicy.containsModeratedWord(content, post.categoryId)

    const comment = Comment.create(
      {
        id: uuidv4(),
        content,
        postId,
        authorId,
        parentId: parentId || null,
        deletedAt: null,
        createdAt: new Date(),
      },
      isModerated,
    )

    await this.commentRepository.save(comment)

    if (post.authorId !== authorId) {
      this.eventBus.publish(
        new PostRepliedEvent(postId, post.authorId, post.title, authorId, comment.id),
      )
    }
    if (parentComment && parentComment.authorId !== authorId) {
      this.eventBus.publish(
        new CommentRepliedEvent(parentId!, parentComment.authorId, postId, authorId, comment.id),
      )
    }

    return { commentId: comment.id }
  }

  /**
   * Function: updateComment
   * ------------------------
   * 更新已有评论。检查用户权限（update），重新对内容进行审核检查，然后保存更新。
   *
   * Updates an existing comment. Checks the user's authorization (update), re-runs content moderation
   * on the content, then persists the changes.
   *
   * Callers: [PostController.updateComment]
   * Called by: [PostController.updateComment]
   *
   * Callees: [ICommentRepository.findById, CommunityApplicationService.getCommentSubject, AnyAbility.can,
   *           IPostRepository.findById, IModerationPolicy.containsModeratedWord, Comment.updateContent,
   *           ICommentRepository.save]
   * Calls: [ICommentRepository.findById, CommunityApplicationService.getCommentSubject, AnyAbility.can,
   *         IPostRepository.findById, IModerationPolicy.containsModeratedWord, Comment.updateContent,
   *         ICommentRepository.save]
   *
   * Parameters:
   * - ability: AnyAbility, CASL 权限实例 / the CASL ability instance
   * - commentId: string, 评论 ID / comment ID
   * - content: string, 新内容 / new content
   *
   * Returns:
   * - Promise<{ commentId: string }>, 更新后的评论 ID / the updated comment ID
   *
   * Error Handling / 错误处理:
   * - ERR_COMMENT_NOT_FOUND: 评论不存在 / comment not found
   * - ERR_FORBIDDEN_INSUFFICIENT_PERMISSIONS_TO_EDIT_THIS_COMMENT: 编辑权限不足 / insufficient edit permissions
   * - ERR_POST_NOT_FOUND: 关联帖子不存在 / associated post not found
   *
   * Side Effects / 副作用:
   * - 写入数据库（更新评论）/ writes to database (updates comment)
   *
   * Transaction / 事务:
   * - 无事务边界，单次写入 / no transaction boundary, single write
   *
   * 中文关键词: 编辑评论, 权限校验, 内容更新, 审核重检, CASL, 评论管理
   * English keywords: update comment, authorization check, content update, re-moderation, CASL, comment management
   */
  public async updateComment(
    ability: AnyAbility,
    commentId: string,
    content: string,
  ): Promise<{ commentId: string }> {
    const comment = await this.commentRepository.findById(commentId)
    if (!comment) throw new Error('ERR_COMMENT_NOT_FOUND')

    if (!ability.can('update', await this.getCommentSubject(comment))) {
      throw new Error('ERR_FORBIDDEN_INSUFFICIENT_PERMISSIONS_TO_EDIT_THIS_COMMENT')
    }

    const post = await this.postRepository.findById(comment.postId)
    if (!post) throw new Error('ERR_POST_NOT_FOUND')

    const isModerated = await this.moderationPolicy.containsModeratedWord(content, post.categoryId)
    comment.updateContent(content, isModerated)
    await this.commentRepository.save(comment)

    return { commentId: comment.id }
  }

  /**
   * Function: deleteComment
   * ------------------------
   * 软删除评论。检查用户权限后，标记评论为删除状态并保存。
   *
   * Soft deletes a comment. After checking the user's authorization, marks the comment as
   * deleted and persists it.
   *
   * Callers: [PostController.deleteComment]
   * Called by: [PostController.deleteComment]
   *
   * Callees: [ICommentRepository.findById, CommunityApplicationService.getCommentSubject, AnyAbility.can,
   *           Comment.delete, ICommentRepository.save]
   * Calls: [ICommentRepository.findById, CommunityApplicationService.getCommentSubject, AnyAbility.can,
   *         Comment.delete, ICommentRepository.save]
   *
   * Parameters:
   * - ability: AnyAbility, CASL 权限实例 / the CASL ability instance
   * - commentId: string, 评论 ID / comment ID
   *
   * Returns:
   * - Promise<void>, 无返回值 / no return value
   *
   * Error Handling / 错误处理:
   * - ERR_COMMENT_NOT_FOUND: 评论不存在 / comment not found
   * - ERR_FORBIDDEN_INSUFFICIENT_PERMISSIONS_TO_DELETE_THIS_COMMENT: 删除权限不足 / insufficient delete permissions
   *
   * Side Effects / 副作用:
   * - 写入数据库（更新评论删除状态）/ writes to database (updates comment deletion status)
   *
   * Transaction / 事务:
   * - 无事务边界，单次写入 / no transaction boundary, single write
   *
   * 中文关键词: 删除评论, 软删除, 权限校验, CASL, 评论管理
   * English keywords: delete comment, soft delete, authorization check, CASL, comment management
   */
  public async deleteComment(ability: AnyAbility, commentId: string): Promise<void> {
    const comment = await this.commentRepository.findById(commentId)
    if (!comment) throw new Error('ERR_COMMENT_NOT_FOUND')

    if (!ability.can('delete', await this.getCommentSubject(comment))) {
      throw new Error('ERR_FORBIDDEN_INSUFFICIENT_PERMISSIONS_TO_DELETE_THIS_COMMENT')
    }

    comment.delete()
    await this.commentRepository.save(comment)
  }

  // --- Engagements ---

  /**
   * Function: togglePostUpvote
   * ----------------------------
   * 切换帖子的点赞状态。如果用户已点赞则取消点赞，否则创建点赞。
   * 先验证帖子存在，再检查用户的读取权限。
   *
   * Toggles the upvote status on a post. Removes the upvote if the user has already upvoted,
   * otherwise creates a new upvote. First validates the post exists, then checks the user's
   * read permission.
   *
   * Callers: [PostController.toggleUpvote]
   * Called by: [PostController.toggleUpvote]
   *
   * Callees: [IPostRepository.findById, CommunityApplicationService.getPostSubject, AnyAbility.can,
   *           IEngagementRepository.findPostUpvote, IEngagementRepository.deletePostUpvote,
   *           PostUpvote.create, IEngagementRepository.savePostUpvote]
   * Calls: [IPostRepository.findById, CommunityApplicationService.getPostSubject, AnyAbility.can,
   *         IEngagementRepository.findPostUpvote, IEngagementRepository.deletePostUpvote,
   *         PostUpvote.create, IEngagementRepository.savePostUpvote]
   *
   * Parameters:
   * - ability: AnyAbility, CASL 权限实例 / the CASL ability instance
   * - postId: string, 帖子 ID / post ID
   * - userId: string, 用户 ID / user ID
   *
   * Returns:
   * - Promise<boolean>, true=已点赞（开启），false=取消点赞（关闭）/ true=upvoted (on), false=un-upvoted (off)
   *
   * Error Handling / 错误处理:
   * - ERR_POST_NOT_FOUND: 帖子不存在 / post not found
   * - ERR_FORBIDDEN: 无读取权限 / no read permission
   *
   * Side Effects / 副作用:
   * - 写入数据库（创建或删除点赞记录）/ writes to database (creates or deletes upvote record)
   *
   * Transaction / 事务:
   * - 无事务边界，单次写入 / no transaction boundary, single write
   *
   * 中文关键词: 点赞, 切换点赞, 帖子互动, 取消点赞, 用户互动, 社交功能
   * English keywords: upvote, toggle upvote, post engagement, un-upvote, user interaction, social feature
   */
  public async togglePostUpvote(
    ability: AnyAbility,
    postId: string,
    userId: string,
  ): Promise<boolean> {
    const post = await this.postRepository.findById(postId)
    if (!post) throw new Error('ERR_POST_NOT_FOUND')

    if (!ability.can('read', await this.getPostSubject(post))) {
      throw new Error('ERR_FORBIDDEN')
    }

    const existing = await this.engagementRepository.findPostUpvote(postId, userId)
    if (existing) {
      await this.engagementRepository.deletePostUpvote(postId, userId)
      return false // Toggled off
    } else {
      const upvote = PostUpvote.create({ userId, postId, createdAt: new Date() })
      await this.engagementRepository.savePostUpvote(upvote)
      return true // Toggled on
    }
  }

  /**
   * Function: togglePostBookmark
   * ------------------------------
   * 切换帖子的收藏状态。如果用户已收藏则取消收藏，否则创建收藏。
   *
   * Toggles the bookmark status on a post. Removes the bookmark if the user has already bookmarked,
   * otherwise creates a new bookmark.
   *
   * Callers: [PostController.toggleBookmark]
   * Called by: [PostController.toggleBookmark]
   *
   * Callees: [IPostRepository.findById, CommunityApplicationService.getPostSubject, AnyAbility.can,
   *           IEngagementRepository.findPostBookmark, IEngagementRepository.deletePostBookmark,
   *           PostBookmark.create, IEngagementRepository.savePostBookmark]
   * Calls: [IPostRepository.findById, CommunityApplicationService.getPostSubject, AnyAbility.can,
   *         IEngagementRepository.findPostBookmark, IEngagementRepository.deletePostBookmark,
   *         PostBookmark.create, IEngagementRepository.savePostBookmark]
   *
   * Parameters:
   * - ability: AnyAbility, CASL 权限实例 / the CASL ability instance
   * - postId: string, 帖子 ID / post ID
   * - userId: string, 用户 ID / user ID
   *
   * Returns:
   * - Promise<boolean>, true=已收藏（开启），false=取消收藏（关闭）/ true=bookmarked (on), false=un-bookmarked (off)
   *
   * Error Handling / 错误处理:
   * - ERR_POST_NOT_FOUND: 帖子不存在 / post not found
   * - ERR_FORBIDDEN: 无读取权限 / no read permission
   *
   * Side Effects / 副作用:
   * - 写入数据库（创建或删除收藏记录）/ writes to database (creates or deletes bookmark record)
   *
   * Transaction / 事务:
   * - 无事务边界，单次写入 / no transaction boundary, single write
   *
   * 中文关键词: 收藏, 切换收藏, 帖子收藏, 取消收藏, 用户互动, 书签功能
   * English keywords: bookmark, toggle bookmark, post bookmark, un-bookmark, user interaction, bookmark feature
   */
  public async togglePostBookmark(
    ability: AnyAbility,
    postId: string,
    userId: string,
  ): Promise<boolean> {
    const post = await this.postRepository.findById(postId)
    if (!post) throw new Error('ERR_POST_NOT_FOUND')

    if (!ability.can('read', await this.getPostSubject(post))) {
      throw new Error('ERR_FORBIDDEN')
    }

    const existing = await this.engagementRepository.findPostBookmark(postId, userId)
    if (existing) {
      await this.engagementRepository.deletePostBookmark(postId, userId)
      return false
    } else {
      const bookmark = PostBookmark.create({ userId, postId, createdAt: new Date() })
      await this.engagementRepository.savePostBookmark(bookmark)
      return true
    }
  }

  /**
   * Function: toggleCommentUpvote
   * -------------------------------
   * 切换评论的点赞状态。如果用户已点赞则取消点赞，否则创建点赞。
   *
   * Toggles the upvote status on a comment. Removes the upvote if the user has already upvoted,
   * otherwise creates a new upvote.
   *
   * Callers: [PostController.toggleCommentUpvote]
   * Called by: [PostController.toggleCommentUpvote]
   *
   * Callees: [ICommentRepository.findById, IPostRepository.findById,
   *           CommunityApplicationService.getPostSubject, AnyAbility.can,
   *           IEngagementRepository.findCommentUpvote, IEngagementRepository.deleteCommentUpvote,
   *           CommentUpvote.create, IEngagementRepository.saveCommentUpvote]
   * Calls: [ICommentRepository.findById, IPostRepository.findById,
   *         CommunityApplicationService.getPostSubject, AnyAbility.can,
   *         IEngagementRepository.findCommentUpvote, IEngagementRepository.deleteCommentUpvote,
   *         CommentUpvote.create, IEngagementRepository.saveCommentUpvote]
   *
   * Parameters:
   * - ability: AnyAbility, CASL 权限实例 / the CASL ability instance
   * - commentId: string, 评论 ID / comment ID
   * - userId: string, 用户 ID / user ID
   *
   * Returns:
   * - Promise<boolean>, true=已点赞（开启），false=取消点赞（关闭）/ true=upvoted (on), false=un-upvoted (off)
   *
   * Error Handling / 错误处理:
   * - ERR_COMMENT_NOT_FOUND: 评论不存在 / comment not found
   * - ERR_POST_NOT_FOUND: 关联帖子不存在 / associated post not found
   * - ERR_FORBIDDEN: 无读取权限 / no read permission
   *
   * Side Effects / 副作用:
   * - 写入数据库（创建或删除点赞记录）/ writes to database (creates or deletes upvote record)
   *
   * Transaction / 事务:
   * - 无事务边界，单次写入 / no transaction boundary, single write
   *
   * 中文关键词: 评论点赞, 切换点赞, 评论互动, 取消点赞, 用户互动, 社交功能
   * English keywords: comment upvote, toggle upvote, comment engagement, un-upvote, user interaction, social feature
   */
  public async toggleCommentUpvote(
    ability: AnyAbility,
    commentId: string,
    userId: string,
  ): Promise<boolean> {
    const comment = await this.commentRepository.findById(commentId)
    if (!comment) throw new Error('ERR_COMMENT_NOT_FOUND')

    const post = await this.postRepository.findById(comment.postId)
    if (!post) throw new Error('ERR_POST_NOT_FOUND')

    if (!ability.can('read', await this.getPostSubject(post))) {
      throw new Error('ERR_FORBIDDEN')
    }

    const existing = await this.engagementRepository.findCommentUpvote(commentId, userId)
    if (existing) {
      await this.engagementRepository.deleteCommentUpvote(commentId, userId)
      return false
    } else {
      const upvote = CommentUpvote.create({ userId, commentId, createdAt: new Date() })
      await this.engagementRepository.saveCommentUpvote(upvote)
      return true
    }
  }

  /**
   * Function: toggleCommentBookmark
   * ---------------------------------
   * 切换评论的收藏状态。如果用户已收藏则取消收藏，否则创建收藏。
   *
   * Toggles the bookmark status on a comment. Removes the bookmark if the user has already
   * bookmarked, otherwise creates a new bookmark.
   *
   * Callers: [PostController.toggleCommentBookmark]
   * Called by: [PostController.toggleCommentBookmark]
   *
   * Callees: [ICommentRepository.findById, IPostRepository.findById,
   *           CommunityApplicationService.getPostSubject, AnyAbility.can,
   *           IEngagementRepository.findCommentBookmark, IEngagementRepository.deleteCommentBookmark,
   *           CommentBookmark.create, IEngagementRepository.saveCommentBookmark]
   * Calls: [ICommentRepository.findById, IPostRepository.findById,
   *         CommunityApplicationService.getPostSubject, AnyAbility.can,
   *         IEngagementRepository.findCommentBookmark, IEngagementRepository.deleteCommentBookmark,
   *         CommentBookmark.create, IEngagementRepository.saveCommentBookmark]
   *
   * Parameters:
   * - ability: AnyAbility, CASL 权限实例 / the CASL ability instance
   * - commentId: string, 评论 ID / comment ID
   * - userId: string, 用户 ID / user ID
   *
   * Returns:
   * - Promise<boolean>, true=已收藏（开启），false=取消收藏（关闭）/ true=bookmarked (on), false=un-bookmarked (off)
   *
   * Error Handling / 错误处理:
   * - ERR_COMMENT_NOT_FOUND: 评论不存在 / comment not found
   * - ERR_POST_NOT_FOUND: 关联帖子不存在 / associated post not found
   * - ERR_FORBIDDEN: 无读取权限 / no read permission
   *
   * Side Effects / 副作用:
   * - 写入数据库（创建或删除收藏记录）/ writes to database (creates or deletes bookmark record)
   *
   * Transaction / 事务:
   * - 无事务边界，单次写入 / no transaction boundary, single write
   *
   * 中文关键词: 评论收藏, 切换收藏, 评论收藏, 取消收藏, 用户互动, 书签功能
   * English keywords: comment bookmark, toggle bookmark, comment bookmark, un-bookmark, user interaction, bookmark feature
   */
  public async toggleCommentBookmark(
    ability: AnyAbility,
    commentId: string,
    userId: string,
  ): Promise<boolean> {
    const comment = await this.commentRepository.findById(commentId)
    if (!comment) throw new Error('ERR_COMMENT_NOT_FOUND')

    const post = await this.postRepository.findById(comment.postId)
    if (!post) throw new Error('ERR_POST_NOT_FOUND')

    if (!ability.can('read', await this.getPostSubject(post))) {
      throw new Error('ERR_FORBIDDEN')
    }

    const existing = await this.engagementRepository.findCommentBookmark(commentId, userId)
    if (existing) {
      await this.engagementRepository.deleteCommentBookmark(commentId, userId)
      return false
    } else {
      const bookmark = CommentBookmark.create({ userId, commentId, createdAt: new Date() })
      await this.engagementRepository.saveCommentBookmark(bookmark)
      return true
    }
  }
}
